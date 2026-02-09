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

    const skipScriptMatch = html.match(/<script[^>]+src="\/skip\.js"[^>]*><\/script>/)
    expect(skipScriptMatch, 'keeps skip script without integrity and skip-sri').not.toBeNull()
    expect(skipScriptMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipScriptMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipStyleMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="\/skip\.css"[^>]*\/?>(?!<\/link>)/)
    expect(skipStyleMatch, 'keeps skip stylesheet without integrity and skip-sri').not.toBeNull()
    expect(skipStyleMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipStyleMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipStyleSlashMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="\/skip-slash\.css"[^>]*\/?>(?!<\/link>)/)
    expect(skipStyleSlashMatch, 'keeps skip-sri/ stylesheet without integrity and skip-sri').not.toBeNull()
    expect(skipStyleSlashMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipStyleSlashMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipScriptEarlyMatch = html.match(/<script[^>]+src="\/skip-early\.js"[^>]*><\/script>/)
    expect(skipScriptEarlyMatch, 'keeps early skip script without integrity and skip-sri').not.toBeNull()
    expect(skipScriptEarlyMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipScriptEarlyMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipScriptEmptyMatch = html.match(/<script[^>]+src="\/skip-empty\.js"[^>]*><\/script>/)
    expect(skipScriptEmptyMatch, 'keeps skip-sri="" script without integrity and skip-sri').not.toBeNull()
    expect(skipScriptEmptyMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipScriptEmptyMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipStyleEarlyMatch = html.match(/<link[^>]+href="\/skip-early\.css"[^>]*\/?>(?!<\/link>)/)
    expect(skipStyleEarlyMatch, 'keeps early skip stylesheet without integrity and skip-sri').not.toBeNull()
    expect(skipStyleEarlyMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipStyleEarlyMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipStyleEmptyMatch = html.match(/<link[^>]+href="\/skip-empty\.css"[^>]*\/?>(?!<\/link>)/)
    expect(skipStyleEmptyMatch, 'keeps skip-sri="" stylesheet without integrity and skip-sri').not.toBeNull()
    expect(skipStyleEmptyMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipStyleEmptyMatch?.[0]).not.toMatch(/\sskip-sri/)

    const skipModulePreloadMatch = html.match(/<link[^>]+rel="modulepreload"[^>]+href="\/skip-preload\.mjs"[^>]*\/?>(?!<\/link>)/)
    expect(skipModulePreloadMatch, 'keeps skip modulepreload without integrity and skip-sri').not.toBeNull()
    expect(skipModulePreloadMatch?.[0]).not.toMatch(/\sintegrity=/)
    expect(skipModulePreloadMatch?.[0]).not.toMatch(/\sskip-sri/)
  })
})
