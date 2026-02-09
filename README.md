# vite-plugin-sri3

[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) in [Vite](https://vitejs.dev/)

- Zero dependencies
- [Changelog](./CHANGELOG.md)

## Requirement
- Vite >= 2
- Nodejs >= 18

## Install
```bash
# npm
npm i -D vite-plugin-sri3
# yarn
yarn add -D vite-plugin-sri3
# pnpm
pnpm i -D vite-plugin-sri3
```

## Usage

```javascript
// vite.config.(js|ts|mjs|mts)
import { defineConfig } from 'vite'
import sri from 'vite-plugin-sri3'
// Alternatively, use the named export:
// import { sri } from 'vite-plugin-sri3'

export default defineConfig({
  plugins: [
    // Please place it at the end to avoid ordering issues that might result in not getting the final content
    // Unless you are using a package like vite-plugin-compression2, in which case it should be placed before it.
    sri(),
  ],
})
```

## Configuration

- `ignoreMissingAsset`
When using `@vitejs/plugin-legacy`, plugin can't not find some assets with legacy chunks.
When this options enabled, plugin will ignore any missing asset error.

Default: `false`
```javascript
sri({ ignoreMissingAsset: true })
```

## Q&A
- Why not `rollup-plugin-sri` or `@small-tech/vite-plugin-sri` ?
  - They can't work well in vite 4/5.

## Tests & Coverage
- Run `pnpm coverage` to execute the Vitest suite with instrumentation; inspect the generated `coverage/` reports locally or in CI artifacts.
- `pnpm test:e2e` invokes Playwright to validate healthy and tampered builds in Chromium, ensuring runtime SRI enforcement still triggers errors when hashes mismatch.
- Integration fixtures rebuild the sample Vite app and assert deterministic `sha384` hashes so plugin regressions surface before release.

## Thanks
- [`rollup-plugin-sri`](https://github.com/JonasKruckenberg/rollup-plugin-sri)
- [`@small-tech/vite-plugin-sri`](https://github.com/small-tech/vite-plugin-sri)
- [`vite-plugin-compression2`](https://github.com/nonzzz/vite-plugin-compression)

Without the following plugins, this plugin wouldn't exist.
