import { describe, expect, it } from "vitest";
import type { FileNode } from "../src/shared/graphTypes";
import { applyAgentActivityEvent } from "../src/webview/state/agentActivity";
import { fileOverlayStates } from "../src/webview/state/overlays";

describe("file overlay states", () => {
  it("keeps structural overlays and renders selected last", () => {
    const file = createFile({ cycleCount: 1, diagnostics: ["unresolved import"] });
    expect(
      fileOverlayStates({
        file,
        isSelected: true,
        isFocusedSearchResult: false,
        isRecentlyEdited: true,
        isNewlyCreated: true,
        isReadActive: true,
        isEditActive: false
      })
    ).toEqual(["created", "edited", "circularDependency", "error", "readPulse", "selected"]);
  });

  it("does not mark normal search matches as selected overlays", () => {
    const file = createFile({});
    expect(
      fileOverlayStates({
        file,
        isSelected: false,
        isFocusedSearchResult: false,
        isRecentlyEdited: false,
        isNewlyCreated: false,
        isReadActive: false,
        isEditActive: false
      })
    ).toEqual([]);
  });
});

describe("agent activity state", () => {
  it("moves the active agent to read and edit files deterministically", () => {
    const read = applyAgentActivityEvent(undefined, {
      agentId: "agent-1",
      agentName: "Codex",
      fileId: "src/a.ts",
      type: "read",
      occurredAt: 1
    });
    const edit = applyAgentActivityEvent(read, {
      agentId: "agent-1",
      agentName: "Codex",
      fileId: "src/b.ts",
      type: "edit",
      occurredAt: 2
    });

    expect(read.fileId).toBe("src/a.ts");
    expect(read.activeReadFileId).toBe("src/a.ts");
    expect(edit.fileId).toBe("src/b.ts");
    expect(edit.activeEditFileId).toBe("src/b.ts");
    expect(edit.recentlyEditedFileIds).toEqual(["src/b.ts"]);
  });
});

function createFile(input: { cycleCount?: number; diagnostics?: string[] }): FileNode {
  return {
    id: "src/file.ts",
    name: "file.ts",
    path: "src/file.ts",
    extension: ".ts",
    language: "typescript",
    folderId: "src",
    kind: "other",
    exports: [],
    importConnectionIds: [],
    dependentConnectionIds: [],
    metrics: {
      importCount: 0,
      dependentCount: 0,
      exportCount: 0,
      cycleCount: input.cycleCount ?? 0
    },
    diagnostics: input.diagnostics ?? []
  };
}
