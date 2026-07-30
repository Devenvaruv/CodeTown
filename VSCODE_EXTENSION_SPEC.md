# VS Code Extension Specification

## Commands

Register at minimum:

- `Codebase Town: Open Map`
- `Codebase Town: Refresh Map`
- `Codebase Town: Focus Current File`
- `Codebase Town: Clear Cache`

Optional:

- `Codebase Town: Analyze Selected Folder`

## Entry surface

The MVP may use either:

- a webview panel, or
- a custom view container with a webview view

A panel is acceptable for faster MVP development.

## Workspace behavior

- support single-root workspaces first
- handle multi-root workspaces by asking the user to choose a root or by treating roots as separate top-level worlds
- show a clear message when no folder is open

## Message protocol

Use discriminated unions.

### Extension to webview

```ts
type ExtensionToWebviewMessage =
  | { type: "analysisStarted" }
  | { type: "analysisProgress"; phase: string; completed?: number; total?: number }
  | { type: "graphLoaded"; graph: ProjectGraph }
  | { type: "graphUpdated"; graph: ProjectGraph }
  | { type: "analysisFailed"; message: string }
  | { type: "fileFocused"; fileId: string };
```

### Webview to extension

```ts
type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "refreshRequested" }
  | { type: "openFile"; fileId: string; line?: number }
  | { type: "savePreferences"; preferences: ViewPreferences }
  | { type: "copyPath"; fileId: string };
```

Validate incoming messages before acting.

## File watchers

Watch supported source files and relevant config files:

- JS/TS source files
- `tsconfig.json`
- `jsconfig.json`
- package metadata where resolution changes may matter

Debounce changes.

Refresh choices:

- parse changed file
- update affected connections
- re-run cycle detection
- send updated graph

A full graph rebuild is acceptable for the first working version if debounced and responsive on the target fixture.

## Opening files

Resolve file IDs only against known graph nodes. Do not accept arbitrary paths from the webview.

Use VS Code APIs to:

- open the document
- reveal the requested line
- focus the editor

## Configuration

Suggested settings:

```json
{
  "codebaseTown.exclude": [],
  "codebaseTown.includeExternalPackages": false,
  "codebaseTown.maxFiles": 1500,
  "codebaseTown.autoRefresh": true,
  "codebaseTown.showTypeOnlyImports": true
}
```

## Theme integration

Use VS Code CSS variables in the webview.

Examples:

- `--vscode-editor-background`
- `--vscode-editor-foreground`
- `--vscode-panel-border`
- `--vscode-focusBorder`
- `--vscode-errorForeground`

## Bundling

Use a bundler appropriate for VS Code extensions and webviews.

Ensure:

- extension host bundle excludes unnecessary browser code
- webview bundle does not import Node-only modules
- source maps are available in development
- production CSP remains strict
