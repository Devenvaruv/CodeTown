import { describe, expect, it } from "vitest";
import { buildTownLayout, createVisibleProjectGraph, layoutGraph, type GraphNode, type LayoutNode } from "../src/graph/layout/elkLayout";
import { visibleRoadsForState } from "../src/graph/layout/roadVisibility";
import type { FileKind, FileNode, FolderNode, ImportConnection, ProjectGraph } from "../src/shared/graphTypes";

describe("bounded grid layout", () => {
  it("lays out a simple two-node dependency", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts"), [edge("e:a-b", "a.ts", "b.ts")]);

    expect(layout.nodes).toHaveLength(2);
    expect(layout.edges).toHaveLength(1);
    expect(layout.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
    expect(layout.edges[0]?.sections[0]?.startPoint).toBeDefined();
  });

  it("uses left-to-right layered layout by default", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts"), [edge("e:a-b", "a.ts", "b.ts")]);

    expect(node(layout.nodes, "a.ts").x).toBeLessThan(node(layout.nodes, "b.ts").x);
  });

  it("supports top-to-bottom layered layout", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts"), [edge("e:a-b", "a.ts", "b.ts")], { direction: "DOWN" });

    expect(node(layout.nodes, "a.ts").y).toBeLessThan(node(layout.nodes, "b.ts").y);
  });

  it("keeps multiple files inside one compound folder", async () => {
    const layout = await layoutGraph(
      [
        folderNode("src"),
        ...files("src/a.ts", "src/b.ts").map((file) => ({ ...file, parentId: "src" }))
      ],
      [edge("e:a-b", "src/a.ts", "src/b.ts")]
    );

    expectInside(node(layout.nodes, "src/a.ts"), node(layout.nodes, "src"));
    expectInside(node(layout.nodes, "src/b.ts"), node(layout.nodes, "src"));
    expect(node(layout.nodes, "src/a.ts").x).toBeLessThan(node(layout.nodes, "src/b.ts").x);
  });

  it("lays direct files out in rows and columns instead of a vertical strip", async () => {
    const layout = await layoutGraph(
      [
        folderNode("src"),
        ...files("src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts").map((file) => ({ ...file, parentId: "src" }))
      ],
      []
    );
    const fileNodes = ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts", "src/e.ts"].map((id) => node(layout.nodes, id));
    const uniqueXs = new Set(fileNodes.map((file) => file.x));
    const uniqueYs = new Set(fileNodes.map((file) => file.y));

    expect(uniqueXs.size).toBeGreaterThan(1);
    expect(uniqueYs.size).toBeGreaterThan(1);
    expectNoOverlaps(fileNodes);
    expect(layout.layoutWarnings).toEqual([]);
  });

  it("supports nested compound folders recursively", async () => {
    const layout = await layoutGraph([
      folderNode("src"),
      folderNode("src/auth", "src"),
      { ...files("src/auth/controller.ts")[0]!, parentId: "src/auth" }
    ], []);

    expect(node(layout.nodes, "src/auth").parentId).toBe("src");
    expect(node(layout.nodes, "src/auth/controller.ts").parentId).toBe("src/auth");
    expectInside(node(layout.nodes, "src/auth"), node(layout.nodes, "src"));
    expectInside(node(layout.nodes, "src/auth/controller.ts"), node(layout.nodes, "src/auth"));
  });

  it("routes dependencies across folders without moving children outside parents", async () => {
    const layout = await layoutGraph(
      [
        folderNode("src/auth"),
        folderNode("src/billing"),
        { ...files("src/auth/service.ts")[0]!, parentId: "src/auth" },
        { ...files("src/billing/service.ts")[0]!, parentId: "src/billing" }
      ],
      [edge("e:auth-billing", "src/auth/service.ts", "src/billing/service.ts")]
    );

    expectInside(node(layout.nodes, "src/auth/service.ts"), node(layout.nodes, "src/auth"));
    expectInside(node(layout.nodes, "src/billing/service.ts"), node(layout.nodes, "src/billing"));
    expect(layout.edges[0]?.sections.length).toBeGreaterThan(0);
  });

  it("handles circular dependencies", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts"), [edge("e:a-b", "a.ts", "b.ts"), edge("e:b-a", "b.ts", "a.ts")]);

    expect(layout.edges).toHaveLength(2);
    expect(layout.nodes.every((candidate) => Number.isFinite(candidate.x) && Number.isFinite(candidate.y))).toBe(true);
  });

  it("positions disconnected nodes", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts", "c.ts"), [edge("e:a-b", "a.ts", "b.ts")]);

    expect(Number.isFinite(node(layout.nodes, "c.ts").x)).toBe(true);
    expect(Number.isFinite(node(layout.nodes, "c.ts").y)).toBe(true);
  });

  it("aggregates collapsed-folder edges from provider to consumer and excludes descendants", async () => {
    const graph = collapsedGraph();
    const visible = createVisibleProjectGraph(graph, new Set([".", "src"]));
    const layout = await buildTownLayout(graph, new Set([".", "src"]));
    const road = layout.roads.find((candidate) => candidate.sourceId === "src/billing" && candidate.targetId === "src/auth");

    expect(visible.nodes.some((candidate) => candidate.id === "src/auth/a.ts")).toBe(false);
    expect(road?.isAggregated).toBe(true);
    expect(road?.dependencyCount).toBe(2);
  });

  it("shows the complete nested folder hierarchy when every folder is expanded", async () => {
    const graph = deepHierarchyGraph();
    const expanded = new Set(graph.folders.map((folder) => folder.id));
    const layout = await buildTownLayout(graph, expanded);

    expect(layout.folders.map((folder) => folder.id)).toEqual(["src", "src/components", "src/components/forms", "src/components/forms/inputs"]);
    expectInside(node(layout.folders, "src/components"), node(layout.folders, "src"));
    expectInside(node(layout.folders, "src/components/forms"), node(layout.folders, "src/components"));
    expectInside(node(layout.folders, "src/components/forms/inputs"), node(layout.folders, "src/components/forms"));
    expectInside(node(layout.files, "src/components/forms/inputs/TextInput.tsx"), node(layout.folders, "src/components/forms/inputs"));
    expect(node(layout.files, "src/components/forms/inputs/TextInput.tsx").y).toBeGreaterThan(node(layout.folders, "src/components/forms/inputs").y + 60);
  });

  it("creates project visual roads from exporting provider to importing consumer", async () => {
    const graph = providerConsumerGraph();
    const visible = createVisibleProjectGraph(graph, new Set(graph.folders.map((folder) => folder.id)));
    const road = visible.edges.find((candidate) => candidate.connectionId === "types-to-user");

    expect(road).toEqual(expect.objectContaining({
      sourceId: "src/types.ts",
      targetId: "src/user.service.ts",
      isAggregated: false
    }));
  });

  it("uses provider-to-consumer direction for aggregated folder roads", async () => {
    const graph = providerConsumerGraph();
    const visible = createVisibleProjectGraph(graph, new Set([".", "src"]));
    const road = visible.edges.find((candidate) => candidate.sourceId === "src/lib" && candidate.targetId === "src/app");

    expect(road).toEqual(expect.objectContaining({
      sourceId: "src/lib",
      targetId: "src/app",
      isAggregated: true,
      dependencyCount: 2
    }));
  });

  it("shows only bundled folder roads before any selection", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const visibleRoads = visibleRoadsForState(layout.roads, graph, {});

    expect(visibleRoads.length).toBeGreaterThan(0);
    expect(visibleRoads.every((road) => road.level === "folder")).toBe(true);
    expect(visibleRoads.some((road) => road.level === "file")).toBe(false);
  });

  it("reveals only direct file roads for a selected file", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const visibleRoads = visibleRoadsForState(layout.roads, graph, { selection: { kind: "file", id: "src/user.service.ts" } });
    const fileRoads = visibleRoads.filter((road) => road.level === "file");

    expect(fileRoads).toEqual([
      expect.objectContaining({
        sourceId: "src/types.ts",
        targetId: "src/user.service.ts"
      })
    ]);
  });

  it("does not reveal file roads for a hovered file", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const visibleRoads = visibleRoadsForState(layout.roads, graph, {});

    expect(visibleRoads.filter((road) => road.level === "file")).toHaveLength(0);
  });

  it("does not reveal file roads for a focused folder", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const visibleRoads = visibleRoadsForState(layout.roads, graph, { selection: { kind: "folder", id: "src" } });

    expect(visibleRoads.some((road) => road.level === "file")).toBe(false);
    expect(visibleRoads.every((road) => road.level === "folder")).toBe(true);
  });

  it("can explicitly show all bundled dependencies", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const visibleRoads = visibleRoadsForState(layout.roads, graph, { showAllDependencies: true });

    expect(visibleRoads).toHaveLength(layout.roads.length);
    expect(visibleRoads.some((road) => road.level === "file")).toBe(true);
    expect(visibleRoads.some((road) => road.level === "folder")).toBe(true);
  });

  it("places nodes with missing parent information at the root level", async () => {
    const layout = await layoutGraph([{ ...files("orphan.ts")[0]!, parentId: "missing" }], [edge("bad", "orphan.ts", "missing.ts")]);

    expect(node(layout.nodes, "orphan.ts").parentId).toBeUndefined();
    expect(layout.edges).toHaveLength(0);
  });

  it("preserves ELK bend points in routed edge sections", async () => {
    const layout = await layoutGraph(files("a.ts", "b.ts", "c.ts", "d.ts"), [
      edge("e:a-d", "a.ts", "d.ts"),
      edge("e:b-c", "b.ts", "c.ts"),
      edge("e:a-c", "a.ts", "c.ts")
    ]);
    const routedWithBends = layout.edges.find((candidate) => candidate.sections.some((section) => section.bendPoints.length > 0));

    expect(routedWithBends).toBeDefined();
    expect(routedWithBends?.points.length).toBeGreaterThan(2);
  });

  it("returns deterministic output for stable graph input", async () => {
    const nodes = [
      folderNode("src"),
      { ...files("src/a.ts")[0]!, parentId: "src" },
      { ...files("src/b.ts")[0]!, parentId: "src" }
    ];
    const edges = [edge("e:a-b", "src/a.ts", "src/b.ts")];
    const first = await layoutGraph(nodes, edges);
    const second = await layoutGraph(nodes, edges);

    expect(first.nodes).toEqual(second.nodes);
    expect(first.edges).toEqual(second.edges);
  });
});

