// ==============================================================================
// PocketJury — Auth Service Tests
// ==============================================================================

import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPrismaUserFindUnique = jest.fn();
const mockRedisGet = jest.fn();
const mockRedisSet = jest.fn();
const mockRedisDel = jest.fn();
const mockSignAccessToken = jest.fn();
const mockSignRefreshToken = jest.fn();

jest.mock("crypto", () => ({
  randomUUID: jest.fn(() => "new-session-id"),
}));

jest.mock("../../src/config/database", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: mockPrismaUserFindUnique,
    },
  },
}));

jest.mock("../../src/config/redis", () => ({
  __esModule: true,
  default: {
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  },
}));

jest.mock("../../src/utils/jwt", () => ({
  signAccessToken: mockSignAccessToken,
  signRefreshToken: mockSignRefreshToken,
}));

import { AuthService } from "../../src/services/auth.service";

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    jest.clearAllMocks();

    mockPrismaUserFindUnique.mockResolvedValue({
      id: "user-1",
      role: "CITIZEN",
      preferredLanguage: "en",
      isActive: true,
    });
    mockSignAccessToken.mockResolvedValue("access-token");
    mockSignRefreshToken.mockResolvedValue("refresh-token-rotated");
  });

  describe("refreshTokens", () => {
    it("isolates invalid session refresh token invalidation to that session key only", async () => {
      mockRedisGet.mockResolvedValue("different-token");

      await expect(
        service.refreshTokens("user-1", "presented-token", "session-a")
      ).rejects.toMatchObject({ message: "Invalid refresh token", statusCode: 401 });

      expect(mockRedisDel).toHaveBeenCalledWith("refresh:user-1:session-a");
      expect(mockRedisDel).not.toHaveBeenCalledWith("refresh:user-1");
    });

    it("rotates refresh token on the same session key when sid is present", async () => {
      mockRedisGet.mockResolvedValue("presented-token");

      const result = await service.refreshTokens("user-1", "presented-token", "session-a");

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token-rotated",
      });
      expect(mockSignRefreshToken).toHaveBeenCalledWith("user-1", "session-a");
      expect(mockRedisSet).toHaveBeenCalledWith(
        "refresh:user-1:session-a",
        "refresh-token-rotated",
        "EX",
        expect.any(Number)
      );
      expect(mockRedisDel).not.toHaveBeenCalledWith("refresh:user-1");
    });

    it("supports legacy key migration to a new session key when sid is missing", async () => {
      mockRedisGet.mockResolvedValue("legacy-token");

      const result = await service.refreshTokens("user-1", "legacy-token");

      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token-rotated",
      });
      expect(mockSignRefreshToken).toHaveBeenCalledWith("user-1", "new-session-id");
      expect(mockRedisDel).toHaveBeenCalledWith("refresh:user-1");
      expect(mockRedisSet).toHaveBeenCalledWith(
        "refresh:user-1:new-session-id",
        "refresh-token-rotated",
        "EX",
        expect.any(Number)
      );
    });
  });

  describe("logout", () => {
    it("deletes only the session key when sid is provided", async () => {
      await service.logout("user-1", "session-a");
      expect(mockRedisDel).toHaveBeenCalledWith("refresh:user-1:session-a");
      expect(mockRedisDel).not.toHaveBeenCalledWith("refresh:user-1");
    });

    it("deletes legacy key when sid is not provided", async () => {
      await service.logout("user-1");
      expect(mockRedisDel).toHaveBeenCalledWith("refresh:user-1");
    });
  });
});
