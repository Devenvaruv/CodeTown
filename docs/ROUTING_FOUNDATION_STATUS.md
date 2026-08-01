# Routing Foundation Status

Implemented scope: Steps 2 through 4 from `docs/ROUTING_DIAGNOSIS.md`.

Final routing implementation status: complete. See `docs/ROUTING_IMPLEMENTATION_COMPLETE.md`.

Additional implemented scope: permanent internal street graph layer. See `docs/INTERNAL_STREET_GRAPH_STATUS.md` for the current street graph contract.

## New Types

- `src/graph/layout/routingPlan.ts`
  - `PortSide`
  - `BuildingPort`
  - `FolderGateway`
  - `StreetEdge`
  - `InternalStreetGraph`
  - `RoutingPlan`
  - `RoutingPlanValidation`

`TownLayout` now exposes:

- `routingPlan`
- `buildingPorts`
- `folderGateways`
- rendering-only `roads` derived from canonical routing infrastructure

## Building Ports

Authoritative source: `RoutingPlan.buildingPorts`.

Every visible file receives exactly one `BuildingPort`, keyed by file ID. The port is calculated once in `buildRoutingPlan()` and copied into `TownLayout.buildingPorts` for debug rendering and inspection.

The planner does not create fallback left-side ports. Unconnected files still receive deterministic ports using a stable file-ID based side choice.

## Folder Gateways

Authoritative source: `RoutingPlan.folderGateways`.

Every visible folder participating in at least one external dependency receives exactly one `FolderGateway`, keyed by folder ID. Gateway side selection considers all externally connected folders together, using the average connected-folder center and a fixed side priority for ties.

Incoming dependencies, outgoing dependencies, provider relationships, and consumer relationships all reuse the same folder gateway.

## Internal Street Graphs

Authoritative source: `RoutingPlan.internalStreetGraphs`.

Every expanded folder with an authoritative `FolderGateway` now receives one `InternalStreetGraph`, keyed by folder ID. The graph is built from the fixed gateway and fixed building ports:

- One `spine` edge starts at the folder gateway and runs inward.
- Shared `collector` edges are created from layout rows or columns.
- One `spur` edge is created for each participating direct visible file in that folder.
- Each spur terminates at the stored `RoutingPlan.buildingPorts` port for its file.

Participating files are files that appear in at least one cross-folder dependency as either provider or consumer. Collector paths are routed through orthogonal candidate lanes inside the folder, merge overlapping collector segments, and avoid visible building bounds, file-label bounds, nonparticipating direct files, and direct nested-folder bounds. The graph remains data-only except for developer debug rendering; exact dependency routes and normal road rendering are still disabled.

## Shared Building Bounds

Shared geometry source: `src/graph/layout/buildingGeometry.ts`.

`getVisibleBuildingBounds()` is used by:

- `buildRoutingPlan()` when placing building ports.
- `FileBuildingShape` when drawing the visible building rectangle.

The current visible building rectangle is:

- `x = layoutNode.x + 16`
- `y = layoutNode.y + 10`
- `width = layoutNode.width - 32`
- `height = 82`

## Production Roads

Production dependency roads are now restored through exact dependency routes and canonical infrastructure rendering.

- `buildTownLayout()` returns rendering-only road edges derived from `RoutingPlan`.
- `visibleRoadsForState()` hides internal roads in overview and reveals canonical edges for selection/show-all states.
- `RoadShape` renders roads beneath buildings and labels.
- Debug mode may show authoritative building-port markers, folder-gateway markers, and infrastructure edge IDs.

The following legacy functions remain present but are not called by `buildTownLayout()`:

- `buildFolderTrunkRoads`
- `buildLocalRoadsForBundle`
- `buildLocalRoadsForEndpoint`
- `buildFolderStreetPlans`
- `buildEndpointStreetRoute`
- `gatewaySideForRelativePosition`
- `gatewayForFolder`
- `gatewayPoint`
- `buildingPortForSide`

They remain isolated from `buildTownLayout()` and are not production routing paths.

## Remaining Attachment Helpers

Search audit for attachment-coordinate helpers:

- `buildingPortForSide`: remains only in legacy `buildFolderTrunkRoads` / `buildFolderStreetPlans`. That legacy path is isolated from `buildTownLayout()`.
- `gatewayPoint`: remains only in legacy folder/file road helpers.
- `gatewayForFolder`: remains only in legacy per-bundle road helpers.
- `gatewaySideForRelativePosition`: remains only in legacy per-bundle road helpers.
- `choosePort`, `portPoint`, `portOffset`: remain only in the legacy `layoutGraph()` direct edge router. `buildTownLayout()` passes no edges into `layoutGraph()`, so these helpers do not create town-map dependency attachment points.

No production town routing code invents additional file attachment points.

## Assertions

`buildRoutingPlan()` validates immediately after planning and throws in development/tests when a violation is detected:

- `visibleFileCount === buildingPortCount`
- `filesWithZeroPorts === 0`
- `filesWithMultiplePorts === 0`
- `foldersWithExternalDependenciesWithoutGateway === 0`
- `foldersWithMultipleGateways === 0`
- Every building port lies on exactly one side of the visible building bounds.
- Every folder gateway lies on exactly one side of the folder bounds.
- Every gateway folder has one internal street graph.
- Every internal street graph starts with a spine at the gateway.
- Every internal street graph has exactly one primary spine.
- Every participating direct file has exactly one street spur.
- No duplicate spur exists for a file.
- Every spur terminates at the stored building port.
- Internal street edges are orthogonal.
- Internal street edges stay inside their folder bounds.
- Internal street edges do not intersect visible building bounds, file-label bounds, or nested-folder bounds.

## Test Results

Last run:

- `npm run typecheck`: passed
- `npm test -- --run test/layout.test.ts`: passed, 40 tests
- `npm test`: passed, 59 tests
- `npm run compile`: passed

Invariant coverage added or updated:

- Every visible file gets exactly one port.
- Same input layout produces the same ports.
- Ports lie on the visible building rectangle.
- No route/helper creates a second production port while roads are disabled.
- Building artwork bounds and routing bounds use the same helper.
- A folder connected to three different folders still gets one gateway.
- Incoming and outgoing dependencies reuse the same gateway.
- Gateway selection is deterministic.
- Gateways lie on folder boundaries.
- Per-bundle gateways are not authoritative.
- One internal street graph exists for each gateway folder.
- Internal street graph spines start at the authoritative gateway.
- Internal collectors and spurs are created from fixed building ports.
- Incoming and outgoing dependencies share the same internal street graph.
- Files used by multiple external folders still receive one spur.
- Vertical spines create horizontal collectors.
- Horizontal spines create vertical collectors.
- Internal street graphs are deterministic for identical input.
- Internal street edges are orthogonal and avoid visible buildings, labels, nonparticipating direct files, and nested folders.
- Legacy local-road generation remains inactive in the production view.
- `sourceFileId` remains importer/consumer.
- `targetFileId` remains provider.
- Provider/consumer helper functions return the correct files.
