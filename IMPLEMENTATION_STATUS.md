# Implementation Status

## Current milestone

MVP implemented and validated with automated tests, type checking, and production build.

## Completed work

- Read all required specification files.
- Created a runnable TypeScript VS Code extension scaffold.
- Added command registrations for open, refresh, focus-current-file, and clear-cache.
- Added a CSP-protected React webview panel with VS Code theme integration.
- Implemented typed extension/webview message contracts and runtime validation.
- Implemented JS/TS workspace file discovery with default and configured exclusions.
- Implemented `ts-morph` parsing for imports, exports, type-only imports, re-exports, dynamic imports, and simple `require`.
- Implemented local module resolution using TypeScript project configuration where available.
- Implemented graph construction with deterministic IDs, folder hierarchy, reverse dependencies, file/folder metrics, external package nodes, diagnostics, and circular dependency detection.
- Implemented deterministic grid-based layout and orthogonal SVG roads.
- Implemented folder expansion/collapse, file and road selection, connected highlighting, search, filters, zoom controls, details panel, copy-path, and open-file actions.
- Added debounced file watcher refresh.
- Added fixture-based tests for discovery, parsing, graph behavior, layout, paths, and message validation.
- Updated README with setup and usage instructions.
- Fixed Reset view so it resets zoom, scroll position, selected item, and expanded folders back to the top-level view.
- Fixed internal roads hidden by folder backgrounds by rendering roads above town rectangles and below file buildings.
- Added typed visual asset registry, map size constants, image fallback behavior, optional world/road/folder/building/overlay rendering layers, and inactive agent activity infrastructure.
- Added `docs/ASSET_MANIFEST.md` with actual filenames, dimensions, transparency, roles, usage, and limitations for all 24 PNGs.
- Added Vite build copying from `assets/` to `dist/webview/codebase-town-assets/`.
- Fixed VS Code webview asset loading by injecting the `asWebviewUri` asset base into the webview and URL-encoding PNG filenames with spaces.
- Reduced overview road overdraw by aggregating duplicate visible source/target road anchors and lowering default road visual weight.
- Reworked the webview visual shell toward the provided target mock: full-canvas grass map, floating project HUD, legend, minimap, bottom command bar, right details HUD, larger asset-backed buildings, wooden folder signs, and road styling that reads more like streets.
- Made the project summary HUD and legend HUD closable with compact reopen buttons.
- Added arrow-key map panning. Arrow keys scroll the map, and Shift+Arrow pans by a larger step; text inputs keep normal cursor behavior.
- Expanded deterministic file classification for component, service, controller/route, utility, test, repository, entry, index, and generic file roles.
- Added tests for asset registry completeness, missing asset fallback, file-role classification, overlay precedence, agent read/edit state, and road geometry/direction.

## MVP requirement mapping

- Opens custom command/view: `src/extension/extension.ts`, `src/extension/panel.ts`
- Selects/analyzes workspace folder: `CodebaseTownPanel.selectWorkspaceFolder`, `parseProject`
- Parses imports, exports, hierarchy, reverse dependencies: `src/analysis/*`
- Displays folders/files/roads: `src/webview/App.tsx`, `src/webview/layout/deterministicLayout.ts`
- Expand/collapse folders: `expandedFolders` state in `App.tsx`
- File details: `DetailsPanel` in `App.tsx`
- Search and filtering: `findSearchMatches`, filter controls in `App.tsx`
- Opens source file: guarded `openFile` message handled in `panel.ts`
- Avoids extension-host freeze for medium repos: async analysis, max-file guard, debounced refresh; exact large-repo timing not yet measured

## Commands run

- `node --version` -> `v24.12.0`
- `npm --version` -> `11.6.2`
- `npm install` -> completed; npm audit reported 9 dependency advisories
- `npm run typecheck` -> passed
- `npm test` -> passed, 5 files and 10 tests
- `npm run compile:webview` -> passed
- `npm run compile:extension` -> passed
- `npm run compile` -> passed
- After reset/internal-road fixes: `npm test` -> passed, 5 files and 11 tests
- After reset/internal-road fixes: `npm run typecheck` -> passed
- After reset/internal-road fixes: `npm run compile` -> passed
- After asset integration with actual PNGs: `npm run typecheck` -> passed
- After asset integration with actual PNGs: `npm test` -> passed, 9 files and 22 tests
- After asset integration with actual PNGs: `npm run compile` -> passed
- Verified `dist/webview/codebase-town-assets/` contains all 24 PNGs after build.
- After webview asset URI and road-overdraw fixes: `npm run typecheck` -> passed
- After webview asset URI and road-overdraw fixes: `npm test` -> passed, 9 files and 22 tests
- After webview asset URI and road-overdraw fixes: `npm run compile` -> passed
- After target-mock UI pass: `npm run typecheck` -> passed
- After target-mock UI pass: `npm test` -> passed, 9 files and 22 tests
- After target-mock UI pass: `npm run compile` -> passed
- After collapsible HUD and arrow-key panning: `npm run typecheck` -> passed
- After collapsible HUD and arrow-key panning: `npm test` -> passed, 9 files and 22 tests
- After collapsible HUD and arrow-key panning: `npm run compile` -> passed

## Known limitations

- Manual VS Code extension-host scenarios from `TESTING_AND_ACCEPTANCE.md` still need a human pass in VS Code.
- Layout persistence is deterministic for unchanged graph/expansion state, but positions are not saved per workspace beyond expanded-folder preferences.
- External package roads are modeled but not rendered as full boundary anchors in the first SVG renderer.
- Large-repository performance has safeguards but no measured 500-file/2,000-edge benchmark yet.
- npm audit reports transitive dependency advisories; forced upgrades were not applied because they may change the build stack.
- The prompt referenced `green.png`, but the provided world background asset is named `grass03.png`; `grass03.png` is used as the repeating map background.

## Deviations

- The MVP uses full debounced graph rebuilds on watcher events instead of incremental per-file graph updates.
- The renderer uses simple orthogonal paths and folder anchors for collapsed content; advanced road-lane bundling is left for a later pass.
- AI-agent production activity is not invented. The state model and disabled demo flag exist, but no marker appears until real or explicitly enabled demo activity state exists.

## Next task

- Run the manual acceptance scenarios in a VS Code extension host against a real TypeScript project.
