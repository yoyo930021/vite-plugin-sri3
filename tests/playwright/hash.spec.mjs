import { test, expect } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { rm, readFile, writeFile } from 'node:fs/promises'
import http from 'node:http'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const fixtureRoot = path.resolve(__dirname, '../fixtures/basic')
const distDir = path.resolve(fixtureRoot, 'dist')

const MIME_BY_EXT = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

async function loadExpected() {
  const raw = await readFile(path.join(fixtureRoot, 'expected.json'), 'utf8')
  return JSON.parse(raw)
}

async function startStaticServer(root) {
  return await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.statusCode = 400
        res.end('Bad request')
        return
      }

      const requestUrl = new URL(req.url, 'http://localhost')
      const pathname = requestUrl.pathname === '/'
        ? 'index.html'
        : requestUrl.pathname.replace(/^\/+/, '')

      const targetPath = path.resolve(root, pathname)
      if (!targetPath.startsWith(root)) {
        res.statusCode = 403
        res.end('Forbidden')
        return
      }

      try {
        const content = await readFile(targetPath)
        const ext = path.extname(targetPath)
        const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
        res.setHeader('Content-Type', mime)
        res.end(content)
      } catch {
        res.statusCode = 404
        res.end('Not found')
      }
    })

    server.listen(0, () => {
      const address = server.address()
      if (!address || typeof address !== 'object') {
        reject(new Error('Failed to allocate port'))
        return
      }
      const baseUrl = `http://127.0.0.1:${address.port}`
      resolve({
        url: baseUrl,
        async close () {
          await new Promise((resolveClose) => server.close(() => resolveClose()))
        },
      })
    })

    server.on('error', reject)
  })
}

async function prepareBuild({ tamper = false } = {}, expected) {
  await rm(distDir, { recursive: true, force: true })
  await build({
    configFile: path.join(fixtureRoot, 'vite.config.ts'),
    logLevel: 'error',
  })

  if (tamper) {
    const targetScript = path.join(distDir, expected.script.src.replace(/^\//, ''))
    const original = await readFile(targetScript, 'utf8')
    await writeFile(targetScript, `${original}\n// tampered`)
  }

  const server = await startStaticServer(distDir)
  return server
}

test.describe('vite-plugin-sri3 integration', () => {
  let expected

  test.beforeAll(async () => {
    expected = await loadExpected()
  })

  test.afterEach(async () => {
    await rm(distDir, { recursive: true, force: true })
  })

  test('loads fixture with correct SRI hashes', async ({ page }) => {
    const { url, close } = await prepareBuild({ tamper: false }, expected)
    try {
      const consoleErrors = []
      const pageErrors = []

      const handleConsole = (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      }
      const handlePageError = (error) => {
        pageErrors.push(error.message ?? String(error))
      }

      page.on('console', handleConsole)
      page.on('pageerror', handlePageError)

      await page.goto(`${url}/`, { waitUntil: 'networkidle' })

      await expect(page.locator('#app')).toHaveText('SRI fixture')
      await expect(page.locator('text=Lazy chunk loaded')).toBeVisible()

      const script = page.locator('script[type="module"]')
      await expect(script).toHaveAttribute('src', expected.script.src)
      await expect(script).toHaveAttribute('integrity', expected.script.integrity)

      const style = page.locator('link[rel="stylesheet"]')
      await expect(style).toHaveAttribute('href', expected.style.href)
      await expect(style).toHaveAttribute('integrity', expected.style.integrity)

      expect(consoleErrors, 'no console errors triggered by SRI').toEqual([])
      expect(pageErrors, 'no page errors triggered by SRI').toEqual([])

      page.off('console', handleConsole)
      page.off('pageerror', handlePageError)
    } finally {
      await close()
    }
  })

  test('reports console error when integrity mismatch occurs', async ({ page }) => {
    const { url, close } = await prepareBuild({ tamper: true }, expected)
    try {
      const consoleErrors = []
      const pageErrors = []

      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleErrors.push(message.text())
        }
      })
      page.on('pageerror', (error) => {
        pageErrors.push(error.message ?? String(error))
      })

      await page.goto(`${url}/`, { waitUntil: 'networkidle' })

      expect(consoleErrors.some((msg) => msg.includes('Failed') && msg.includes('integrity')), 'console contains SRI failure').toBeTruthy()
      expect(
        consoleErrors.length > 0 || pageErrors.some((msg) => msg.includes('Failed') || msg.includes('integrity')),
        'at least console or page error records integrity failure',
      ).toBeTruthy()
    } finally {
      await close()
    }
  })
})
