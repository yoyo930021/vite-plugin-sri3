import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, HookHandler } from 'vite'

const VITE_INTERNAL_ANALYSIS_PLUGIN = 'vite:build-import-analysis'
const EXTERNAL_SCRIPT_RE = /<script[^<>]*['"]*src['"]*=['"]*([^ '"]+)['"]*[^<>]*><\/script>/g
const EXTERNAL_CSS_RE = /<link[^<>]*['"]*rel['"]*=['"]*stylesheet['"]*[^<>]+['"]*href['"]*=['"]([^^ '"]+)['"][^<>]*>/g
const EXTERNAL_MODULE_RE = /<link[^<>]*['"]*rel['"]*=['"]*modulepreload['"]*[^<>]+['"]*href['"]*=['"]([^^ '"]+)['"][^<>]*>/g;

export type GenerateBundle = HookHandler<Plugin['generateBundle']>

function hijackGenerateBundle (plugin: Plugin, afterHook: GenerateBundle) {
  const hook = plugin.generateBundle
  if (typeof hook === 'object' && hook.handler) {
    const fn = hook.handler
        hook.handler = async function (this, ...args: any) {
        await fn.apply(this, args)
        await afterHook?.apply(this, args)
    }
  }
  if (typeof hook === 'function') {
        plugin.generateBundle = async function (this, ...args: any) {
        await hook.apply(this, args)
        await afterHook?.apply(this, args)
    }
  }
}

export function sri (options?: { ignoreMissingAsset: boolean }): Plugin {
  const { ignoreMissingAsset = false } = options || {}

  return {
    name: 'vite-plugin-sri3',
    enforce: 'post',
    apply: 'build',
    configResolved (config) {
      const generateBundle: Plugin['generateBundle'] = async function (_, bundle) {
        const isRemoteUrl = (url: string) => /^https?:\/\//i.test(url)

        const normalizeBaseUrl = (url: string) => {
          if (config.base === './' || config.base === '') return url
          return url.replace(config.base, '')
        }

        const getBundleKey = (_htmlPath: string, url: string) => {
          if (config.base === './' || config.base === '') {
            return url.replace(/^[./]+/, '')
          }
          return normalizeBaseUrl(url)
        }

        const readPublicAsset = async (url: string) => {
          const publicDir = (config as { publicDir: string | false }).publicDir
          if (!publicDir) return null

          const publicUrl = normalizeBaseUrl(url)
          const relativePath = publicUrl.startsWith('/') ? publicUrl.slice(1) : publicUrl
          if (!relativePath) return null

          try {
            const filePath = path.resolve(publicDir, relativePath)
            return await readFile(filePath)
          } catch {
            return null
          }
        }

        const calculateIntegrity = async (source: string | Uint8Array): Promise<string> => {
          return `sha384-${createHash('sha384').update(source).digest().toString('base64')}`
        }

        const getAssetSource = async (htmlPath: string, url: string): Promise<string | Uint8Array | null> => {
          if (isRemoteUrl(url)) {
            return new Uint8Array(await (await fetch(url)).arrayBuffer())
          }

          const bundleItem = bundle[getBundleKey(htmlPath, url)]
          if (bundleItem) {
            return bundleItem.type === 'chunk' ? bundleItem.code : bundleItem.source
          }

          const publicAsset = await readPublicAsset(url)
          if (!publicAsset) {
            if (ignoreMissingAsset) return null
            throw new Error(`Asset ${url} not found in bundle`)
          }
          return publicAsset
        }

        const transformHTML = async function (regex: RegExp, endOffset: number, htmlPath: string, html: string) {
          let match: RegExpExecArray | null
          const changes = []
          let offset = 0
          while ((match = regex.exec(html))) {
            const [, url] = match
            const end = regex.lastIndex

            const source = await getAssetSource(htmlPath, url)
            if (!source) continue
            const integrity = await calculateIntegrity(source)

            const insertPos = end - endOffset
            changes.push({ integrity, insertPos })
          }
          for (const change of changes) {
            const insertText = ` integrity="${change.integrity}"`
            html = html.slice(0, change.insertPos + offset) + insertText + html.slice(change.insertPos + offset)
            offset += insertText.length
          }
          return html
        }

        for (const name in bundle) {
          const chunk = bundle[name]

          if (
            chunk.type === 'asset' &&
            (chunk.fileName.endsWith('.html') || chunk.fileName.endsWith('.htm'))
          ) {
            let html = chunk.source.toString()

            html = await transformHTML(EXTERNAL_SCRIPT_RE, 10, name, html)
            html = await transformHTML(EXTERNAL_CSS_RE, 1, name, html)
            html = await transformHTML(EXTERNAL_MODULE_RE, 1, name, html)

            chunk.source = html
          }
        }
      }

      const plugin = config.plugins.find(p => p.name === VITE_INTERNAL_ANALYSIS_PLUGIN)
      if (!plugin) throw new Error('vite-plugin-sri3 can\'t be work in versions lower than vite2.0.0')

      hijackGenerateBundle(plugin, generateBundle)
    }
  }
}
