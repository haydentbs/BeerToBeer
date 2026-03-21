import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup/vitest.ts'],
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
})
