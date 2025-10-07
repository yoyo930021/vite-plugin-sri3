import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { sri } from '../../../src'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  root: __dirname,
  plugins: [
    sri(),
  ],
  build: {
    // Keep output deterministic for assertions
    minify: false,
  },
})
