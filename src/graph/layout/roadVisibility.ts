import type { ProjectGraph } from "../../shared/graphTypes";
import type { LayoutRoad } from "./elkLayout";

export type RoadSelection =
  | { kind: "file"; id: string }
  | { kind: "folder"; id: string }
  | { kind: "road"; id: string };

export interface RoadVisibilityOptions {
  selection?: RoadSelection;
  showAllDependencies?: boolean;
}

export function visibleRoadsForState(roads: LayoutRoad[], graph: ProjectGraph | undefined, options: RoadVisibilityOptions): LayoutRoad[] {
  const uniqueRoads = dedupeRoads(roads.filter((road) => road.routeKind === "trunk" && road.level === "folder"));

  const focusedFolderId = options.selection?.kind === "folder" ? options.selection.id : undefined;
  const selectedRoad = options.selection?.kind === "road" ? uniqueRoads.find((road) => road.id === options.selection?.id) : undefined;
  const selectedTrunkId = selectedRoad?.trunkId ?? selectedRoad?.id;

  void graph;

  if (options.showAllDependencies) {
    return uniqueRoads;
  }

  return uniqueRoads.filter((road) => {
    if (selectedTrunkId) {
      return road.id === selectedTrunkId;
    }
    if (focusedFolderId) {
      return road.providerFolderId === focusedFolderId || road.consumerFolderId === focusedFolderId;
    }
    return true;
  });
}

function dedupeRoads(roads: LayoutRoad[]): LayoutRoad[] {
  const byPair = new Map<string, LayoutRoad>();
  for (const road of roads) {
    const key = `${road.providerFolderId ?? road.sourceId}->${road.consumerFolderId ?? road.targetId}:${road.routeKind}`;
    if (!byPair.has(key)) {
      byPair.set(key, road);
    }
  }
  return [...byPair.values()];
}
