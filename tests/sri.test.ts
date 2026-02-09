import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import { rm, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtureRoot = path.resolve(__dirname, 'fixtures/basic')
const distDir = path.resolve(fixtureRoot, 'dist')
const publicFixtureRoot = path.resolve(__dirname, 'fixtures/public')
const publicDistDir = path.resolve(publicFixtureRoot, 'dist')
const baseRelativeFixtureRoot = path.resolve(__dirname, 'fixtures/base-relative')
const baseRelativeDistDir = path.resolve(baseRelativeFixtureRoot, 'dist')

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
    await rm(publicDistDir, { recursive: true, force: true })
    await rm(baseRelativeDistDir, { recursive: true, force: true })
  })

  afterAll(async () => {
    await rm(distDir, { recursive: true, force: true })
    await rm(publicDistDir, { recursive: true, force: true })
    await rm(baseRelativeDistDir, { recursive: true, force: true })
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

  test('injects integrity for public directory assets', async () => {
    await build({
      configFile: path.resolve(publicFixtureRoot, 'vite.config.ts'),
      logLevel: 'error',
    })

    const html = await readFile(path.join(publicDistDir, 'index.html'), 'utf8')
    const scriptMatch = html.match(/<script[^>]+src="([^"]*external\/index\.js[^"]*)"[^>]+integrity="([^"]+)"[^>]*><\/script>/)
    expect(scriptMatch, 'injects integrity on public script').not.toBeNull()

    const publicScriptPath = path.join(publicFixtureRoot, 'public', 'external', 'index.js')
    const publicScriptContent = await readFile(publicScriptPath)
    const expectedIntegrity = `sha384-${createHash('sha384').update(publicScriptContent).digest('base64')}`

    expect(scriptMatch?.[2]).toBe(expectedIntegrity)
  })

  test('injects integrity when base is relative', async () => {
    await build({
      configFile: path.resolve(baseRelativeFixtureRoot, 'vite.config.ts'),
      logLevel: 'error',
    })

    const html = await readFile(path.join(baseRelativeDistDir, 'index.html'), 'utf8')
    const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]+integrity="([^"]+)"[^>]*><\/script>/)
    expect(scriptMatch, 'injects integrity on relative base script').not.toBeNull()

    const scriptSrc = scriptMatch?.[1] ?? ''
    const normalizedSrc = scriptSrc.startsWith('./') ? scriptSrc.slice(2) : scriptSrc
    const scriptFilePath = path.join(baseRelativeDistDir, normalizedSrc)
    const scriptContent = await readFile(scriptFilePath)
    const expectedIntegrity = `sha384-${createHash('sha384').update(scriptContent).digest('base64')}`

    expect(scriptMatch?.[2]).toBe(expectedIntegrity)
  })
})
