# Internal Street Graph Status

Implemented scope: permanent internal street graphs for expanded folders that participate in cross-folder dependencies.

External dependency roads, folder-to-folder trunks, nested-folder gateway links, and exact dependency routes are now implemented. See `docs/ROUTING_IMPLEMENTATION_COMPLETE.md`.

## Data Structures

Authoritative source: `src/graph/layout/routingPlan.ts`.

`RoutingPlan` now owns three stable routing maps:

- `buildingPorts: Map<string, BuildingPort>`
- `folderGateways: Map<string, FolderGateway>`
- `internalStreetGraphs: Map<string, InternalStreetGraph>`

An `InternalStreetGraph` belongs to one folder and contains:

- the reused `gatewayId`
- exactly one primary spine edge ID
- collector edge IDs
- spur edge IDs
- `edges`
- `edgeById`
- `fileEntryEdgeByFileId`

Every `StreetEdge` is a single orthogonal segment with `from`, `to`, `kind`, `connectedEdgeIds`, and `connectedFileIds`.

## Spine Selection

Each graph starts at the folder's existing authoritative gateway from `RoutingPlan.folderGateways`.

Gateway side determines the spine orientation:

- `top` gateway: vertical spine inward
- `bottom` gateway: vertical spine inward
- `left` gateway: horizontal spine inward
- `right` gateway: horizontal spine inward

Street generation does not create another gateway. The graph stores the gateway ID and validation checks that the primary spine starts exactly at that gateway.

## Collector Generation

Collectors are generated after the primary spine and before dependency routes exist.

Files are grouped by layout lane:

- vertical spine: group files by spur row and build horizontal collectors
- horizontal spine: group files by spur column and build vertical collectors

Collectors are shared by nearby participating files. Each participating file is routed from the primary spine to its spur start through obstacle-aware collector segments, and overlapping segments are merged into shared `StreetEdge`s. When obstacles require it, a collector connection can be split into multiple orthogonal segments, but those segments are still part of the one folder-owned graph rather than per-dependency roads.

## File Assignment

Participating files are direct visible files in an expanded folder that appear in at least one cross-folder dependency as either:

- provider, from `ImportConnection.targetFileId`
- consumer, from `ImportConnection.sourceFileId`

Only participating files receive internal street spurs in this phase. Unused visible files still receive authoritative building ports, but no street spur.

## Building Ports

Each participating file receives one spur.

The spur endpoint is the exact `BuildingPort` already stored in `RoutingPlan.buildingPorts`. Street generation does not calculate a second file attachment point.

Building port side is selected from the authoritative folder gateway's spine type:

- left/right gateways use left/right building ports and horizontal spurs
- top/bottom gateways use top building ports and vertical spurs

A file used by multiple external folders still has:

- one building port
- one street spur
- one `fileEntryEdgeByFileId` entry

## Nested Folders

Nested folder rectangles are treated as obstacles in the parent graph. Parent streets are not allowed to pass through child-folder districts.

Files inside a nested expanded folder belong to that nested folder's own `InternalStreetGraph`; they are not flattened into the parent graph.

Parent-to-child gateway linking is not implemented yet. The next routing layer must connect:

```text
nested-folder gateway
-> parent-folder street graph
-> parent-folder gateway
```

without drawing direct paths through nested-folder bounds.

## Reserved Lanes

Routing uses explicit lane constants in `ROUTING_LANES`:

- `gatewayClearance`
- `spineClearance`
- `collectorClearance`
- `buildingSpurClearance`
- `obstaclePadding`
- `folderBoundaryClearance`
- `folderHeaderClearance`

The planner routes through candidate lanes derived from folder bounds, required endpoints, and obstacle padding. Current folder measurement already provides enough room for the tested layouts; if future graphs violate clearance, measurement should expand parent folder bounds instead of squeezing streets into incidental gaps.

## Validation

`buildRoutingPlan()` validates immediately and throws in development/tests when an invariant fails.

Current hard checks include:

- expanded folders needing streets equal internal street graph count
- each graph uses the authoritative folder gateway
- each graph has exactly one primary spine
- the primary spine starts at the authoritative gateway
- each participating file has exactly one spur
- no duplicate spur exists for a file
- each spur terminates at the authoritative `BuildingPort`
- no diagonal street edges exist
- no street edge exits its folder bounds
- no street intersects unrelated building bounds, including nonparticipating direct files
- no street intersects file-label rectangles
- no street intersects nested-folder rectangles

## Debug Rendering

Production dependency roads are now rendered from exact dependency routes over canonical infrastructure:

- `buildTownLayout()` returns rendering-only road edges
- `visibleRoadsForState()` applies overview, folder, file, road, and show-all visibility
- normal dependency road artwork renders below buildings and labels

Developer layout debug renders internal street graph data only:

- folder gateways
- building ports
- spine edges
- collector edges
- spur edges
- street kinds as labels

Spine, collector, and spur styles are intentionally distinct debug styling and are not final road artwork.

## Legacy Local Routing Status

The diagnosis route-first functions remain in `src/graph/layout/elkLayout.ts` for later deletion, but they are unreachable from the active production town-routing path:

- `buildLocalRoadsForBundle`
- `buildLocalRoadsForEndpoint`
- `buildEndpointStreetRoute`
- `mergeSpinePath`
- `mergeCollectorPath`
- `collectorXForColumn`

`buildFolderTrunkRoads()` is also isolated from `buildTownLayout()` during this phase.

## Test Results

Focused tests now cover:

- one folder with multiple participating files
- one file used by multiple external folders still receives one spur
- incoming and outgoing dependencies share the same street graph
- vertical spines create horizontal collectors
- horizontal spines create vertical collectors
- spur endpoints equal stored building ports
- no duplicate spurs
- no diagonal edges
- nested-folder rectangles are obstacles
- nonparticipating direct files are obstacles
- deterministic graph output for identical input
- legacy local-road generation is not active in production view

Latest local verification:

- `npm run typecheck`: passed
- `npm test -- --run test/layout.test.ts`: passed, 40 tests
- `npm test`: passed, 59 tests
- `npm run compile`: passed

## Remaining Work

The route implementation is complete. Remaining non-blocking work is to fully delete historical legacy helpers once no external tests or callers rely on them.
