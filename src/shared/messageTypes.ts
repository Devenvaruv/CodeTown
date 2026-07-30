import type { ProjectGraph } from "./graphTypes";

export interface ViewPreferences {
  expandedFolderIds: string[];
  includeExternalPackages: boolean;
  showTypeOnlyImports: boolean;
}

export type ExtensionToWebviewMessage =
  | { type: "analysisStarted" }
  | { type: "analysisProgress"; phase: string; completed?: number; total?: number }
  | { type: "graphLoaded"; graph: ProjectGraph }
  | { type: "graphUpdated"; graph: ProjectGraph }
  | { type: "analysisFailed"; message: string }
  | { type: "fileFocused"; fileId: string };

export type WebviewToExtensionMessage =
  | { type: "ready" }
  | { type: "refreshRequested" }
  | { type: "openFile"; fileId: string; line?: number }
  | { type: "savePreferences"; preferences: ViewPreferences }
  | { type: "copyPath"; fileId: string };

export function isWebviewToExtensionMessage(value: unknown): value is WebviewToExtensionMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "ready":
    case "refreshRequested":
      return true;
    case "openFile":
      return typeof value.fileId === "string" && (value.line === undefined || typeof value.line === "number");
    case "copyPath":
      return typeof value.fileId === "string";
    case "savePreferences":
      return isViewPreferences(value.preferences);
    default:
      return false;
  }
}

export function isExtensionToWebviewMessage(value: unknown): value is ExtensionToWebviewMessage {
  if (!isRecord(value) || typeof value.type !== "string") {
    return false;
  }

  switch (value.type) {
    case "analysisStarted":
      return true;
    case "analysisProgress":
      return typeof value.phase === "string";
    case "graphLoaded":
    case "graphUpdated":
      return isRecord(value.graph);
    case "analysisFailed":
      return typeof value.message === "string";
    case "fileFocused":
      return typeof value.fileId === "string";
    default:
      return false;
  }
}

function isViewPreferences(value: unknown): value is ViewPreferences {
  return (
    isRecord(value) &&
    Array.isArray(value.expandedFolderIds) &&
    value.expandedFolderIds.every((item) => typeof item === "string") &&
    typeof value.includeExternalPackages === "boolean" &&
    typeof value.showTypeOnlyImports === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
