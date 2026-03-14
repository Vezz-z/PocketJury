// ==============================================================================
// PocketJury API — DLSA Service
// ==============================================================================

import prisma from "../config/database";
import redis from "../config/redis";
import { CACHE_TTL } from "@pocketjury/shared";

export class DLSAService {
  async searchByLocation(state?: string, district?: string) {
    const cacheKey = `dlsa:${state || "all"}:${district || "all"}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const contacts = await prisma.escalationContact.findMany({
      where: {
        isActive: true,
        ...(state && { state: { equals: state, mode: "insensitive" } }),
        ...(district && { district: { equals: district, mode: "insensitive" } }),
      },
      orderBy: [{ state: "asc" }, { district: "asc" }],
    });

    await redis.set(cacheKey, JSON.stringify(contacts), "EX", CACHE_TTL.DLSA);
    return contacts;
  }

  async findNearest(lat: number, lng: number, limit = 3) {
    // Use Haversine formula via raw SQL for proximity search
    const contacts = await prisma.$queryRaw`
      SELECT *,
        (6371 * acos(
          cos(radians(${lat})) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(${lng})) +
          sin(radians(${lat})) * sin(radians(latitude))
        )) AS distance_km
      FROM escalation_contacts
      WHERE is_active = true
        AND latitude IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY distance_km
      LIMIT ${limit}
    `;

    return contacts;
  }

  async getHelplines(category?: string) {
    const cacheKey = `helplines:${category || "all"}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const helplines = await prisma.helpline.findMany({
      where: category ? { category: category as never } : undefined,
      orderBy: { name: "asc" },
    });

    await redis.set(cacheKey, JSON.stringify(helplines), "EX", CACHE_TTL.HELPLINES);
    return helplines;
  }
}

export const dlsaService = new DLSAService();
