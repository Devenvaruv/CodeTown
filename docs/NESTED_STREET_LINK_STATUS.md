# Nested Street Link Status

Implemented scope: improved interior spine selection and reusable parent-child folder connectors.

Production dependency roads and folder-to-folder external trunks are now implemented. See `docs/ROUTING_IMPLEMENTATION_COMPLETE.md`.

## New Connector Structures

`src/graph/layout/routingPlan.ts` now extends `RoutingPlan` with:

- `streetJunctions: Map<string, StreetJunction>`
- `parentChildConnectors: Map<string, ParentChildConnector>`

`StreetJunction` records canonical parent graph attachment points. Junctions are derived from internal street graph edge endpoints and store the street edge IDs connected at that point.

`ParentChildConnector` is folder infrastructure, not dependency infrastructure. It stores the parent folder, child folder, authoritative child gateway, canonical parent junction, and reusable orthogonal connector edge IDs.

## Parent Junctions

Parent junctions are created after internal street graphs are built. Every spine, collector, and spur endpoint becomes a deterministic `StreetJunction`.

Parent-child connectors attach only to one of these recorded junctions. The planner prefers non-gateway parent junctions and scores candidates by route length, bend count, attachment kind, and deterministic coordinates.

## Recursive Nesting

Visible ancestor folders of externally routed nested folders now receive authoritative gateways and internal street graphs. Connectors are created only between an applicable nested folder and its immediate visible parent.

For a deep path such as:

```text
src/
  feature/
    tests/
      integration/
        file.ts
```

the planner creates:

```text
integration -> tests
tests -> feature
feature -> src
```

It does not flatten descendants directly into the top-level graph.

## Spine Candidate Scoring

The old active street graph behavior used a fixed clearance point just inside the gateway. That kept the graph valid but often left collector routing to do the real work from a boundary-adjacent start.

The new logic evaluates multiple deterministic spine endpoints in the interior corridor:

- folder center
- fixed inward fallback
- participating spur lanes
- participating spur average and extrema

Candidates are rejected if the spine segment crosses buildings, labels, or child folders. Remaining candidates are scored by collector path length, bend count, distance from gateway, distance from folder boundary, and balance across participating files.

## Validation

Routing-plan validation now throws in development and tests for connector failures:

- missing or duplicate parent-child connector
- connector not starting at the authoritative child gateway
- connector not ending at a canonical parent junction
- connector bypassing the parent street graph
- diagonal connector segments
- connector leaving the parent folder
- connector intersecting buildings, labels, sibling child folders, or the child folder boundary

Existing street graph validation remains active for one primary spine, spur uniqueness, orthogonality, folder containment, and obstacle avoidance.

## Tests Added

`test/layout.test.ts` now covers:

- bottom-gateway interior vertical spine
- right-gateway interior horizontal spine
- deterministic spine candidate selection that minimizes collector length
- one nested folder connector to the parent graph
- multiple child files and dependencies reusing one connector
- separate connectors for sibling folders
- recursive three-level nesting
- child gateway start and canonical parent junction end
- no diagonal connector segments
- connector obstacle validation
- no duplicate parent-child connector
- legacy production road rendering remains inactive

## Remaining Work

The nested connector layer is complete and is used by exact dependency routes. Remaining non-blocking work is to fully delete historical legacy helpers once no external tests or callers rely on them.
