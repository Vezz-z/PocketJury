// ==============================================================================
// PocketJury API — DLSA Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { dlsaService } from "../services/dlsa.service";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";

const router = Router();
router.use(authMiddleware);

const searchSchema = z.object({
  state: z.string().optional(),
  district: z.string().optional(),
});

const nearestSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

// GET /api/v1/dlsa/search
router.get(
  "/search",
  validate(searchSchema, "query"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contacts = await dlsaService.searchByLocation(
        req.query.state as string,
        req.query.district as string
      );
      res.json(contacts);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/dlsa/nearest
router.get(
  "/nearest",
  validate(nearestSchema, "query"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const contacts = await dlsaService.findNearest(
        parseFloat(req.query.lat as string),
        parseFloat(req.query.lng as string)
      );
      res.json(contacts);
    } catch (err) {
      next(err);
    }
  }
);

const helplineCategorySchema = z.object({
  category: z.string().optional(),
});

// GET /api/v1/dlsa/helplines
router.get(
  "/helplines",
  validate(helplineCategorySchema, "query"),
  async (req: Request, res: Response, next: NextFunction) => {
  try {
    const helplines = await dlsaService.getHelplines(req.query.category as string | undefined);
    res.json(helplines);
  } catch (err) {
    next(err);
  }
}
);

export default router;
