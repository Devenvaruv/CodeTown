# Asset Manifest

## Inspection Result

The generated assets are present in the root `assets/` directory. They are copied during `npm run compile` into:

```text
dist/webview/codebase-town-assets/
```

The webview references them through the centralized registry in `src/webview/assets/mapAssets.ts`.

The prompt mentioned `green.png`, but the provided repeating grass background is named `grass03.png`. That file is used as the primary repeating world background.

## Manifest

| Filename | Intended semantic role | Dimensions | File format | Transparent background | Where it is used | Required for MVP | Notes or limitations |
|---|---|---:|---|---|---|---|---|
| `grass03.png` | Primary repeating world background | 512x512 | PNG | Yes | SVG `worldTexture` pattern | Yes | Used instead of unavailable `green.png`. Repeats in map coordinates so it scrolls and zooms with the map. |
| `Base Ground Tile.png` | Base ground or alternate map tile | 1254x1254 | PNG | No | Not currently rendered | No | Superseded by `grass03.png` for the outer world background. |
| `Folder District Ground Tile.png` | Folder district ground | 1254x1254 | PNG | No | `FolderShape` district image | Yes | Rendered behind folder content; fallback rectangle remains. |
| `Subfolder District Ground Tile.png` | Subfolder district ground | 1254x1254 | PNG | No | `FolderShape` for nested folders | No | Rendered for folders deeper than top-level. |
| `Generic File Building.png` | Generic source file building | 1024x1024 | PNG | Yes | `FileShape` fallback building | Yes | All specialized building roles fall back to this if their mapping is absent. |
| `React Component Building.png` | React/frontend component building | 1024x1024 | PNG | Yes | `FileShape` for `component` files | No | Chosen by deterministic file classifier. |
| `Service Building.png` | Backend service building | 1024x1024 | PNG | Yes | `FileShape` for `service` files | No | Chosen by deterministic file classifier. |
| `Controller or Route Building.png` | Controller or route building | 1024x1024 | PNG | Yes | `FileShape` for `controller` and `route` files | No | Shared for both controller and route kinds. |
| `Utility Building.png` | Utility or helper building | 1024x1024 | PNG | Yes | `FileShape` for `utility` files | No | Chosen by deterministic file classifier. |
| `Test Building.png` | Test file building | 1024x1024 | PNG | Yes | `FileShape` for `test` files | No | Chosen for spec/test paths and test folders. |
| `Database or Repository Building.png` | Database, repository, or persistence building | 1024x1024 | PNG | Yes | `FileShape` for `repository` files | No | Chosen for repository/model/schema/entity files and persistence folders. |
| `Entry-Point Building.png` | Application entry-point building | 1024x1024 | PNG | Yes | `FileShape` for `entry` files | No | Used for clear application roots such as `main.ts`, `server.ts`, `bootstrap.ts`. |
| `Index or Barrel Building.png` | Index or barrel-export building | 1024x1024 | PNG | Yes | `FileShape` for `index` files | No | Used for `index.*` and confident re-export barrels. |
| `Folder Boundary.png` | Folder district boundary | 1536x1024 | PNG | Yes | `FolderShape` boundary image | Yes | Stretched over folder bounds; fallback stroke remains. |
| `Blank Folder Sign.png` | Blank folder sign | 1024x1024 | PNG | Yes | `FolderShape` sign under dynamic label text | No | Folder names remain real SVG text. |
| `Selected Building Overlay.png` | Selected-building overlay | 1536x1024 | PNG | Yes | `FileShape` selected overlay | No | Composited above building; CSS selected stroke also remains. |
| `Recently Edited Overlay.png` | Recently edited overlay | 1024x1024 | PNG | Yes | `FileShape` edited overlay | No | Activated only by agent/edit state or future activity data. |
| `Newly Created File Overlay.png` | Newly created file overlay | 1024x1024 | PNG | Yes | `FileShape` created overlay | No | Activated on graph update for files absent from previous graph, not on first load. |
| `Circular Dependency Overlay.png` | Circular dependency overlay | 1024x1024 | PNG | Yes | `FileShape` circular overlay | No | Activated only from confirmed cycle metrics. |
| `Error Overlay.png` | Error overlay | 1024x1024 | PNG | Yes | `FileShape` diagnostic overlay | No | Details panel explains diagnostics. |
| `File Read Pulse.png` | File-read pulse | 1024x1024 | PNG | Yes | `FileShape` read pulse overlay | No | Requires agent/session read activity; not shown permanently. |
| `File Edit Pulse.png` | File-edit pulse | 1024x1024 | PNG | Yes | `FileShape` edit pulse overlay | No | Requires agent/session edit activity; not shown permanently. |
| `AI Agent Marker.png` | AI coding agent marker | 1024x1024 | PNG | Yes | `AgentMarker` | No | Production demo flag is disabled; marker appears only when activity state exists. |
| `Horizontal Road.png` | Horizontal dependency road tile | 1536x1024 | PNG | Yes | Horizontal road segment texture overlay | No | Used only for horizontal segment texture; programmatic SVG road and arrow remain authoritative. |

## Integration Decisions

- Image paths are centralized in `src/webview/assets/mapAssets.ts`.
- The renderer never depends on image success for visibility; SVG fallback towns, buildings, roads, labels, and badges remain.
- Folder and building images use `pointer-events: none` so they do not block folder, file, or road interaction.
- `grass03.png` repeats as an SVG pattern inside the map coordinate system so it moves with map scroll and zoom.
- The horizontal road PNG is used only as a restrained horizontal texture layer. Programmatic SVG paths and arrow markers preserve dependency direction.
- Folder and file labels remain real text and are not baked into images.
- Overlay order is deterministic: created, edited, circular dependency, error, read pulse, edit pulse, selected.
- AI-agent demo behavior is behind `ENABLE_AGENT_ACTIVITY_DEMO` and is disabled by default.

## Visual Reference

A generated contact sheet is available at:

```text
docs/asset-contact-sheet.png
```
