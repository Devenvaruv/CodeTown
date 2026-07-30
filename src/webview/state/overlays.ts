import type { FileNode } from "../../shared/graphTypes";
import type { OverlayAssetKind } from "../assets/mapAssets";

export interface FileOverlayInput {
  file: FileNode;
  isSelected: boolean;
  isFocusedSearchResult: boolean;
  isRecentlyEdited: boolean;
  isNewlyCreated: boolean;
  isReadActive: boolean;
  isEditActive: boolean;
}

export const OVERLAY_RENDER_ORDER: OverlayAssetKind[] = [
  "created",
  "edited",
  "circularDependency",
  "error",
  "readPulse",
  "editPulse",
  "selected"
];

export function fileOverlayStates(input: FileOverlayInput): OverlayAssetKind[] {
  const overlays = new Set<OverlayAssetKind>();

  if (input.isNewlyCreated) {
    overlays.add("created");
  }
  if (input.isRecentlyEdited) {
    overlays.add("edited");
  }
  if (input.file.metrics.cycleCount > 0) {
    overlays.add("circularDependency");
  }
  if (input.file.diagnostics.length > 0) {
    overlays.add("error");
  }
  if (input.isReadActive) {
    overlays.add("readPulse");
  }
  if (input.isEditActive) {
    overlays.add("editPulse");
  }
  if (input.isSelected || input.isFocusedSearchResult) {
    overlays.add("selected");
  }

  return OVERLAY_RENDER_ORDER.filter((kind) => overlays.has(kind));
}
