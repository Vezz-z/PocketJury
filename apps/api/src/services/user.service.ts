// ==============================================================================
// PocketJury API — User Service
// ==============================================================================

import prisma from "../config/database";
import { encrypt, decrypt } from "../utils/encryption";
import { createError } from "../middleware/errorHandler";

interface UpdateProfileInput {
  email?: string;
  dateOfBirth?: string;
  professionType?: "STUDENT" | "EMPLOYED" | "UNEMPLOYED" | "SELF_EMPLOYED";
  fieldOfStudy?: string;
  yearOfPassing?: number;
  currentProfession?: string;
  locationState?: string;
  locationDistrict?: string;
  contactPhone?: string;
  fullName?: string;
}

export class UserService {
  private safeDecrypt(value: string | null | undefined): string | null {
    if (value == null) return null;
    try {
      const result = decrypt(value);
      return result || null; // Return null for empty strings
    } catch {
      // Backward compatibility for legacy plaintext rows or data encrypted with a different key.
      return value || null;
    }
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, consents: true },
    });

    if (!user) throw createError("User not found", 404);

    return {
      id: user.id,
      email: this.safeDecrypt(user.email),
      preferredLanguage: user.preferredLanguage,
      role: user.role,
      isVerified: user.isVerified,
      profile: user.profile
        ? {
          fullName: this.safeDecrypt(user.profile.fullName),
          dateOfBirth: this.safeDecrypt(user.profile.dateOfBirth),
          contactPhone: this.safeDecrypt(user.profile.contactPhone),
          professionType: user.profile.professionType,
          fieldOfStudy: user.profile.fieldOfStudy,
          yearOfPassing: user.profile.yearOfPassing,
          currentProfession: user.profile.currentProfession,
          personaMode: user.profile.personaMode,
          locationState: user.profile.locationState,
          locationDistrict: user.profile.locationDistrict,
          profileCompleted: user.profile.profileCompleted,
        }
        : null,
      consents: user.consents.map((c: any) => ({
        type: c.consentType,
        granted: c.granted,
        grantedAt: c.grantedAt,
      })),
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw createError("Profile not found", 404);

    const updateData: Record<string, unknown> = {};

    if (input.fullName !== undefined) updateData.fullName = encrypt(input.fullName);
    if (input.dateOfBirth !== undefined) updateData.dateOfBirth = encrypt(input.dateOfBirth);
    if (input.contactPhone !== undefined) updateData.contactPhone = encrypt(input.contactPhone);
    if (input.professionType !== undefined) updateData.professionType = input.professionType;
    if (input.fieldOfStudy !== undefined) updateData.fieldOfStudy = input.fieldOfStudy;
    if (input.yearOfPassing !== undefined) updateData.yearOfPassing = input.yearOfPassing;
    if (input.currentProfession !== undefined) updateData.currentProfession = input.currentProfession;
    if (input.locationState !== undefined) updateData.locationState = input.locationState;
    if (input.locationDistrict !== undefined) updateData.locationDistrict = input.locationDistrict;

    // Check if optional fields are now completed
    const merged = { ...profile, ...updateData };
    if (merged.professionType && (merged.fieldOfStudy || merged.currentProfession)) {
      updateData.profileCompleted = true;
    }

    if (input.email !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: { email: encrypt(input.email) }
      });
    }

    await prisma.profile.update({
      where: { userId },
      data: updateData,
    });

    // Return properly decrypted data mirroring getProfile
    const updatedUser = await this.getProfile(userId);
    return updatedUser.profile;
  }

  async updateLanguage(userId: string, languageCode: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { preferredLanguage: languageCode },
    });
  }

  async updatePersona(userId: string, personaMode: "STUDENT" | "PROFESSIONAL" | "SENIOR_CITIZEN" | "RURAL_USER" | "GENERAL") {
    return prisma.profile.update({
      where: { userId },
      data: { personaMode },
    });
  }

  async deleteAccount(userId: string) {
    // Hard delete directly to free up the email for re-registration
    await prisma.user.delete({
      where: { id: userId },
    });
  }

  async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        chats: { include: { messages: true } },
        feedback: true,
        consents: true,
        auditLogs: { take: 100, orderBy: { createdAt: "desc" } },
      },
    });

    if (!user) throw createError("User not found", 404);

    return {
      user: {
        email: this.safeDecrypt(user.email),
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
      profile: user.profile
        ? {
          fullName: this.safeDecrypt(user.profile.fullName),
          dateOfBirth: this.safeDecrypt(user.profile.dateOfBirth),
          professionType: user.profile.professionType,
          fieldOfStudy: user.profile.fieldOfStudy,
          currentProfession: user.profile.currentProfession,
        }
        : null,
      chats: user.chats.map((c: any) => ({
        title: c.title,
        createdAt: c.createdAt,
        messages: c.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        })),
      })),
      feedback: user.feedback,
      consents: user.consents,
    };
  }
}

export const userService = new UserService();
