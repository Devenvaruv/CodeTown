import path from "node:path";
import { describe, expect, it } from "vitest";
import { folderIdFromRelativeFilePath, normalizeRelativePath, parentFolderId, relativePath } from "../src/shared/pathUtils";

describe("path utilities", () => {
  it("normalizes Windows and POSIX separators to deterministic relative IDs", () => {
    expect(normalizeRelativePath(".\\src\\auth\\service.ts")).toBe("src/auth/service.ts");
    expect(folderIdFromRelativeFilePath("src/auth/service.ts")).toBe("src/auth");
    expect(parentFolderId("src/auth")).toBe("src");
  });

  it("creates project-relative paths", () => {
    const root = path.join("C:", "repo");
    const file = path.join(root, "src", "index.ts");
    expect(relativePath(root, file)).toBe("src/index.ts");
  });
});
