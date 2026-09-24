import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = (dir: string): string => fileURLToPath(new URL(`./src/${dir}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@/domain': src('domain'),
      '@/application': src('application'),
      '@/infrastructure': src('infrastructure'),
      '@/presentation': src('presentation'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: { include: ['src/domain/**', 'src/application/**'] },
  },
});
