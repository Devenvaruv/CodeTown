# Layout and Rendering Specification

## Core layout principle

The layout must be deterministic, hierarchical, and grid-based.

Do not use a force-directed layout as the default.

## Visual hierarchy

### Level 1: project

- top-level folders are towns
- collapsed folder roads are aggregated
- external packages appear outside the project boundary when enabled

### Level 2: expanded town

- direct files are buildings
- direct subfolders are neighborhoods
- local file roads are visible
- external roads terminate at neighboring towns or boundary anchors

### Level 3: focused file

- selected building remains fully visible
- immediate imports and dependents are highlighted
- unrelated entities are dimmed

## Town placement

Recommended strategy:

1. Calculate each town's required area from its visible contents.
2. Sort towns deterministically by normalized path or dependency weight.
3. Place towns in rows using a packing algorithm.
4. Leave consistent gutters for inter-town roads.
5. Preserve prior positions when IDs and visible state remain unchanged.

## Building placement

Within a town:

- use a grid or street rows
- keep buildings aligned
- reserve lanes between rows for roads
- place highly connected buildings near town edges or central avenues where it reduces routing length
- keep the same file in approximately the same position after refresh

## Neighborhood placement

Subfolders should be nested rectangular regions.

A collapsed neighborhood displays:

- folder name
- file count
- aggregate dependency counts

An expanded neighborhood displays direct children only.

## Road routing

Use orthogonal or mostly orthogonal paths.

Preferred route shape:

- leave source building from an edge port
- move horizontally or vertically into a road lane
- traverse the lane
- enter target building at a compatible port

Avoid roads passing through buildings.

## Ports

Each building may expose connection ports on four sides.

Port selection should consider relative target position.

- target right → source right, target left
- target below → source bottom, target top

Multiple roads may share a trunk before splitting when they have the same town-level destination.

## Aggregation

When towns are collapsed, combine file-level connections into a folder-level road.

Aggregated road metadata:

- source folder
- target folder
- total connection count
- unique source file count
- unique target file count
- imported symbol count

## Visual states

Required states:

- normal
- hovered
- selected
- connected
- dimmed
- warning/circular
- search match
- unresolved

## Building design

Buildings should suggest houses without sacrificing labels.

A practical building may be:

- rectangular body
- subtle roof or top edge
- file name label
- small metric badges
- optional semantic icon

Avoid detailed illustrations that reduce density.

## Zoom behavior

- zoomed out: show towns and folder-level roads
- medium zoom: show building names and visible local roads
- zoomed in: show metrics and road labels on demand

Semantic zoom is preferred over simply scaling every label.

## Accessibility

- support keyboard focus for selectable entities when practical
- do not rely on color alone
- include icons, dashes, arrows, or labels for road type and warnings
- maintain readable contrast in VS Code light and dark themes
