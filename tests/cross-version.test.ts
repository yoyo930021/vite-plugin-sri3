import { describe, test, expect, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtureRoot = path.resolve(__dirname, 'fixtures/basic')

const versions = [
  { name: 'vite5', pkg: 'vite5', distDir: path.resolve(fixtureRoot, 'dist-vite5') },
  { name: 'vite7', pkg: 'vite7', distDir: path.resolve(fixtureRoot, 'dist-vite7') },
]

describe('cross-version compatibility', () => {
  afterAll(async () => {
    for (const v of versions) {
      await rm(v.distDir, { recursive: true, force: true })
    }
  })

  for (const version of versions) {
    test(`injects correct SRI attributes with ${version.name}`, async () => {
      const { sri } = await import('../src/index.ts')
      const vite = await import(version.pkg) as { build: typeof import('vite').build }

      await rm(version.distDir, { recursive: true, force: true })

      await vite.build({
        configFile: false,
        root: fixtureRoot,
        plugins: [sri()],
        build: {
          minify: false,
          outDir: version.distDir,
        },
        logLevel: 'error',
      })

      const html = await readFile(path.join(version.distDir, 'index.html'), 'utf8')

      // Verify script has integrity and hash matches actual file
      const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]+integrity="([^"]+)"[^>]*><\/script>/)
      expect(scriptMatch, `${version.name}: should inject integrity on script`).not.toBeNull()

      const scriptSrc = scriptMatch![1]
      const scriptPath = path.join(version.distDir, scriptSrc.startsWith('/') ? scriptSrc.slice(1) : scriptSrc)
      const scriptContent = await readFile(scriptPath)
      const expectedScriptIntegrity = `sha384-${createHash('sha384').update(scriptContent).digest('base64')}`
      expect(scriptMatch![2]).toBe(expectedScriptIntegrity)

      // Verify stylesheet has integrity and hash matches actual file
      const styleMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]+integrity="([^"]+)"/)
      expect(styleMatch, `${version.name}: should inject integrity on stylesheet`).not.toBeNull()

      const styleHref = styleMatch![1]
      const stylePath = path.join(version.distDir, styleHref.startsWith('/') ? styleHref.slice(1) : styleHref)
      const styleContent = await readFile(stylePath)
      const expectedStyleIntegrity = `sha384-${createHash('sha384').update(styleContent).digest('base64')}`
      expect(styleMatch![2]).toBe(expectedStyleIntegrity)

      // Verify skip-sri tags do NOT have integrity
      const skipScriptMatch = html.match(/<script[^>]+src="\/skip\.js"[^>]*><\/script>/)
      expect(skipScriptMatch, `${version.name}: skip-sri script present`).not.toBeNull()
      expect(skipScriptMatch![0]).not.toMatch(/\sintegrity=/)
      expect(skipScriptMatch![0]).not.toMatch(/\sskip-sri/)
    })
  }
})
