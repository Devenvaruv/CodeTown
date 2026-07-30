import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProject } from "../src/analysis/parseProject";

const fixtureRoot = path.resolve("test/fixtures/basic");

describe("parseProject", () => {
  it("builds a dependency graph with local imports, aliases, re-exports, dynamic imports, require calls, and diagnostics", async () => {
    const graph = await parseProject(fixtureRoot);
    const byId = new Map(graph.files.map((file) => [file.id, file]));
    const connections = graph.connections;

    expect(byId.has("src/auth/auth.service.ts")).toBe(true);
    expect(byId.get("src/auth/auth.service.ts")?.exports.map((symbol) => symbol.name)).toContain("createAuthService");

    expect(
      connections.some(
        (connection) =>
          connection.sourceFileId === "src/auth/auth.service.ts" &&
          connection.targetFileId === "src/users/user.service.ts" &&
          connection.type === "runtime"
      )
    ).toBe(true);

    expect(
      connections.some(
        (connection) =>
          connection.sourceFileId === "src/users/user.service.ts" &&
          connection.targetFileId === "src/shared/types.ts" &&
          connection.type === "type-only"
      )
    ).toBe(true);

    expect(
      connections.some(
        (connection) =>
          connection.sourceFileId === "src/auth/index.ts" &&
          connection.targetFileId === "src/auth/auth.service.ts" &&
          connection.type === "re-export"
      )
    ).toBe(true);

    expect(connections.some((connection) => connection.sourceFileId === "src/dynamic.ts" && connection.type === "dynamic")).toBe(true);
    expect(connections.some((connection) => connection.sourceFileId === "src/dynamic.ts" && connection.moduleSpecifier === "./shared/types")).toBe(true);
    expect(graph.diagnostics.some((diagnostic) => diagnostic.code === "UNRESOLVED_IMPORT")).toBe(true);
  });

  it("populates reverse dependencies and circular dependency flags", async () => {
    const graph = await parseProject(fixtureRoot);
    const auth = graph.files.find((file) => file.id === "src/auth/auth.service.ts");
    const user = graph.files.find((file) => file.id === "src/users/user.service.ts");
    const cycleConnections = graph.connections.filter((connection) => connection.isCircular);

    expect(auth?.dependentConnectionIds.length).toBeGreaterThan(0);
    expect(user?.dependentConnectionIds.length).toBeGreaterThan(0);
    expect(cycleConnections.map((connection) => connection.sourceFileId).sort()).toEqual(["src/cycle/a.ts", "src/cycle/b.ts"]);
  });
});
