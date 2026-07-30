# Technical Architecture

## High-level components

```text
VS Code Extension Host
├── Workspace discovery
├── Project parser
├── Module resolver
├── Graph builder
├── Cache and watcher
├── Command registration
└── Webview message bridge

Webview Application
├── State store
├── Layout engine
├── Map renderer
├── Search and filters
├── Details panel
└── Interaction controller
```

## Extension host responsibilities

The extension host owns:

- VS Code APIs
- workspace access
- file discovery
- parsing
- import resolution
- graph construction
- file watchers
- opening files in the editor
- persistent workspace state

The webview must never directly access the filesystem.

## Webview responsibilities

The webview owns:

- rendering
- layout
- visual interaction
- local selection state
- pan and zoom
- search presentation
- filtering presentation

## Recommended project structure

```text
src/
├── extension/
│   ├── extension.ts
│   ├── commands.ts
│   ├── panel.ts
│   ├── messages.ts
│   └── workspaceState.ts
├── analysis/
│   ├── discoverFiles.ts
│   ├── parseProject.ts
│   ├── resolveImport.ts
│   ├── extractExports.ts
│   ├── graphBuilder.ts
│   ├── cycles.ts
│   └── cache.ts
├── shared/
│   ├── graphTypes.ts
│   ├── messageTypes.ts
│   └── constants.ts
└── webview/
    ├── App.tsx
    ├── state/
    ├── components/
    ├── layout/
    ├── renderer/
    └── styles/
```

## Processing pipeline

```text
Workspace folder
    ↓
File discovery
    ↓
AST parsing
    ↓
Import/export extraction
    ↓
Module resolution
    ↓
Graph construction
    ↓
Cycle detection and aggregation
    ↓
Serialized graph sent to webview
    ↓
Deterministic layout
    ↓
Rendering
```

## Parsing strategy

Preferred implementation: `ts-morph`.

Reasons:

- simpler AST traversal than raw compiler API
- TypeScript-aware source project
- symbol and export inspection
- module resolution support

Fallback: TypeScript compiler API if extension bundle size or performance becomes a material issue.

## Performance strategy

- exclude generated and dependency folders
- parse only supported source files
- perform initial analysis asynchronously
- use incremental refresh after file changes
- debounce watcher events
- cache file analysis by file path and content hash or modification time
- recompute only affected graph sections where practical
- avoid sending raw AST data to the webview

## Rendering choice

Use SVG for the first MVP unless profiling proves it insufficient.

SVG advantages:

- easy labels
- simple interaction
- accessible DOM nodes
- manageable for small and medium graphs

Move to Canvas or PixiJS only when graph size demands it.

## State boundaries

### Persistent extension state

- last selected workspace folder
- expanded town IDs
- optional saved layout positions
- filter preferences

### Webview state

- selected node or edge
- hover state
- viewport transform
- active search
- active trace mode

## Security

- use a strict Content Security Policy
- use nonce-based scripts
- sanitize all text displayed from source files
- do not execute project code
- do not inject source code as HTML
- validate all webview messages
