import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"
import { inspectAttr } from 'kimi-plugin-inspect-react'

export default defineConfig(({ command }) => ({
  base: './',
  plugins: command === 'serve' ? [inspectAttr(), react()] : [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:21547', changeOrigin: true },
      '/Admin': { target: 'http://localhost:21547', changeOrigin: true },
    },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/runtimeFixtures.ts'],
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
}));