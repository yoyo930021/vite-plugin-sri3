# Repository Guidelines

## Project Structure & Module Organization
The source lives in `src/index.ts`, which exports the Vite plugin and should stay focused on build-time HTML transforms and hashing logic. Generated bundles land in `dist/`; never edit these files directly—run the build instead. Project-level configuration is rooted in `tsconfig.json`, while the `pnpm-lock.yaml` and `package.json` capture dependency and script definitions. Keep any new fixtures or reproduction samples inside a dedicated `examples/` or `tests/fixtures/` directory to avoid polluting the published package.

## Build, Test, and Development Commands
- `pnpm install` (or `npm install`) ensures TypeScript and Vite peer dependencies are available.
- `pnpm build` (equivalent to `npm run build`) transpiles TypeScript and refreshes `dist/`.
- `pnpm pack` creates a tarball you can link into a sample Vite app to verify SRI tags locally.
Always run the build before opening a pull request so reviewers can diff check the generated output.

## Coding Style & Naming Conventions
Write TypeScript with ES module syntax, prefer `const`, and use two-space indentation to match `src/index.ts`. Avoid semicolons and keep imports sorted by platform (`node:` built-ins first, then packages). New helper functions should use descriptive camelCase names (for example, `collectExternalAssets`) and keep plugin-visible exports lowercase to mirror existing API shape. Do not introduce new runtime dependencies unless absolutely necessary; lean on Node and Vite utilities.

## Testing Guidelines
There is no automated test suite yet, so cover changes with targeted reproduction fixtures. Add minimal example projects under `tests/fixtures/<scenario>` that exercise the SRI output, and document the commands you used in the pull request. Before publishing, run `pnpm build` and integrate the tarball into a fresh Vite app (`pnpm add ../vite-plugin-sri3-<version>.tgz`) to confirm integrity attributes appear on script, stylesheet, and modulepreload tags.

## Commit & Pull Request Guidelines
Follow the conventional commit style observed in history (`fix:`, `build:`, `chore:`) so releases stay automatable. Each pull request should explain the scenario, list verification steps, and mention any follow-up tasks. Include before/after HTML snippets or screenshots when the change affects generated markup, and link related issues for traceability.

## Security & Integration Tips
Remember this plugin mutates production HTML; always place it last in the Vite plugin array unless a compression plugin forces otherwise. When fetching remote assets for hashing, confirm the URLs are deterministic and document any caching assumptions. If you discover an integrity vulnerability, avoid public issues—email the maintainer instead and coordinate a patched release.
