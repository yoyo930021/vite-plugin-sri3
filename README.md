# vite-plugin-sri3

[Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) in [Vite](https://vitejs.dev/)

- Zero dependencies

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
import sri from 'vite-plugin-sri2'

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


## Thanks
- [`rollup-plugin-sri`](https://github.com/JonasKruckenberg/rollup-plugin-sri)
- [`@small-tech/vite-plugin-sri`](https://github.com/small-tech/vite-plugin-sri)
- [`vite-plugin-compression2`](https://github.com/nonzzz/vite-plugin-compression)

Without the following plugins, this plugin wouldn't exist.
