# Codebase Town Visualizer

Codebase Town Visualizer is a VS Code extension that analyzes a JavaScript or TypeScript workspace and renders it as a deterministic 2D town map.

Folders are towns, files are buildings, and local imports or re-exports are directed roads. The map is built from the active workspace, not static sample data.

## Features

- Command Palette entry: `Codebase Town: Open Map`
- TypeScript/JavaScript file discovery with generated-folder exclusions
- AST-based import/export parsing through `ts-morph`
- Relative imports, path aliases from `tsconfig.json`/`jsconfig.json`, dynamic imports, simple `require`, type-only imports, and re-exports
- Folder/file graph with reverse dependencies, metrics, unresolved-import diagnostics, and circular dependency marking
- React webview with VS Code theme variables
- SVG town renderer with deterministic grid layout
- Expand/collapse folders, file selection, road selection, search, filters, zoom controls, details panel, and open-file action
- Debounced refresh watcher for supported source and config changes

## Development

Install dependencies:

```bash
npm install
```

Build the extension and webview:

```bash
npm run compile
```

Run tests:

```bash
npm test
```

Run type checking:

```bash
npm run typecheck
```

## Running In VS Code

1. Open this folder in VS Code.
2. Run `npm install`.
3. Run `npm run compile`.
4. Press `F5` from VS Code extension development, or use VS Code's extension host launch flow.
5. In the extension host window, open a JavaScript or TypeScript workspace.
6. Run `Codebase Town: Open Map` from the Command Palette.

## Settings

- `codebaseTown.exclude`: additional folders or path fragments to exclude
- `codebaseTown.includeExternalPackages`: show external package anchors
- `codebaseTown.maxFiles`: file-count safeguard, default `1500`
- `codebaseTown.autoRefresh`: debounce refresh on file changes
- `codebaseTown.showTypeOnlyImports`: preference persisted by the webview

## Notes

The MVP prioritizes readable structure over graph completeness. External packages are parsed and modeled but hidden by default. The first renderer uses SVG and deterministic grid placement; it does not use force-directed layout.

## Visual Assets

The generated PNGs live under:

```text
assets/
```

During `npm run compile`, Vite copies them to:

```text
dist/webview/codebase-town-assets/
```

The prompt referenced `green.png`, but the provided repeating grass background is `grass03.png`, so that is mapped as the world background. The renderer keeps SVG fallback towns, buildings, roads, labels, and warning badges visible when images are absent or fail to load. See [docs/ASSET_MANIFEST.md](docs/ASSET_MANIFEST.md) for the full mapping.
