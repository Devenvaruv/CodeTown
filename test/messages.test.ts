import { describe, expect, it } from "vitest";
import { isWebviewToExtensionMessage } from "../src/shared/messageTypes";

describe("message validation", () => {
  it("accepts valid discriminated webview messages", () => {
    expect(isWebviewToExtensionMessage({ type: "ready" })).toBe(true);
    expect(isWebviewToExtensionMessage({ type: "openFile", fileId: "src/index.ts", line: 3 })).toBe(true);
  });

  it("rejects invalid or path-like untyped messages", () => {
    expect(isWebviewToExtensionMessage({ type: "openFile", path: "C:/secret.ts" })).toBe(false);
    expect(isWebviewToExtensionMessage({ type: "savePreferences", preferences: { expandedFolderIds: [1] } })).toBe(false);
    expect(isWebviewToExtensionMessage(null)).toBe(false);
  });
});
