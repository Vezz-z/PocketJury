// ==============================================================================
// PocketJury API — Feedback Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import prisma from "../config/database";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();
router.use(authMiddleware);

const feedbackSchema = z.object({
  messageId: z.string().uuid(),
  rating: z.enum(["HELPFUL", "NOT_HELPFUL"]),
  comment: z.string().max(500).optional(),
});

// POST /api/v1/feedback
router.post(
  "/",
  validate(feedbackSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Verify message belongs to a chat owned by the user
      const message = await prisma.message.findUnique({
        where: { id: req.body.messageId },
        select: { chat: { select: { userId: true } } },
      });
      if (!message || message.chat.userId !== req.user!.sub) {
        res.status(403).json({ error: "Message not found or access denied" });
        return;
      }

      const feedback = await prisma.feedback.upsert({
        where: {
          messageId_userId: {
            messageId: req.body.messageId,
            userId: req.user!.sub,
          },
        },
        update: {
          rating: req.body.rating,
          comment: req.body.comment,
        },
        create: {
          messageId: req.body.messageId,
          userId: req.user!.sub,
          rating: req.body.rating,
          comment: req.body.comment,
        },
      });
      res.status(201).json(feedback);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
