import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, HookHandler } from 'vite'

const VITE_INTERNAL_ANALYSIS_PLUGIN = 'vite:build-import-analysis'
const EXTERNAL_SCRIPT_RE = /<script[^<>]*['"]*src['"]*=['"]*([^ '"]+)['"]*[^<>]*><\/script>/g
const EXTERNAL_CSS_RE = /<link[^<>]*['"]*rel['"]*=['"]*stylesheet['"]*[^<>]+['"]*href['"]*=['"]([^^ '"]+)['"][^<>]*>/g
const EXTERNAL_MODULE_RE = /<link[^<>]*['"]*rel['"]*=['"]*modulepreload['"]*[^<>]+['"]*href['"]*=['"]([^^ '"]+)['"][^<>]*>/g
const SKIP_SRI_TAG_RE = /\sskip-sri(\s|=|>|\/)/i
const SKIP_SRI_ATTR_STRIP_RE = /\s+skip-sri(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>\/]+))?\s*/gi

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
        const isRemoteUrl = (url: string) => {
          if (url.startsWith('//')) return `https:${url}`
          if (/^https?:\/\//i.test(url)) return url
          return false
        }

        // Remove base from URL to match bundle keys
        const normalizeBaseUrl = (url: string) => {
          if (config.base === './' || config.base === '') return url
          const base = config.base.endsWith('/') ? config.base : `${config.base}/`
          return url.startsWith(base) ? url.slice(base.length) : url
        }

        const getBundleKey = (htmlPath: string, url: string) => {
          if (config.base === './' || config.base === '') {
            return path.posix.normalize(path.posix.join(path.posix.dirname(htmlPath), url))
          }
          return normalizeBaseUrl(url)
        }

        const readPublicAsset = async (htmlPath: string, url: string) => {
          const publicDir = (config as { publicDir: string | false }).publicDir
          if (!publicDir) return null

          let publicUrl = normalizeBaseUrl(url)

          // Remove query string and fragment for filesystem lookup
          publicUrl = publicUrl.split(/[?#]/)[0]

          if (config.base === './' || config.base === '') {
            publicUrl = path.posix.normalize(path.posix.join(path.posix.dirname(htmlPath), publicUrl))
          }

          // decode URL-encoded parts
          let decoded: string
          try { decoded = decodeURIComponent(publicUrl) } catch { decoded = publicUrl }

          // Resolve against publicDir and prevent path traversal
          const filePath = path.resolve(publicDir, decoded)
          const rel = path.relative(publicDir, filePath)
          if (rel.startsWith('..') || path.isAbsolute(rel)) return null

          try {
            return await readFile(filePath)
          } catch {
            return null
          }
        }

        const calculateIntegrity = async (source: string | Uint8Array): Promise<string> => {
          return `sha384-${createHash('sha384').update(source).digest().toString('base64')}`
        }

        const stripSkipSriAttributesInTags = (value: string) => {
          const stripInTag = (tag: string) => tag.replace(SKIP_SRI_ATTR_STRIP_RE, (match, offset) => {
            const nextChar = tag[offset + match.length] ?? ''
            if (nextChar === '>' || nextChar === '/' || nextChar === '') return ''
            return ' '
          })
          // Only strip skip-sri attributes in <script> and <link> tags
          value = value.replace(/<script\b[^>]*>/gi, stripInTag)
          value = value.replace(/<link\b[^>]*>/gi, stripInTag)
          return value
        }

        const getAssetSource = async (htmlPath: string, url: string): Promise<string | Uint8Array | null> => {
          const remoteUrl = isRemoteUrl(url)
          if (remoteUrl) {
            return new Uint8Array(await (await fetch(remoteUrl)).arrayBuffer())
          }
          const bundleItem = bundle[getBundleKey(htmlPath, url)]
          if (bundleItem) {
            return bundleItem.type === 'chunk' ? bundleItem.code : bundleItem.source
          }

          const publicAsset = await readPublicAsset(htmlPath, url)
          if (!publicAsset) {
            if (ignoreMissingAsset) return null
            throw new Error(`Asset ${url} not found in bundle/public directory.`)
          }
          return publicAsset
        }

        const transformHTML = async function (regex: RegExp, endOffset: number, htmlPath: string, html: string) {
          let match: RegExpExecArray | null
          const changes = []
          let offset = 0
          while ((match = regex.exec(html))) {
            const [rawMatch, url] = match
            const end = regex.lastIndex

            if (SKIP_SRI_TAG_RE.test(rawMatch)) continue

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

            chunk.source = stripSkipSriAttributesInTags(html)
          }
        }
      }

      const plugin = config.plugins.find(p => p.name === VITE_INTERNAL_ANALYSIS_PLUGIN)
      if (!plugin) throw new Error('vite-plugin-sri3 can\'t be work in versions lower than vite2.0.0')

      hijackGenerateBundle(plugin, generateBundle)
    }
  }
}
