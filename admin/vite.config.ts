/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** 本地联调：`gbrain serve --http` 默认 3131；可用 GBRAIN_DEV_API 覆盖。 */
const devApi = process.env.GBRAIN_DEV_API ?? 'http://127.0.0.1:3131';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/admin/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/admin/login': { target: devApi, changeOrigin: true },
      '/admin/api': { target: devApi, changeOrigin: true },
      '/admin/events': { target: devApi, changeOrigin: true },
      '/mcp': { target: devApi, changeOrigin: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
