# Milestones and Tasks

## Milestone 1: Extension scaffold

### Task 1.1
Create a runnable VS Code extension with TypeScript.

Acceptance:

- extension activates
- command appears
- command opens a webview panel

### Task 1.2
Create React webview scaffolding with VS Code theme support.

Acceptance:

- webview renders without CSP errors
- extension and webview can exchange a `ready` message

## Milestone 2: Shared contracts

### Task 2.1
Implement graph types from `DATA_MODEL.md`.

### Task 2.2
Implement typed extension/webview message contracts.

### Task 2.3
Add runtime message validation.

## Milestone 3: Workspace discovery

### Task 3.1
Discover supported JS/TS files.

### Task 3.2
Apply default and configured exclusions.

### Task 3.3
Build normalized folder hierarchy.

Tests:

- nested folders
- Windows and POSIX path normalization
- excluded folders
- empty workspace

## Milestone 4: Parser

### Task 4.1
Initialize `ts-morph` project from workspace config.

### Task 4.2
Extract import declarations.

### Task 4.3
Extract exports and symbol kinds.

### Task 4.4
Resolve local modules and package imports.

### Task 4.5
Support re-exports, type-only imports, dynamic imports, and simple `require`.

### Task 4.6
Collect diagnostics without stopping the analysis.

## Milestone 5: Graph construction

### Task 5.1
Create deterministic folder and file IDs.

### Task 5.2
Create import connections.

### Task 5.3
Populate reverse dependencies.

### Task 5.4
Calculate file and folder metrics.

### Task 5.5
Detect circular dependencies.

## Milestone 6: Initial renderer

### Task 6.1
Render towns as rectangles.

### Task 6.2
Render files as building nodes.

### Task 6.3
Render directed roads.

### Task 6.4
Add pan and zoom.

### Task 6.5
Add light and dark theme support.

## Milestone 7: Deterministic layout

### Task 7.1
Implement top-level town packing.

### Task 7.2
Implement building grid layout inside towns.

### Task 7.3
Implement orthogonal road routing.

### Task 7.4
Implement folder-level edge aggregation.

### Task 7.5
Preserve stable positions after unchanged refresh.

## Milestone 8: Interaction

### Task 8.1
Select towns, buildings, and roads.

### Task 8.2
Highlight connected items and dim unrelated items.

### Task 8.3
Expand and collapse towns and neighborhoods.

### Task 8.4
Show road tooltip with imported symbols.

### Task 8.5
Open selected file in VS Code.

## Milestone 9: Details, search, and filters

### Task 9.1
Implement file details panel.

### Task 9.2
Implement file and symbol search.

### Task 9.3
Implement dependency-type filters.

### Task 9.4
Implement direct import and dependent tracing.

### Task 9.5
Display circular and unresolved diagnostics.

## Milestone 10: Refresh and caching

### Task 10.1
Add file watcher.

### Task 10.2
Debounce refresh events.

### Task 10.3
Cache analysis output.

### Task 10.4
Refresh map while preserving view state.

## Milestone 11: Product hardening

### Task 11.1
Add loading, empty, and failure states.

### Task 11.2
Add repository-size safeguards.

### Task 11.3
Add keyboard and accessibility improvements.

### Task 11.4
Write README setup and usage instructions.

### Task 11.5
Package and manually install the VSIX.
