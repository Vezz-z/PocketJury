// ==============================================================================
// PocketJury API — Chat Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { chatService } from "../services/chat.service";
import { authMiddleware } from "../middleware/auth";
import { queryLimiter } from "../middleware/rateLimiter";
import { auditLog } from "../middleware/audit";
import { validate } from "../middleware/validate";

const router = Router();

const sendGuestMessageSchema = z.object({
  content: z.string().min(1).max(2000),
  chatHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).optional().default([]),
  languageCode: z.enum(["en", "hi", "ta", "bn"]).optional().default("en")
});

// POST /api/v1/chats/guest/stream (SSE)
router.post(
  "/guest/stream",
  queryLimiter,
  validate(sendGuestMessageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stream } = await chatService.sendGuestMessageStream(req.body);

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      stream.pipe(res);

      req.on("close", () => {
        stream.destroy();
      });
    } catch (err) {
      next(err);
    }
  }
);

// All other chat routes require authentication
router.use(authMiddleware);

const createChatSchema = z.object({
  personaMode: z.enum(["STUDENT", "PROFESSIONAL", "SENIOR_CITIZEN", "RURAL_USER", "GENERAL"]).optional(),
  languageCode: z.enum(["en", "hi", "ta", "bn"]).optional(),
});

const sendMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});

const updateChatSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  isArchived: z.boolean().optional(),
});

// GET /api/v1/chats
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await chatService.listChats(req.user!.sub, cursor, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/chats
router.post(
  "/",
  validate(createChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chat = await chatService.createChat({
        userId: req.user!.sub,
        personaMode: req.body.personaMode,
        languageCode: req.body.languageCode,
      });
      res.status(201).json(chat);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/chats/:chatId
router.get("/:chatId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageCursor = req.query.messageCursor as string | undefined;
    const messageLimit = Math.min(parseInt(req.query.messageLimit as string) || 50, 100);
    const chat = await chatService.getChat(req.params.chatId as string, req.user!.sub, messageCursor, messageLimit);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/chats/:chatId
router.patch(
  "/:chatId",
  validate(updateChatSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const chat = await chatService.updateChat(req.params.chatId as string, req.user!.sub, req.body);
      res.json(chat);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/chats/:chatId
router.delete(
  "/:chatId",
  auditLog("DELETE_CHAT", "chat"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await chatService.deleteChat(req.params.chatId as string, req.user!.sub);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages
router.post(
  "/:chatId/messages",
  queryLimiter,
  validate(sendMessageSchema),
  auditLog("QUERY", "message"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.sendMessage({
        chatId: req.params.chatId as string,
        userId: req.user!.sub,
        content: req.body.content,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages/stream (SSE)
router.post(
  "/:chatId/messages/stream",
  queryLimiter,
  validate(sendMessageSchema),
  auditLog("QUERY_STREAM", "message"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stream, userMessageId } = await chatService.sendMessageStream({
        chatId: req.params.chatId as string,
        userId: req.user!.sub,
        content: req.body.content,
      });

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Bypass nginx buffering
      res.setHeader("X-User-Message-Id", userMessageId);
      res.flushHeaders();

      // Pipe the stream directly to the response
      stream.pipe(res);

      // Handle client disconnect
      req.on("close", () => {
        stream.destroy();
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages/:messageId/simplify
router.post(
  "/:chatId/messages/:messageId/simplify",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.simplifyMessage(req.params.messageId as string, req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages/:messageId/simplify/stream (SSE)
router.post(
  "/:chatId/messages/:messageId/simplify/stream",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { stream } = await chatService.simplifyMessageStream(
        req.params.messageId as string,
        req.user!.sub,
      );

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      stream.pipe(res);

      req.on("close", () => {
        stream.destroy();
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages/:messageId/references
router.post(
  "/:chatId/messages/:messageId/references",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await chatService.getMessageReferences(req.params.messageId as string, req.user!.sub);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/chats/:chatId/messages/system
router.post(
  "/:chatId/messages/system",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: "Content is required" });
      const result = await chatService.addSystemMessage(req.params.chatId as string, req.user!.sub, content);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
