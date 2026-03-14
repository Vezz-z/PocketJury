// ==============================================================================
// PocketJury API — User Routes
// ==============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { userService } from "../services/user.service";
import { authMiddleware } from "../middleware/auth";
import { auditLog } from "../middleware/audit";
import { validate } from "../middleware/validate";

const router = Router();
router.use(authMiddleware);

const updateProfileSchema = z.object({
  email: z.string().email().optional(),
  dateOfBirth: z.string().optional(),
  fullName: z.string().min(2).max(100).optional(),
  contactPhone: z.string().regex(/^\+?[0-9]{10,15}$/).optional(),
  professionType: z.enum(["STUDENT", "EMPLOYED", "UNEMPLOYED", "SELF_EMPLOYED"]).optional(),
  fieldOfStudy: z.string().max(100).optional(),
  yearOfPassing: z.number().min(1950).max(2030).optional(),
  currentProfession: z.string().max(100).optional(),
  locationState: z.string().max(100).optional(),
  locationDistrict: z.string().max(100).optional(),
});

const updateLanguageSchema = z.object({
  languageCode: z.enum(["en", "hi", "ta", "bn"]),
});

const updatePersonaSchema = z.object({
  personaMode: z.enum(["STUDENT", "PROFESSIONAL", "SENIOR_CITIZEN", "RURAL_USER", "GENERAL"]),
});

// GET /api/v1/users/me
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await userService.getProfile(req.user!.sub);
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/me
router.patch(
  "/me",
  validate(updateProfileSchema),
  auditLog("UPDATE_PROFILE", "profile"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const profile = await userService.updateProfile(req.user!.sub, req.body);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/users/me/language
router.patch(
  "/me/language",
  validate(updateLanguageSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.updateLanguage(req.user!.sub, req.body.languageCode);
      res.json({ message: "Language updated" });
    } catch (err) {
      next(err);
    }
  }
);

// PATCH /api/v1/users/me/persona
router.patch(
  "/me/persona",
  validate(updatePersonaSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.updatePersona(req.user!.sub, req.body.personaMode);
      res.json({ message: "Persona mode updated" });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/users/me
router.delete(
  "/me",
  auditLog("DELETE_ACCOUNT", "user"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.deleteAccount(req.user!.sub);
      res.json({
        message: "Account marked for deletion. It will be permanently removed after 30 days.",
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/users/me/data-export
router.get(
  "/me/data-export",
  auditLog("DATA_EXPORT", "user"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await userService.exportUserData(req.user!.sub);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
