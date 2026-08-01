import type { FileKind } from "../../shared/graphTypes";

export type BuildingAssetKind = "generic" | "component" | "service" | "controller" | "utility" | "test" | "repository" | "entry" | "index";

export type OverlayAssetKind =
  | "selected"
  | "edited"
  | "created"
  | "circularDependency"
  | "error"
  | "readPulse"
  | "editPulse";

export type DecorAssetKind =
  | "groundRockCluster"
  | "groundMossPatch"
  | "groundGrassPatchTall"
  | "groundGrassPatchSoft"
  | "groundDirtPatch"
  | "groundShadowBlob"
  | "natureFlowerPatch"
  | "natureFallenLog"
  | "natureBushCluster"
  | "natureTreeBroadleaf"
  | "natureTreePine"
  | "natureMushroomCluster";

export interface MapAssetDefinition {
  fileName?: string;
  requiredForMvp: boolean;
  description: string;
}

const ASSET_BASE_PATH = "codebase-town-assets";

declare global {
  interface Window {
    __CODEBASE_TOWN_ASSET_BASE_URI__?: string;
  }
}

export const MAP_SIZES = {
  buildingWidth: 82,
  buildingHeight: 82,
  overlayWidth: 96,
  overlayHeight: 96,
  agentWidth: 28,
  agentHeight: 28,
  folderSignWidth: 116,
  folderSignHeight: 58,
  roadThickness: 18
} as const;

export const mapAssets = {
  backgrounds: {
    world: asset("grass03.png", true, "Primary repeating world background"),
    base: asset("Base Ground Tile.png", false, "Alternate base ground tile"),
    folder: asset("Folder District Ground Tile.png", true, "Folder district ground texture"),
    subfolder: asset("Subfolder District Ground Tile.png", false, "Nested subfolder district ground texture")
  },
  buildings: {
    generic: asset("Generic File Building.png", true, "Generic source file building"),
    component: asset("React Component Building.png", false, "React or frontend component building"),
    service: asset("Service Building.png", false, "Backend service building"),
    controller: asset("Controller or Route Building.png", false, "Controller or route building"),
    utility: asset("Utility Building.png", false, "Utility or helper building"),
    test: asset("Test Building.png", false, "Test file building"),
    repository: asset("Database or Repository Building.png", false, "Database, repository, or persistence building"),
    entry: asset("Entry-Point Building.png", false, "Application entry-point building"),
    index: asset("Index or Barrel Building.png", false, "Index or barrel-export building")
  },
  folders: {
    corner: asset("folder_corner.png", true, "Fixed-size folder border corner"),
    side: asset("folder_side.png", true, "Stretchable folder border side rail"),
    support: asset("folder_support.png", true, "Fixed-size folder border support"),
    sign: asset("Blank Folder Sign.png", false, "Blank folder sign for dynamic labels")
  },
  roads: {
    horizontal: asset("Horizontal Road.png", false, "Horizontal dependency road tile")
  },
  decor: {
    groundRockCluster: asset("ground_rock_cluster.png", false, "Ground rock cluster decor"),
    groundMossPatch: asset("ground_moss_patch.png", false, "Ground moss patch decor"),
    groundGrassPatchTall: asset("ground_grass_patch_tall.png", false, "Tall grass patch decor"),
    groundGrassPatchSoft: asset("ground_grass_patch_soft.png", false, "Soft grass patch decor"),
    groundDirtPatch: asset("ground_dirt_patch.png", false, "Dirt patch ground variation"),
    groundShadowBlob: asset("ground_shadow_blob.png", false, "Soft shadow blob under larger decor"),
    natureFlowerPatch: asset("nature_flower_patch.png", false, "Flower patch nature decor"),
    natureFallenLog: asset("nature_fallen_log.png", false, "Fallen log nature decor"),
    natureBushCluster: asset("nature_bush_cluster.png", false, "Bush cluster nature decor"),
    natureTreeBroadleaf: asset("nature_tree_broadleaf.png", false, "Broadleaf tree nature decor"),
    natureTreePine: asset("nature_tree_pine.png", false, "Pine tree nature decor"),
    natureMushroomCluster: asset("nature_mushroom_cluster.png", false, "Mushroom cluster nature decor")
  },
  overlays: {
    selected: asset("Selected Building Overlay.png", false, "Selected-building overlay"),
    edited: asset("Recently Edited Overlay.png", false, "Recently edited overlay"),
    created: asset("Newly Created File Overlay.png", false, "Newly created file overlay"),
    circularDependency: asset("Circular Dependency Overlay.png", false, "Circular dependency warning overlay"),
    error: asset("Error Overlay.png", false, "Parse or unresolved-import error overlay"),
    readPulse: asset("File Read Pulse.png", false, "Brief file-read pulse"),
    editPulse: asset("File Edit Pulse.png", false, "Brief file-edit pulse")
  },
  agents: {
    primary: asset("AI Agent Marker.png", false, "AI coding agent marker")
  }
} as const;

export function assetUrl(definition: MapAssetDefinition | undefined): string | undefined {
  if (!definition?.fileName) {
    return undefined;
  }

  const baseUri =
    typeof window !== "undefined" && window.__CODEBASE_TOWN_ASSET_BASE_URI__
      ? window.__CODEBASE_TOWN_ASSET_BASE_URI__
      : ASSET_BASE_PATH;
  return `${baseUri.replace(/\/$/, "")}/${encodePathSegment(definition.fileName)}`;
}

export function buildingAssetForFileKind(kind: FileKind | undefined): MapAssetDefinition {
  switch (kind) {
    case "component":
      return mapAssets.buildings.component.fileName ? mapAssets.buildings.component : mapAssets.buildings.generic;
    case "service":
      return mapAssets.buildings.service.fileName ? mapAssets.buildings.service : mapAssets.buildings.generic;
    case "controller":
    case "route":
      return mapAssets.buildings.controller.fileName ? mapAssets.buildings.controller : mapAssets.buildings.generic;
    case "utility":
      return mapAssets.buildings.utility.fileName ? mapAssets.buildings.utility : mapAssets.buildings.generic;
    case "test":
      return mapAssets.buildings.test.fileName ? mapAssets.buildings.test : mapAssets.buildings.generic;
    case "repository":
      return mapAssets.buildings.repository.fileName ? mapAssets.buildings.repository : mapAssets.buildings.generic;
    case "entry":
      return mapAssets.buildings.entry.fileName ? mapAssets.buildings.entry : mapAssets.buildings.generic;
    case "index":
      return mapAssets.buildings.index.fileName ? mapAssets.buildings.index : mapAssets.buildings.generic;
    default:
      return mapAssets.buildings.generic;
  }
}

export function flattenAssetDefinitions(): MapAssetDefinition[] {
  return [
    ...Object.values(mapAssets.backgrounds),
    ...Object.values(mapAssets.buildings),
    ...Object.values(mapAssets.folders),
    ...Object.values(mapAssets.roads),
    ...Object.values(mapAssets.decor),
    ...Object.values(mapAssets.overlays),
    ...Object.values(mapAssets.agents)
  ];
}

function asset(fileName: string | undefined, requiredForMvp: boolean, description: string): MapAssetDefinition {
  return { fileName, requiredForMvp, description };
}

function encodePathSegment(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
