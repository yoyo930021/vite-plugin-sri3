import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { rm, readFile } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtureRoot = path.resolve(__dirname, 'fixtures/basic')
const distDir = path.resolve(fixtureRoot, 'dist')

type ExpectedHashes = {
  script: { src: string, integrity: string }
  style: { href: string, integrity: string }
}

const expectedPath = path.join(fixtureRoot, 'expected.json')

describe('vite-plugin-sri3', () => {
  let expected: ExpectedHashes

  beforeAll(async () => {
    expected = JSON.parse(await readFile(expectedPath, 'utf8')) as ExpectedHashes
    await rm(distDir, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(distDir, { recursive: true, force: true })
  })

  test('injects deterministic SRI attributes into generated assets', async () => {
    // Import plugin to ensure coverage instrumentation captures source execution
    const { sri } = await import('../src/index.ts')
    expect(typeof sri).toBe('function')

    await build({
      configFile: path.resolve(fixtureRoot, 'vite.config.ts'),
      logLevel: 'error',
    })

    const html = await readFile(path.join(distDir, 'index.html'), 'utf8')

    const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]+integrity="([^"]+)"[^>]*><\/script>/)
    expect(scriptMatch, 'injects integrity on emitted module script').not.toBeNull()
    expect(scriptMatch?.[1]).toBe(expected.script.src)
    expect(scriptMatch?.[2]).toBe(expected.script.integrity)

    const styleMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]+integrity="([^"]+)"/)
    expect(styleMatch, 'injects integrity on emitted stylesheet').not.toBeNull()
    expect(styleMatch?.[1]).toBe(expected.style.href)
    expect(styleMatch?.[2]).toBe(expected.style.integrity)
  })

  test('skips deterministic SRI attributes on scripts with skip-sri attribute', async () => {
    // Import plugin to ensure coverage instrumentation captures source execution
    const { sri } = await import('../src/index.ts')
    expect(typeof sri).toBe('function')

    await build({
      configFile: path.resolve(fixtureRoot, 'vite.config.ts'),
      logLevel: 'error',
    })

    const sourceHtml = await readFile(path.join(fixtureRoot, 'index.html'), 'utf8')
    const html = await readFile(path.join(distDir, 'index.html'), 'utf8')

    const scriptMatchSource = sourceHtml.match(/<script[^>]+src="([^"]+)"[^>]+skip-sri[^>]*><\/script>/)
    expect(scriptMatchSource, 'find script with skip-sri attribute').not.toBeNull()

    const source = scriptMatchSource?.[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regx = new RegExp(`<script[^>]+src="${source}"[^>]*><\\/script>`);
    const scriptMatch = html.match(regx)
    expect(scriptMatch?.[0]).not.toContain('integrity')
  })
})
