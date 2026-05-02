// ==============================================================================
// PocketJury API — Chat Service
// ==============================================================================

import { Readable } from "node:stream";
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
        _count: { select: { messages: true } },
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
        messagesCount: c._count?.messages || 0,
        lastMessage: c.messages[0]?.content?.slice(0, 200) || null,
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

  /**
   * Non-streaming message send — waits for full AI response before returning.
   */
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
      // Call AI service (non-streaming)
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

  /**
   * Streaming message send — pipes SSE events from the AI service to the client.
   *
   * Returns a Node.js Readable stream that the Express route can pipe to `res`.
   * After the stream ends, the full assistant message is saved to the database.
   */
  async sendMessageStream(input: SendMessageInput): Promise<{ stream: Readable; userMessageId: string }> {
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
      .replace(/<[^>]*>/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "")
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

    // Build chat history
    const chatHistory = chat.messages.reverse().map((m: any) => ({
      role: m.role.toLowerCase(),
      content: m.content,
    }));

    // Get user profile for persona
    const profile = await prisma.profile.findUnique({
      where: { userId: input.userId },
      select: { personaMode: true },
    });

    // Get the raw SSE stream from FastAPI
    const aiResponse = await aiService.queryStream({
      query: sanitizedContent,
      userId: input.userId,
      chatId: input.chatId,
      personaMode: profile?.personaMode || chat.personaMode,
      languageCode: chat.languageCode,
      chatHistory,
    });

    if (!aiResponse.body) {
      throw createError("AI service returned empty stream", 503);
    }

    // Use a PassThrough stream — actively pump data from the web ReadableStream
    // into it so each chunk is forwarded to the client immediately.
    const { PassThrough } = await import("node:stream");
    const passthrough = new PassThrough();
    const chatId = input.chatId;
    const isFirstMessage = chatHistory.length === 0;
    const firstMessageContent = sanitizedContent;
    const collectedChunks: string[] = [];

    // Fire-and-forget: generate a descriptive title via LLM IMMEDIATELY
    // (don't wait for stream to finish — the user sees the title update sooner)
    if (isFirstMessage) {
      aiService.generateTitle(firstMessageContent).then(async (title) => {
        try {
          await prisma.chat.update({
            where: { id: chatId },
            data: { title },
          });
        } catch (titleErr) {
          logger.warn({ err: titleErr, chatId }, "Failed to save generated title");
        }
      }).catch(() => {});
    }

    // Pump the web ReadableStream into the PassThrough in the background
    const reader = aiResponse.body.getReader();
    const decoder = new TextDecoder();

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          collectedChunks.push(text);
          passthrough.write(text);
        }
      } catch (err) {
        logger.error({ err, chatId }, "Error reading AI stream");
      } finally {
        passthrough.end();
      }

      // After stream ends, save the assistant message to the database
      try {
        const fullText = collectedChunks.join("");
        const doneMatch = fullText.match(/event: done\ndata: (.+)\n/);
        const metaMatch = fullText.match(/event: metadata\ndata: (.+)\n/);

        if (doneMatch) {
          const doneData = JSON.parse(doneMatch[1]);
          const metaData = metaMatch ? JSON.parse(metaMatch[1]) : {};
          const content = doneData.answer_translated || doneData.answer || "";

          await prisma.message.create({
            data: {
              chatId,
              role: "ASSISTANT",
              content,
              contentOriginalLanguage: metaData.language_detected !== "en" ? content : null,
              languageCode: metaData.language_detected || "en",
              metadata: {
                citedSections: metaData.references || [],
                confidenceScore: metaData.confidence_score || 0,
                processingTimeMs: doneData.processing_time_ms || 0,
                helplines: metaData.helplines || [],
              },
            },
          });

          await prisma.chat.update({
            where: { id: chatId },
            data: { updatedAt: new Date() },
          });
        }
      } catch (err) {
        logger.error({ err, chatId }, "Failed to save streamed assistant message");
      }
    })();

    return { stream: passthrough as Readable, userMessageId: userMessage.id };
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
