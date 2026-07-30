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
  const uniqueRoads = dedupeRoads(roads);

  const selectedFileId = options.selection?.kind === "file" ? options.selection.id : undefined;
  const focusedFolderId = options.selection?.kind === "folder" ? options.selection.id : undefined;
  const showFileRoads = Boolean(selectedFileId || options.showAllDependencies);

  return uniqueRoads.filter((road) => {
    if (road.level === "folder") {
      if (selectedFileId && graph) {
        const activeFolderId = folderIdForFile(selectedFileId, graph);
        return Boolean(activeFolderId) && (road.sourceId === activeFolderId || road.targetId === activeFolderId);
      }
      return !focusedFolderId || road.sourceId === focusedFolderId || road.targetId === focusedFolderId;
    }

    if (!showFileRoads) {
      return false;
    }
    return options.showAllDependencies || road.sourceId === selectedFileId || road.targetId === selectedFileId;
  });
}

function dedupeRoads(roads: LayoutRoad[]): LayoutRoad[] {
  const byPair = new Map<string, LayoutRoad>();
  for (const road of roads) {
    const key = `${road.level}:${road.sourceId}->${road.targetId}`;
    if (!byPair.has(key)) {
      byPair.set(key, road);
    }
  }
  return [...byPair.values()];
}

function folderIdForFile(fileId: string, graph: ProjectGraph): string | undefined {
  return graph.files.find((candidate) => candidate.id === fileId)?.folderId;
}
