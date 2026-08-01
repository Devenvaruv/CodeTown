# Routing Implementation Complete

This document describes the completed production routing model for dependency roads.

## Final Architecture

The routing system is street-first. Semantic dependencies do not own geometry. The production map builds a `RoutingPlan` from the visible graph layout, then renders canonical infrastructure edges once.

Authoritative infrastructure is owned by:

- `RoutingPlan.buildingPorts`: one `BuildingPort` per visible file.
- `RoutingPlan.folderGateways`: one `FolderGateway` per participating visible folder.
- `RoutingPlan.internalStreetGraphs`: folder-owned spine, collector, and spur edges.
- `RoutingPlan.parentChildConnectors`: reusable nested-folder connector edges.
- `RoutingPlan.externalCorridorEdges`: shared top-level corridor segments.
- `RoutingPlan.folderTrunks`: one ordered trunk aggregate per provider top-level folder to consumer top-level folder pair.

Semantic ownership remains:

- `ImportConnection`: importer/consumer in `sourceFileId`, imported provider in `targetFileId`.
- `ExactDependencyRoute`: one provider-to-consumer route per visible resolved non-self semantic dependency.

`LayoutRoad` is no longer the canonical dependency route model. It is a rendering-only projection of canonical infrastructure with the exact route IDs and connection IDs currently using that edge.

## Data Flow

1. `ImportConnection` is filtered to visible, resolved, non-self file dependencies.
2. Provider and consumer files are derived without reversing the semantic graph:
   - provider/exporter = `targetFileId`
   - consumer/importer = `sourceFileId`
3. The planner resolves visible folder ancestry for each endpoint.
4. It reuses existing building ports, folder gateways, internal street graph edges, parent-child connectors, external corridor edges, and folder trunks.
5. It creates one `ExactDependencyRoute` with ordered `RouteInfrastructureRef` entries.
6. The renderer groups exact routes by infrastructure reference and creates one rendered edge per canonical infrastructure edge.
7. Visibility state filters rendered edges; selection does not create geometry.

Visual direction is always provider to consumer. Legend wording is:

```text
A -> B means A provides code imported by B.
```

## Route Scopes

- Same file: skipped by default.
- Same visible folder: internal street graph only.
- Nested same-town routes: internal street graph plus parent-child connectors.
- Different top-level folders: provider internal hierarchy, one ordered `FolderTrunk`, consumer internal hierarchy.
- External packages and unresolved modules: excluded from town roads unless modeled elsewhere by product behavior.

## Visibility Modes

- Overview: renders external trunk corridor edges only.
- Folder selected: renders trunks connected to the selected folder subtree and local infrastructure for participating files.
- File selected: renders all canonical edges used by exact routes involving that file.
- Road selected: renders the canonical edges used by the selected road's exact routes.
- Show all dependencies: renders each canonical infrastructure edge once with all participating routes bundled.

## Rendering Layers

Production SVG ordering is:

1. world background
2. folder and nested-folder districts
3. canonical roads
4. file buildings
5. folder and file labels
6. file-state overlays
7. debug overlay, when enabled
8. agent activity

Roads now render beneath buildings and labels. Building-port markers are debug-only; the visible spur endpoint uses the authoritative port.

## Validation

`buildRoutingPlan()` validates before production rendering in development and tests. Exact-route invariants include:

- semantic visible dependency count equals exact dependency route count
- exact route IDs are unique
- every exact route starts at the provider file spur and ends at the consumer file spur
- every infrastructure reference points to existing canonical infrastructure
- same-folder and same-top-level routes do not use external trunks
- cross-top-level routes reference exactly the correct ordered trunk

Existing validation for single ports, single gateways, street graphs, parent-child connectors, trunks, orthogonality, and obstacle avoidance remains active.

Production roads are never generated from the legacy route-first helpers.

## Legacy Code

The old route-first helpers remain isolated for historical tests and are not called by `buildTownLayout()`:

- `buildFolderTrunkRoads`
- `buildLocalRoadsForBundle`
- `buildLocalRoadsForEndpoint`
- `buildEndpointStreetRoute`
- `mergeSpinePath`
- `mergeCollectorPath`
- `collectorXForColumn`
- `routeTrunkPath`
- direct `layoutGraph()` edge routing helpers

Production rendering consumes `RoutingPlan` plus rendering-only `LayoutRoad` projections.

## Tests Added

Tests now cover:

- one exact route per visible semantic dependency
- provider and consumer file assignment
- exact routes referencing canonical infrastructure
- endpoint spur order
- cross-top-level route trunk use
- shared infrastructure rendered once
- overview hiding internal roads
- selected file and folder visibility
- no direct legacy production roads
- collapsed overview trunk rendering

Latest verified counts:

- `npm test`: 79 tests, 0 skipped
- `test/layout.test.ts`: 60 tests

## Performance

The routing plan is rebuilt only when graph, layout, or filter structure changes. Visibility changes filter the already-built rendering projection. Canonical infrastructure edges are rendered once, so many exact routes can share the same SVG path.

Internal roads and spurs stay hidden in overview unless selection or "show all dependencies" reveals them.

## Debug Mode

Routing debug mode is enabled in development by opening the webview with:

```text
?layoutDebug
```

Debug mode shows building ports, folder gateways, internal street graphs, parent-child connectors, external corridor edges, trunk labels, and validation counters. Production labels avoid technical edge names.

## Known Limitations

- `LayoutRoad` still exists as a rendering DTO for compatibility with the current SVG renderer and tests.
- Legacy direct `layoutGraph()` edge routing still exists for non-town layout callers; `buildTownLayout()` does not pass semantic edges to it.
- Agent travel animation can use exact route references when session data identifies a dependency, but no route-specific movement event is currently emitted.
