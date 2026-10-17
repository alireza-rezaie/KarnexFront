import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './',
  // The inspector is development-only and must not be part of the production bundle.
  plugins: command === 'serve' ? [inspectAttr(), react()] : [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:21547',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/runtimeFixtures.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));
