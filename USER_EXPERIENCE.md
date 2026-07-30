# User Experience Specification

## Main interface

The interface has three regions:

1. Left sidebar: project tree and map controls
2. Center canvas: 2D codebase town
3. Right panel: selected item details

## Initial flow

1. User opens a JavaScript or TypeScript workspace.
2. User runs `Codebase Town: Open Map` from the Command Palette.
3. Extension analyzes the workspace.
4. A progress state appears with the current phase:
   - discovering source files
   - parsing imports and exports
   - resolving dependencies
   - building layout
5. The map opens at the project level.
6. Top-level folders appear as collapsed towns.
7. Aggregate roads show folder-to-folder dependency counts.

## Project-level view

Each top-level source folder appears as a rectangular district.

A collapsed town displays:

- folder name
- file count
- incoming dependency count
- outgoing dependency count
- circular dependency warning count

Roads between collapsed towns represent aggregated file dependencies.

Example:

```text
Auth ── 6 dependencies ──▶ Users
Auth ── 3 dependencies ──▶ Shared
```

## Folder expansion

Clicking a town expands it.

The town should reveal:

- direct files as buildings
- direct subfolders as neighborhoods
- local roads between visible buildings
- roads from visible buildings to collapsed towns

The system must not automatically expand every nested subfolder.

## Building behavior

Each building shows:

- file name
- optional file-type icon
- import count
- export count
- warning badge when relevant

Single click:

- selects the building
- highlights connected roads
- dims unrelated buildings and roads
- populates the details panel

Double click or explicit action:

- opens the file in VS Code

## Road behavior

A road starts at the importing file and points toward the imported file.

Road display rules:

- runtime import: solid line
- type-only import: dashed line
- dynamic import: dotted line
- re-export: double or distinct transfer style
- circular dependency: warning marker

Hovering a road displays:

- source file
- target file
- imported symbols
- import type
- original module specifier

Road labels should not all remain visible. Show labels on hover, selection, or focused tracing.

## Details panel

When a file is selected, show:

### Identity

- file name
- relative path
- language
- folder

### Imports

- target file
- imported symbols
- import type

### Exports

- symbol name
- symbol kind
- default or named export

### Used by

- importing file
- imported symbols

### Metrics

- import count
- dependent count
- export count
- line count when available

### Actions

- Open file
- Focus folder
- Trace imports
- Trace dependents
- Hide unrelated files
- Copy relative path

## Search

Search must support:

- file name
- relative file path
- folder name
- exported symbol name

When the user searches:

- matching buildings are highlighted
- matching towns are expanded only when necessary or with user confirmation through the result selection
- unrelated items are dimmed
- result list shows file path and match type

## Filters

Required filters:

- runtime imports
- type-only imports
- dynamic imports
- re-exports
- circular dependencies
- external packages
- test files

External package roads should be hidden by default.

## Trace mode

The user can trace:

- direct imports
- direct dependents
- transitive imports
- transitive dependents

Direct tracing is required for MVP. Transitive tracing may be included if it does not delay core completion.

## Empty and error states

Handle:

- no workspace open
- no JS/TS files found
- parser failure for one or more files
- unresolved import
- unsupported workspace structure
- webview load failure

A partial graph is preferable to a total failure when individual files cannot be parsed.