function files(...ids: string[]): GraphNode[] {
  return ids.map((id) => ({
    id,
    kind: "file",
    label: id.split("/").at(-1) ?? id,
    width: 132,
    height: 118
  }));
}

function folderNode(id: string, parentId?: string): GraphNode {
  return {
    id,
    kind: "folder",
    label: id.split("/").at(-1) ?? id,
    parentId
  };
}

function edge(id: string, sourceId: string, targetId: string) {
  return { id, sourceId, targetId };
}

function node(nodes: LayoutNode[], id: string): LayoutNode {
  const match = nodes.find((candidate) => candidate.id === id);
  expect(match).toBeDefined();
  return match!;
}

function expectInside(child: LayoutNode, parent: LayoutNode): void {
  expect(child.x).toBeGreaterThanOrEqual(parent.x);
  expect(child.y).toBeGreaterThanOrEqual(parent.y);
  expect(child.x + child.width).toBeLessThanOrEqual(parent.x + parent.width);
  expect(child.y + child.height).toBeLessThanOrEqual(parent.y + parent.height);
}

function expectNoOverlaps(nodes: LayoutNode[]): void {
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex]!;
      const right = nodes[rightIndex]!;
      const overlaps = left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
      expect(overlaps).toBe(false);
    }
  }
}

function collapsedGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["src"], [], 0),
    folder("src", ".", ["src/auth", "src/billing"], [], 1),
    folder("src/auth", "src", [], ["src/auth/a.ts", "src/auth/b.ts"], 2),
    folder("src/billing", "src", [], ["src/billing/c.ts"], 2)
  ];
  const graphFiles = [
    file("src/auth/a.ts", "src/auth"),
    file("src/auth/b.ts", "src/auth"),
    file("src/billing/c.ts", "src/billing")
  ];
  const connections = [
    connection("c1", "src/auth/a.ts", "src/auth/b.ts"),
    connection("c2", "src/auth/a.ts", "src/billing/c.ts"),
    connection("c3", "src/auth/b.ts", "src/billing/c.ts")
  ];
  return {
    project: {
      id: "fixture",
      name: "fixture",
      rootPath: ".",
      analyzedAt: "2026-07-30T00:00:00.000Z",
      fileCount: graphFiles.length,
      folderCount: folders.length,
      connectionCount: connections.length
    },
    folders,
    files: graphFiles,
    connections,
    externalPackages: [],
    diagnostics: []
  };
}

function deepHierarchyGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["src"], [], 0),
    folder("src", ".", ["src/components"], [], 1),
    folder("src/components", "src", ["src/components/forms"], [], 2),
    folder("src/components/forms", "src/components", ["src/components/forms/inputs"], [], 3),
    folder("src/components/forms/inputs", "src/components/forms", [], ["src/components/forms/inputs/TextInput.tsx"], 4)
  ];
  const graphFiles = [file("src/components/forms/inputs/TextInput.tsx", "src/components/forms/inputs", "component")];
  return projectGraph("deep", folders, graphFiles, []);
}

function providerConsumerGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["src"], [], 0),
    folder("src", ".", ["src/app", "src/lib"], ["src/types.ts", "src/user.service.ts"], 1),
    folder("src/app", "src", [], ["src/app/app.ts", "src/app/page.ts"], 2),
    folder("src/lib", "src", [], ["src/lib/api.ts"], 2)
  ];
  const graphFiles = [
    file("src/types.ts", "src", "utility"),
    file("src/user.service.ts", "src", "service"),
    file("src/app/app.ts", "src/app", "service"),
    file("src/app/page.ts", "src/app", "component"),
    file("src/lib/api.ts", "src/lib", "utility")
  ];
  return projectGraph("providers", folders, graphFiles, [
    connection("types-to-user", "src/user.service.ts", "src/types.ts"),
    connection("lib-to-app", "src/app/app.ts", "src/lib/api.ts"),
    connection("lib-to-page", "src/app/page.ts", "src/lib/api.ts")
  ]);
}

function projectGraph(id: string, folders: FolderNode[], files: FileNode[], connections: ImportConnection[]): ProjectGraph {
  return {
    project: {
      id,
      name: id,
      rootPath: ".",
      analyzedAt: "2026-07-30T00:00:00.000Z",
      fileCount: files.length,
      folderCount: folders.length,
      connectionCount: connections.length
    },
    folders,
    files,
    connections,
    externalPackages: [],
    diagnostics: []
  };
}

function folder(id: string, parentFolderId: string | undefined, childFolderIds: string[], fileIds: string[], depth: number): FolderNode {
  return {
    id,
    name: id === "." ? "fixture" : id.split("/").at(-1)!,
    path: id,
    parentFolderId,
    childFolderIds,
    fileIds,
    depth,
    metrics: {
      directFileCount: fileIds.length,
      descendantFileCount: fileIds.length,
      internalConnectionCount: 0,
      incomingConnectionCount: 0,
      outgoingConnectionCount: 0,
      cycleCount: 0
    }
  };
}

function file(id: string, folderId: string, kind: FileKind = "service"): FileNode {
  return {
    id,
    name: id.split("/").at(-1)!,
    path: id,
    extension: ".ts",
    language: "typescript",
    folderId,
    kind,
    exports: [],
    importConnectionIds: [],
    dependentConnectionIds: [],
    metrics: {
      importCount: 0,
      dependentCount: 0,
      exportCount: 0,
      cycleCount: 0
    },
    diagnostics: []
  };
}

function connection(id: string, sourceFileId: string, targetFileId: string): ImportConnection {
  return {
    id,
    sourceFileId,
    targetFileId,
    moduleSpecifier: targetFileId,
    symbols: [],
    type: "runtime",
    isResolved: true,
    isCircular: false
  };
}
