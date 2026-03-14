// ==============================================================================
// PocketJury — API Test Setup
// ==============================================================================

import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('../src/config/database', () => ({
  prisma: {
    user: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    profile: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), upsert: jest.fn() },
    chat: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    message: { create: jest.fn(), findMany: jest.fn() },
    feedback: { upsert: jest.fn() },
    auditLog: { create: jest.fn() },
    escalationContact: { findMany: jest.fn() },
    helpline: { findMany: jest.fn() },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

// Mock Redis
jest.mock('../src/config/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    setex: jest.fn(),
  },
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
}));

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});
