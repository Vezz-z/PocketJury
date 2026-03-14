import { defineConfig } from '@prisma/config';

export default defineConfig({
  earlyAccess: true,
  seed: 'tsx prisma/seed.ts',
});
