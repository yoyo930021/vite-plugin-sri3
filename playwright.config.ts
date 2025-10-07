import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/playwright',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  use: {
    headless: true,
  },
})
