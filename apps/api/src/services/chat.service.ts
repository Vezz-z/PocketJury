// ==============================================================================
// PocketJury API — Chat Service
// ==============================================================================

import prisma from "../config/database";
import redis from "../config/redis";
import { aiService } from "./ai.service";
import { createError } from "../middleware/errorHandler";
import { logger } from "../utils/logger";
import type { PersonaMode, MessageRole } from "@prisma/client";

interface CreateChatInput {
  userId: string;
  personaMode?: PersonaMode;
  languageCode?: string;
}

interface SendMessageInput {
  chatId: string;
  userId: string;
  content: string;
}

export class ChatService {
  async listChats(userId: string, cursor?: string, limit = 20) {
    const chats = await prisma.chat.findMany({
      where: { userId, isArchived: false },
      orderBy: { updatedAt: "desc" },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      select: {
        id: true,
        title: true,
        personaMode: true,
        languageCode: true,
        createdAt: true,
        updatedAt: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { content: true, createdAt: true },
        },
      },
    });

    const hasMore = chats.length > limit;
    if (hasMore) chats.pop();

    return {
      data: chats.map((c: any) => ({
        id: c.id,
        title: c.title,
        personaMode: c.personaMode,
        languageCode: c.languageCode,
        lastMessage: c.messages[0]?.content?.slice(0, 100) || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      nextCursor: hasMore ? chats[chats.length - 1]?.id : null,
      hasMore,
    };
  }

  async createChat(input: CreateChatInput) {
    const chat = await prisma.chat.create({
      data: {
        userId: input.userId,
        personaMode: input.personaMode || "GENERAL",
        languageCode: input.languageCode || "en",
      },
    });
    return chat;
  }

  async getChat(chatId: string, userId: string, messageCursor?: string, messageLimit = 50) {
    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId },
    });

    if (!chat) {
      throw createError("Chat not found", 404);
    }

    const messages = await prisma.message.findMany({
      where: { chatId },
      orderBy: { createdAt: "asc" },
      take: messageLimit,
      ...(messageCursor && {
        cursor: { id: messageCursor },
        skip: 1,
      }),
    });

    return { ...chat, messages };
  }

  async updateChat(chatId: string, userId: string, data: { title?: string; isArchived?: boolean }) {
    const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
    if (!chat) throw createError("Chat not found", 404);

    return prisma.chat.update({
      where: { id: chatId },
      data,
    });
  }

  async deleteChat(chatId: string, userId: string) {
    const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
    if (!chat) throw createError("Chat not found", 404);

    await prisma.chat.delete({ where: { id: chatId } });
  }

  async addSystemMessage(chatId: string, userId: string, content: string) {
    const chat = await prisma.chat.findFirst({ where: { id: chatId, userId } });
    if (!chat) throw createError("Chat not found", 404);

    const message = await prisma.message.create({
      data: {
        chatId,
        role: "ASSISTANT",
        content,
        languageCode: chat.languageCode,
      },
    });
    return message;
  }

  async sendMessage(input: SendMessageInput) {
    const chat = await prisma.chat.findFirst({
      where: { id: input.chatId, userId: input.userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { role: true, content: true },
        },
      },
    });

    if (!chat) throw createError("Chat not found", 404);

    // Sanitize input
    const sanitizedContent = input.content
      .replace(/<[^>]*>/g, "")   // Strip HTML tags
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "") // Strip control chars
      .trim();

    if (!sanitizedContent || sanitizedContent.length > 2000) {
      throw createError("Message must be between 1 and 2000 characters", 400);
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        chatId: input.chatId,
        role: "USER",
        content: sanitizedContent,
        languageCode: chat.languageCode,
      },
    });

    // Build chat history for context
    const chatHistory = chat.messages.reverse().map((m: any) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

    // Get user profile for persona
    const profile = await prisma.profile.findUnique({
      where: { userId: input.userId },
      select: { personaMode: true },
    });

    try {
      // Call AI service
      const aiResponse = await aiService.query({
        query: sanitizedContent,
        userId: input.userId,
        chatId: input.chatId,
        personaMode: profile?.personaMode || chat.personaMode,
        languageCode: chat.languageCode,
        chatHistory,
      });

      // Save assistant message
      const assistantMessage = await prisma.message.create({
        data: {
          chatId: input.chatId,
          role: "ASSISTANT",
          content: aiResponse.response,
          contentOriginalLanguage: aiResponse.language !== "en" ? aiResponse.response : null,
          languageCode: aiResponse.language,
          metadata: {
            citedSections: aiResponse.citedSections,
            confidenceScore: aiResponse.metadata.confidenceScore,
            processingTimeMs: aiResponse.metadata.processingTimeMs,
            helplines: aiResponse.helplines,
          },
        },
      });

      // Update chat title from first message
      if (chatHistory.length === 0) {
        const title = sanitizedContent.slice(0, 80) + (sanitizedContent.length > 80 ? "..." : "");
        await prisma.chat.update({
          where: { id: input.chatId },
          data: { title },
        });
      }

      // Touch chat updated_at
      await prisma.chat.update({
        where: { id: input.chatId },
        data: { updatedAt: new Date() },
      });

      return {
        userMessage,
        assistantMessage,
        disclaimer: aiResponse.disclaimer,
      };
    } catch (err) {
      logger.error({ err, chatId: input.chatId }, "AI service query failed");
      throw createError("Failed to generate response. Please try again.", 503);
    }
  }

  async simplifyMessage(messageId: string, userId: string) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, chat: { userId } },
      include: { chat: true },
    });

    if (!message || message.role !== "ASSISTANT") {
      throw createError("Message not found", 404);
    }

    if (!message.simplifiedContent) {
      const simplified = await aiService.simplify({
        originalResponse: message.content,
        languageCode: message.chat.languageCode,
        personaMode: "RURAL_USER", // Always simplify with simplified persona
      });
      message.simplifiedContent = simplified;
    }

    // 1. Delete all subsequent messages in this chat
    await prisma.message.deleteMany({
      where: {
        chatId: message.chatId,
        createdAt: { gt: message.createdAt },
      },
    });

    // 2. Replace the original content with the simplified version and append the generic header marker
    const newContent = `[SIMPLIFIED_MARKER]\n\n${message.simplifiedContent}`;

    await prisma.message.update({
      where: { id: messageId },
      data: {
        content: newContent,
        simplifiedContent: null, // Wipe the side-by-side flag
      },
    });

    return { content: newContent };
  }

  async getMessageReferences(messageId: string, userId: string) {
    const message = await prisma.message.findFirst({
      where: { id: messageId, chat: { userId } },
    });

    if (!message || message.role !== "ASSISTANT") {
      throw createError("Message not found", 404);
    }

    const metadata = message.metadata as Record<string, unknown> | null;
    return {
      citedSections: (metadata?.citedSections as unknown[]) || [],
    };
  }
}

export const chatService = new ChatService();
