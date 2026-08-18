import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * .mts rather than .ts: the file is ESM, and Vite's native config loader reads
 * a bare .ts as CommonJS. Under that loader the ESM syntax here is a warning
 * now and an error once it becomes the default. ESM also means no __dirname,
 * hence the import.meta.url form below.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
