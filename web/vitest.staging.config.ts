import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/staging/**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
})
