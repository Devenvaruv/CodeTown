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
  const sortedRoads = [...roads].sort((a, b) => a.id.localeCompare(b.id));
  if (options.showAllDependencies) {
    return sortedRoads;
  }

  const selection = options.selection;
  if (!selection) {
    return sortedRoads.filter((road) => road.routeKind === "trunk");
  }

  if (selection.kind === "file") {
    return sortedRoads.filter((road) => road.participantFileIds.includes(selection.id));
  }

  if (selection.kind === "folder") {
    const folderIds = graph ? descendantFolderIds(selection.id, graph) : new Set([selection.id]);
    return sortedRoads.filter((road) => road.routeKind === "trunk"
      ? folderIds.has(road.providerFolderId ?? "") || folderIds.has(road.consumerFolderId ?? "")
      : road.participantFileIds.some((fileId) => fileBelongsToAnyFolder(fileId, folderIds, graph)));
  }

  const selectedRoad = sortedRoads.find((road) => road.id === selection.id || road.trunkId === selection.id);
  if (!selectedRoad) {
    return [];
  }
  const selectedExactRouteIds = new Set(selectedRoad.exactRouteIds);
  return sortedRoads.filter((road) => road.exactRouteIds.some((routeId) => selectedExactRouteIds.has(routeId)));
}

function descendantFolderIds(folderId: string, graph: ProjectGraph): Set<string> {
  const ids = new Set<string>([folderId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const folder of graph.folders) {
      if (folder.parentFolderId && ids.has(folder.parentFolderId) && !ids.has(folder.id)) {
        ids.add(folder.id);
        changed = true;
      }
    }
  }
  return ids;
}

function fileBelongsToAnyFolder(fileId: string, folderIds: Set<string>, graph: ProjectGraph | undefined): boolean {
  if (!graph) {
    return false;
  }
  const folderById = new Map(graph.folders.map((folder) => [folder.id, folder]));
  let folderId: string | undefined = graph.files.find((file) => file.id === fileId)?.folderId;
  while (folderId) {
    if (folderIds.has(folderId)) {
      return true;
    }
    folderId = folderById.get(folderId)?.parentFolderId;
  }
  return false;
}
