# External Trunk Status

Implemented scope: shared folder-to-folder trunk infrastructure between authoritative top-level folder gateways.

Exact file dependency routes and production road artwork are now implemented. See `docs/ROUTING_IMPLEMENTATION_COMPLETE.md`.

## New Data Structures

`src/graph/layout/routingPlan.ts` now extends `RoutingPlan` with:

- `externalCorridorEdges: Map<string, ExternalCorridorEdge>`
- `externalJunctions: Map<string, ExternalJunction>`
- `folderTrunks: Map<string, FolderTrunk>`

`ExternalCorridorEdge` is canonical shared geometry. It stores one orthogonal segment and the external junction IDs at its endpoints.

`ExternalJunction` records every external corridor endpoint and the corridor edges connected there.

`FolderTrunk` owns semantic aggregation for one ordered top-level folder pair. It stores provider/consumer folder IDs, authoritative gateway IDs, ordered corridor edge IDs, ordered path points, dependency IDs, provider and consumer file IDs, dependency count, symbol count, and dependency types.

## Ordered Folder Pair Grouping

Trunks are grouped by:

```text
providerTopLevelFolderId -> consumerTopLevelFolderId
```

Provider comes from `ImportConnection.targetFileId`; consumer comes from `ImportConnection.sourceFileId`.

Opposite directions remain separate trunks. Multiple file dependencies with the same ordered top-level pair aggregate into one `FolderTrunk`.

## Nested File Resolution

Files inside nested visible folders climb to their visible top-level folder before external trunk grouping.

Dependencies inside the same top-level folder create no external trunk. Those routes use internal street graphs and parent-child connectors only.

## Authoritative Gateways

Every trunk begins at the provider top-level folder gateway already stored in `RoutingPlan.folderGateways` and ends at the consumer top-level folder gateway from the same map.

The trunk planner does not calculate new gateways, attach to file ports, or connect directly to nested-folder gateways across the world.

## Corridor Routing

The planner builds deterministic orthogonal corridor candidates from:

- gateway access points outside folder boundaries
- horizontal and vertical lanes around top-level folder rectangles
- lanes between adjacent gaps in top-level folder rows and columns
- world-margin lanes around the visible folder set

Routes are selected with a stable cost model that prioritizes fewer bends, shorter paths, reuse of existing corridor segments, and deterministic tie-breaking.

The external corridor search is intentionally bounded to top-level folder districts. Nested folders, buildings, and file labels sit inside those top-level districts, so avoiding top-level folder interiors also avoids their contents without expanding the world routing grid by every visible file.

## Shared Segments And Junctions

Different trunks may reference the same `ExternalCorridorEdge`. Shared geometry is stored once and referenced by multiple `FolderTrunk.edgeIds`.

After all trunk paths are planned, the planner splits paths at shared points so merges and splits happen at canonical `ExternalJunction` records. Duplicate corridor edge geometry is rejected by validation.

## Legacy Trunk Routing

The legacy route-first trunk functions in `src/graph/layout/elkLayout.ts` remain inactive for the production town path:

- `buildFolderTrunkRoads`
- `routeTrunkPath`
- old per-bundle gateway assignment helpers

`buildTownLayout()` now returns production road edges derived from canonical `RoutingPlan` data.

## Validation

Routing-plan validation now throws in development and tests for:

- missing or duplicate folder trunks
- trunks using non-authoritative gateways
- trunks attached to nested folders
- diagonal trunk/corridor segments
- trunk/corridor intersections with folders, buildings, or labels
- duplicate external corridor geometry
- external junctions not matching corridor edge endpoints

Existing validation for building ports, folder gateways, internal street graphs, and parent-child connectors remains active.

## Tests Added

`test/layout.test.ts` now covers:

- one dependency creates one folder trunk
- ten dependencies between the same folder pair still create one trunk
- opposite directions create separate trunks
- nested provider and consumer files resolve to top-level folders
- same-top-level-folder dependencies create no external trunk
- trunks reuse authoritative gateways
- a folder connected to several folders still uses one gateway
- two trunks share a canonical corridor segment
- duplicate shared geometry is rejected
- no diagonal trunk edges
- no unrelated folder/building/label intersections
- deterministic external route output
- old production road rendering remains inactive

## Remaining Work

The external trunk layer is complete and is consumed by exact dependency routes. Remaining non-blocking work is to fully delete historical legacy helpers once no external tests or callers rely on them.
