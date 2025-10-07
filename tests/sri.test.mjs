import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { rm, readFile } from 'node:fs/promises'
import { build } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtureRoot = path.resolve(__dirname, 'fixtures/basic')
const distDir = path.resolve(fixtureRoot, 'dist')

const expected = JSON.parse(
  await readFile(path.join(fixtureRoot, 'expected.json'), 'utf8'),
)

test('injects SRI attributes into generated assets', async (t) => {
  t.after(async () => {
    await rm(distDir, { recursive: true, force: true })
  })

  await rm(distDir, { recursive: true, force: true })

  await build({
    configFile: path.resolve(fixtureRoot, 'vite.config.ts'),
    logLevel: 'error',
  })

  const html = await readFile(path.join(distDir, 'index.html'), 'utf8')

  const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]+integrity="([^"]+)"[^>]*><\/script>/)
  assert.ok(scriptMatch, 'injects integrity on emitted module script')
  assert.equal(scriptMatch[1], expected.script.src)
  assert.equal(scriptMatch[2], expected.script.integrity)

  const styleMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]+integrity="([^"]+)"/)
  assert.ok(styleMatch, 'injects integrity on emitted stylesheet')
  assert.equal(styleMatch[1], expected.style.href)
  assert.equal(styleMatch[2], expected.style.integrity)
})
