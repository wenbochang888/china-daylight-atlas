import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  base: './',
  plugins: [vue()],
  test: { include: ['tests/unit/**/*.test.ts'] },
  build: { chunkSizeWarningLimit: 1300 },
});
