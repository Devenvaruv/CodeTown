import { describe, expect, it } from "vitest";
import { getVisibleBuildingBounds } from "../src/graph/layout/buildingGeometry";
import { buildTownLayout, createVisibleProjectGraph, layoutGraph, type GraphNode, type LayoutNode } from "../src/graph/layout/elkLayout";
import { buildRoutingPlan, consumerFileId, getProviderConsumerFiles, providerFileId, type InternalStreetGraph, type RoutingPlan } from "../src/graph/layout/routingPlan";
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
    const road = visible.edges.find((candidate) => candidate.sourceId === "src/billing" && candidate.targetId === "src/auth");

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

  it("renders canonical roads with overview hiding internal dependency routes", async () => {
    const graph = providerConsumerGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const overviewRoads = visibleRoadsForState(layout.roads, graph, {});
    const selectedFileRoads = visibleRoadsForState(layout.roads, graph, { selection: { kind: "file", id: "src/user.service.ts" } });
    const selectedFolderRoads = visibleRoadsForState(layout.roads, graph, { selection: { kind: "folder", id: "src/lib" } });

    expect(layout.roads.length).toBeGreaterThan(0);
    expect(layout.roads.every((road) => road.exactRouteIds.length > 0 && road.routeKind !== "direct")).toBe(true);
    expect(overviewRoads.every((road) => road.routeKind === "trunk")).toBe(true);
    expect(selectedFileRoads.length).toBeGreaterThan(0);
    expect(selectedFileRoads.every((road) => road.participantFileIds.includes("src/user.service.ts"))).toBe(true);
    expect(selectedFolderRoads.length).toBeGreaterThan(0);
    expect(visibleRoadsForState(layout.roads, graph, { showAllDependencies: true })).toHaveLength(layout.roads.length);
  });

  it("assigns deterministic building ports for every visible file", async () => {
    const graph = threeTownGraph();
    const expanded = new Set(graph.folders.map((folder) => folder.id));
    const first = await buildTownLayout(graph, expanded);
    const second = await buildTownLayout(graph, expanded);

    expect(first.buildingPorts).toHaveLength(first.files.length);
    expect(new Set(first.buildingPorts.map((port) => port.fileId)).size).toBe(first.files.length);
    expect(first.buildingPorts).toEqual(second.buildingPorts);
    expect(first.routingPlan.validation).toEqual(expect.objectContaining({
      visibleFileCount: first.files.length,
      buildingPortCount: first.files.length,
      filesWithZeroPorts: 0,
      filesWithMultiplePorts: 0
    }));
    for (const port of first.buildingPorts) {
      expect(pointOnVisibleBuildingBoundary(port, node(first.files, port.fileId))).toBe(true);
    }
  });

  it("keeps building artwork bounds and routing bounds centralized", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const fileNode = node(layout.files, "frontend/ts.ts");

    expect(getVisibleBuildingBounds(fileNode)).toEqual({
      id: "frontend/ts.ts",
      x: fileNode.x + 16,
      y: fileNode.y + 10,
      width: fileNode.width - 32,
      height: 82
    });
    expect(pointOnVisibleBuildingBoundary(layout.routingPlan.buildingPorts.get("frontend/ts.ts")!, fileNode)).toBe(true);
  });

  it("does not create route-level building ports on canonical rendered roads", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.roads.flatMap((road) => [road.sourceBuildingPort, road.targetBuildingPort]).filter(Boolean)).toEqual([]);
    expect(layout.buildingPorts).toHaveLength(layout.routingPlan.buildingPorts.size);
  });

  it("throws on routing-plan invariant violations", () => {
    const graph = threeTownGraph();
    const duplicateFile = {
      id: "alpha/provider.ts",
      kind: "file" as const,
      parentId: "alpha",
      x: 0,
      y: 0,
      width: 132,
      height: 118
    };

    expect(() => buildRoutingPlan({
      graph,
      files: [duplicateFile, duplicateFile],
      folders: [{ id: "alpha", kind: "folder", x: 0, y: 0, width: 240, height: 130 }],
      connections: graph.connections,
      throwOnViolation: true
    })).toThrow(/routing plan violation/);
  });

  it("assigns one gateway to a folder connected to three other folders", async () => {
    const graph = threeGatewayGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const hubGateways = layout.folderGateways.filter((gateway) => gateway.folderId === "hub");

    expect(hubGateways).toHaveLength(1);
    expect(layout.routingPlan.validation.externallyConnectedFolderCount).toBe(4);
    expect(layout.routingPlan.validation.foldersWithExternalDependenciesWithoutGateway).toBe(0);
    expect(layout.routingPlan.validation.foldersWithMultipleGateways).toBe(0);
  });

  it("reuses the same folder gateway for incoming and outgoing dependencies", async () => {
    const graph = bidirectionalGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const gatewayIds = layout.folderGateways.map((gateway) => gateway.folderId);

    expect(gatewayIds.filter((folderId) => folderId === "frontend")).toHaveLength(1);
    expect(gatewayIds.filter((folderId) => folderId === "backend")).toHaveLength(1);
    expect(layout.routingPlan.folderGateways.get("frontend")).toEqual(layout.folderGateways.find((gateway) => gateway.folderId === "frontend"));
    expect(layout.routingPlan.folderGateways.get("backend")).toEqual(layout.folderGateways.find((gateway) => gateway.folderId === "backend"));
  });

  it("selects deterministic folder gateways on folder boundaries", async () => {
    const graph = threeGatewayGraph();
    const expanded = new Set(graph.folders.map((folder) => folder.id));
    const first = await buildTownLayout(graph, expanded);
    const second = await buildTownLayout(graph, expanded);

    expect(first.folderGateways).toEqual(second.folderGateways);
    for (const gateway of first.folderGateways) {
      expect(pointOnFolderBoundary(gateway, node(first.folders, gateway.folderId))).toBe(true);
    }
  });

  it("keeps per-bundle gateways from being authoritative", async () => {
    const graph = bidirectionalGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const uniqueGatewayFolders = new Set(layout.folderGateways.map((gateway) => gateway.folderId));

    expect(uniqueGatewayFolders.size).toBe(layout.folderGateways.length);
    expect(new Set(layout.roads.map((road) => road.id)).size).toBe(layout.roads.length);
    expect(layout.folderGateways).toHaveLength(layout.routingPlan.validation.externallyConnectedFolderCount);
  });

  it("builds one internal street graph for each gateway folder", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.routingPlan.internalStreetGraphs.size).toBe(layout.folderGateways.length);
    for (const gateway of layout.folderGateways) {
      const streetGraph = layout.routingPlan.internalStreetGraphs.get(gateway.folderId);
      expect(streetGraph).toBeDefined();
      expect(streetGraph?.gatewayId).toBe(gateway.id);
      expect(streetGraph?.spineEdgeIds).toHaveLength(1);
      const spine = streetGraph?.edges.find((edge) => edge.kind === "spine");
      expect(spine?.from).toEqual({ x: gateway.x, y: gateway.y });
      expect(spine?.to).not.toEqual({ x: gateway.x, y: gateway.y });
    }
  });

  it("creates collectors and spurs from fixed building ports", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    for (const [folderId, streetGraph] of layout.routingPlan.internalStreetGraphs) {
      const directFileIds = layout.files.filter((file) => file.parentId === folderId).map((file) => file.id).sort();
      expect(streetGraph.collectorEdgeIds.length).toBeGreaterThan(0);
      expect(streetGraph.spurEdgeIds).toHaveLength(directFileIds.length);
      for (const fileId of directFileIds) {
        const port = layout.routingPlan.buildingPorts.get(fileId);
        const spur = streetGraph.edges.find((edge) => edge.kind === "spur" && edge.connectedFileIds.includes(fileId));
        const collector = streetGraph.edges.find((edge) => edge.kind === "collector" && edge.connectedFileIds.includes(fileId));
        expect(port).toBeDefined();
        expect(spur?.to).toEqual({ x: port?.x, y: port?.y });
        expect(collector).toBeDefined();
      }
    }
  });

  it("shares a collector for multiple nearby participating files in one folder", () => {
    const graph = multiFileStreetGraph();
    const plan = buildRoutingPlan({
      graph,
      folders: [
        { id: "providers", kind: "folder", x: 0, y: 0, width: 520, height: 260 },
        { id: "consumers", kind: "folder", x: 120, y: 420, width: 260, height: 220 }
      ],
      files: [
        { id: "providers/a.ts", kind: "file", parentId: "providers", x: 80, y: 86, width: 132, height: 118 },
        { id: "providers/b.ts", kind: "file", parentId: "providers", x: 270, y: 86, width: 132, height: 118 },
        { id: "consumers/app.ts", kind: "file", parentId: "consumers", x: 184, y: 486, width: 132, height: 118 }
      ],
      connections: graph.connections,
      throwOnViolation: true
    });
    const providerGraph = plan.internalStreetGraphs.get("providers");
    const gateway = plan.folderGateways.get("providers");
    const spine = providerGraph?.edgeById.get(providerGraph.spineEdgeIds[0]!);
    const sharedCollectors = providerGraph?.edges.filter((edge) => edge.kind === "collector" && edge.connectedFileIds.length === 2) ?? [];

    expect(gateway?.side).toBe("bottom");
    expect(spine?.from.x).toBe(spine?.to.x);
    expect(sharedCollectors.some((edge) => edge.from.y === edge.to.y)).toBe(true);
    expect(providerGraph?.spurEdgeIds).toHaveLength(2);
  });

  it("places a bottom-gateway vertical spine on an interior corridor", () => {
    const graph = multiFileStreetGraph();
    const plan = buildRoutingPlan({
      graph,
      folders: [
        { id: "providers", kind: "folder", x: 0, y: 0, width: 520, height: 300 },
        { id: "consumers", kind: "folder", x: 120, y: 620, width: 260, height: 220 }
      ],
      files: [
        { id: "providers/a.ts", kind: "file", parentId: "providers", x: 80, y: 86, width: 132, height: 118 },
        { id: "providers/b.ts", kind: "file", parentId: "providers", x: 270, y: 86, width: 132, height: 118 },
        { id: "consumers/app.ts", kind: "file", parentId: "consumers", x: 184, y: 686, width: 132, height: 118 }
      ],
      connections: graph.connections,
      throwOnViolation: true
    });
    const gateway = plan.folderGateways.get("providers");
    const spine = plan.internalStreetGraphs.get("providers")?.edgeById.get("street:providers:spine:primary");

    expect(gateway?.side).toBe("bottom");
    expect(spine?.from.x).toBe(spine?.to.x);
    expect(spine?.to.y).toBeLessThan(300 - 16);
    expect(spine?.to.y).toBeLessThanOrEqual(150);
  });

  it("places a right-gateway horizontal spine on an interior corridor", () => {
    const graph = rightGatewayStreetGraph();
    const plan = buildRoutingPlan({
      graph,
      folders: [
        { id: "left", kind: "folder", x: 0, y: 0, width: 460, height: 340 },
        { id: "right", kind: "folder", x: 760, y: 40, width: 260, height: 220 }
      ],
      files: [
        { id: "left/a.ts", kind: "file", parentId: "left", x: 80, y: 86, width: 132, height: 118 },
        { id: "left/b.ts", kind: "file", parentId: "left", x: 80, y: 220, width: 132, height: 118 },
        { id: "right/provider.ts", kind: "file", parentId: "right", x: 824, y: 106, width: 132, height: 118 }
      ],
      connections: graph.connections,
      throwOnViolation: true
    });
    const gateway = plan.folderGateways.get("left");
    const spine = plan.internalStreetGraphs.get("left")?.edgeById.get("street:left:spine:primary");

    expect(gateway?.side).toBe("right");
    expect(spine?.from.y).toBe(spine?.to.y);
    expect(spine?.to.x).toBeLessThan(460 - 16);
    expect(spine?.to.x).toBeLessThanOrEqual(230);
  });

  it("selects the spine candidate that minimizes collector length deterministically", () => {
    const graph = multiFileStreetGraph();
    const input = {
      graph,
      folders: [
        { id: "providers", kind: "folder" as const, x: 0, y: 0, width: 560, height: 360 },
        { id: "consumers", kind: "folder" as const, x: 140, y: 660, width: 260, height: 220 }
      ],
      files: [
        { id: "providers/a.ts", kind: "file" as const, parentId: "providers", x: 80, y: 86, width: 132, height: 118 },
        { id: "providers/b.ts", kind: "file" as const, parentId: "providers", x: 310, y: 86, width: 132, height: 118 },
        { id: "consumers/app.ts", kind: "file" as const, parentId: "consumers", x: 204, y: 726, width: 132, height: 118 }
      ],
      connections: graph.connections,
      throwOnViolation: true
    };
    const first = buildRoutingPlan(input);
    const second = buildRoutingPlan(input);
    const spine = first.internalStreetGraphs.get("providers")?.edgeById.get("street:providers:spine:primary");

    expect(spine?.to.y).toBe(80);
    expect(serializedStreetGraphs(first.internalStreetGraphs)).toEqual(serializedStreetGraphs(second.internalStreetGraphs));
  });

  it("treats nonparticipating direct files as internal street obstacles", () => {
    const graph = multiFileStreetGraph();
    const plan = buildRoutingPlan({
      graph,
      folders: [
        { id: "providers", kind: "folder", x: 0, y: 0, width: 520, height: 420 },
        { id: "consumers", kind: "folder", x: 120, y: 600, width: 260, height: 220 }
      ],
      files: [
        { id: "providers/a.ts", kind: "file", parentId: "providers", x: 80, y: 280, width: 132, height: 118 },
        { id: "providers/b.ts", kind: "file", parentId: "providers", x: 320, y: 280, width: 132, height: 118 },
        { id: "providers/unused.ts", kind: "file", parentId: "providers", x: 208, y: 170, width: 132, height: 118 },
        { id: "consumers/app.ts", kind: "file", parentId: "consumers", x: 184, y: 666, width: 132, height: 118 }
      ],
      connections: graph.connections,
      throwOnViolation: true
    });
    const providerGraph = plan.internalStreetGraphs.get("providers");
    const unusedBuilding = getVisibleBuildingBounds({ id: "providers/unused.ts", x: 208, y: 170, width: 132, height: 118 });
    const unusedLabel = { id: "providers/unused.ts", x: 212, y: 254, width: 124, height: 28 };

    expect(providerGraph).toBeDefined();
    for (const edge of providerGraph?.edges ?? []) {
      expect(pathIntersectsAnyRect([edge.from, edge.to], [unusedBuilding, unusedLabel])).toBe(false);
    }
  });

  it("reuses one file spur when a file connects to multiple external folders", async () => {
    const graph = threeGatewayGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const hubGraph = layout.routingPlan.internalStreetGraphs.get("hub");

    expect(hubGraph).toBeDefined();
    expect(hubGraph?.fileEntryEdgeByFileId.get("hub/index.ts")).toBe("street:hub:spur:hub/index.ts");
    expect(hubGraph?.edges.filter((edge) => edge.kind === "spur" && edge.connectedFileIds.includes("hub/index.ts"))).toHaveLength(1);
    expect(hubGraph?.spurEdgeIds).toHaveLength(1);
  });

  it("shares one street graph for incoming and outgoing folder dependencies", async () => {
    const graph = bidirectionalGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.routingPlan.validation.internalStreetGraphCount).toBe(layout.routingPlan.validation.expandedFoldersNeedingStreetCount);
    expect(layout.routingPlan.internalStreetGraphs.size).toBe(2);
    expect(layout.routingPlan.internalStreetGraphs.get("frontend")?.spineEdgeIds).toHaveLength(1);
    expect(layout.routingPlan.internalStreetGraphs.get("backend")?.spineEdgeIds).toHaveLength(1);
  });

  it("uses collector orientation from the gateway-selected spine", async () => {
    const graph = threeGatewayGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    for (const streetGraph of layout.routingPlan.internalStreetGraphs.values()) {
      const gateway = layout.routingPlan.folderGateways.get(streetGraph.folderId);
      const spine = streetGraph.edgeById.get(streetGraph.spineEdgeIds[0]!);
      expect(gateway).toBeDefined();
      expect(spine).toBeDefined();
      if (!gateway || !spine) {
        continue;
      }
      if (gateway.side === "top" || gateway.side === "bottom") {
        expect(spine.from.x).toBe(spine.to.x);
        expect(streetGraph.edges.some((edge) => edge.kind === "collector" && edge.from.y === edge.to.y)).toBe(true);
      } else {
        expect(spine.from.y).toBe(spine.to.y);
        expect(streetGraph.edges.some((edge) => edge.kind === "collector" && edge.from.x === edge.to.x)).toBe(true);
      }
    }
  });

  it("creates no duplicate spurs and terminates every spur at its stored building port", async () => {
    const graph = bidirectionalGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    for (const streetGraph of layout.routingPlan.internalStreetGraphs.values()) {
      const spurFiles = streetGraph.edges.filter((edge) => edge.kind === "spur").flatMap((edge) => edge.connectedFileIds);
      expect(new Set(spurFiles).size).toBe(spurFiles.length);
      for (const spur of streetGraph.edges.filter((edge) => edge.kind === "spur")) {
        const fileId = spur.connectedFileIds[0]!;
        const port = layout.routingPlan.buildingPorts.get(fileId);
        expect(spur.to).toEqual({ x: port?.x, y: port?.y });
        expect(streetGraph.fileEntryEdgeByFileId.get(fileId)).toBe(spur.id);
      }
    }
  });

  it("produces deterministic internal street graph output for identical input", async () => {
    const graph = acceptanceGraph();
    const expanded = new Set(graph.folders.map((folder) => folder.id));
    const first = await buildTownLayout(graph, expanded);
    const second = await buildTownLayout(graph, expanded);

    expect(serializedStreetGraphs(first.routingPlan.internalStreetGraphs)).toEqual(serializedStreetGraphs(second.routingPlan.internalStreetGraphs));
  });

  it("keeps legacy direct-road generation out of the active production path", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.roads.length).toBeGreaterThan(0);
    expect(layout.roads.some((road) => road.routeKind === "direct" || road.infrastructureKind === "legacy-direct")).toBe(false);
    expect(visibleRoadsForState(layout.roads, graph, { showAllDependencies: true })).toHaveLength(layout.roads.length);
  });

  it("keeps internal street edges orthogonal and clear of buildings and nested folders", async () => {
    const graph = nestedStreetGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.routingPlan.validation).toEqual(expect.objectContaining({
      streetEdgesWithDiagonalSegments: 0,
      streetEdgesOutsideFolderBounds: 0,
      streetEdgesIntersectingBuildings: 0,
      streetEdgesIntersectingNestedFolders: 0
    }));
    for (const streetGraph of layout.routingPlan.internalStreetGraphs.values()) {
      const folder = node(layout.folders, streetGraph.folderId);
      const directBuildings = layout.files.filter((file) => file.parentId === folder.id).map(getVisibleBuildingBounds);
      const nestedFolders = layout.folders.filter((candidate) => candidate.parentId === folder.id);
      for (const edge of streetGraph.edges) {
        expect(countDiagonalSegments([edge.from, edge.to])).toBe(0);
        expect([edge.from, edge.to].every((point) => pointInsideRect(point, folder))).toBe(true);
        const spurFileId = edge.kind === "spur" ? edge.connectedFileIds[0] : undefined;
        const blockingBuildings = edge.kind === "spur" && spurFileId ? directBuildings.filter((building) => building.id !== spurFileId) : directBuildings;
        expect(pathIntersectsAnyRect([edge.from, edge.to], blockingBuildings)).toBe(false);
        expect(pathIntersectsAnyRect([edge.from, edge.to], nestedFolders)).toBe(false);
      }
    }
  });

  it("connects one nested folder to its parent graph through the child gateway", () => {
    const graph = nestedConnectorGraph();
    const plan = buildRoutingPlan(nestedConnectorPlanInput(graph));
    const connector = plan.parentChildConnectors.get("parent-child:parent->parent/test");
    const childGateway = plan.folderGateways.get("parent/test");
    const parentJunction = connector ? plan.streetJunctions.get(connector.parentJunctionId) : undefined;

    expect(connector).toBeDefined();
    expect(plan.parentChildConnectors.size).toBe(1);
    expect(connector?.childGatewayId).toBe(childGateway?.id);
    expect(connector?.edges[0]?.from).toEqual({ x: childGateway?.x, y: childGateway?.y });
    expect(parentJunction?.folderId).toBe("parent");
    expect(connector?.edges.at(-1)?.to).toEqual({ x: parentJunction?.x, y: parentJunction?.y });
  });

  it("reuses one parent-child connector for multiple files and dependencies in the child subtree", () => {
    const graph = nestedConnectorGraph({
      extraChildFiles: ["parent/test/other.spec.ts"],
      extraConnections: [
        connection("peer-other", "peer/consumer.ts", "parent/test/other.spec.ts"),
        connection("peer-spec-again", "peer/consumer.ts", "parent/test/spec.ts", "Again")
      ]
    });
    const plan = buildRoutingPlan(nestedConnectorPlanInput(graph, {
      extraFiles: [{ id: "parent/test/other.spec.ts", kind: "file", parentId: "parent/test", x: 330, y: 176, width: 132, height: 118 }]
    }));

    expect(plan.parentChildConnectors.size).toBe(1);
    expect(plan.parentChildConnectors.get("parent-child:parent->parent/test")?.edgeIds.length).toBeGreaterThan(0);
  });

  it("creates separate connectors for sibling nested folders", () => {
    const graph = siblingNestedConnectorGraph();
    const plan = buildRoutingPlan(siblingNestedConnectorPlanInput(graph));

    expect([...plan.parentChildConnectors.keys()].sort()).toEqual([
      "parent-child:parent->parent/a",
      "parent-child:parent->parent/b"
    ]);
    expect(plan.validation.childFoldersWithDuplicateParentConnectors).toBe(0);
  });

  it("supports recursive three-level nested parent-child connectors", () => {
    const graph = recursiveNestedConnectorGraph();
    const plan = buildRoutingPlan(recursiveNestedConnectorPlanInput(graph));

    expect([...plan.parentChildConnectors.keys()].sort()).toEqual([
      "parent-child:src->src/feature",
      "parent-child:src/feature->src/feature/tests",
      "parent-child:src/feature/tests->src/feature/tests/integration"
    ]);
    expect(plan.validation.childFoldersMissingParentConnector).toBe(0);
    expect(plan.validation.parentChildConnectorsBypassingParentStreetGraph).toBe(0);
  });

  it("keeps parent-child connector segments orthogonal and clear of obstacles", () => {
    const graph = nestedConnectorGraph();
    const plan = buildRoutingPlan(nestedConnectorPlanInput(graph));

    expect(plan.validation).toEqual(expect.objectContaining({
      childFoldersNeedingParentConnector: 1,
      parentChildConnectorCount: 1,
      parentChildConnectorsWithDiagonalSegments: 0,
      parentChildConnectorsOutsideParent: 0,
      parentChildConnectorsIntersectingBuildings: 0,
      parentChildConnectorsIntersectingLabels: 0,
      parentChildConnectorsIntersectingSiblingFolders: 0,
      parentChildConnectorsCrossingChildBoundary: 0
    }));
  });

  it("does not duplicate parent-child connectors for the same parent-child pair", () => {
    const graph = nestedConnectorGraph({
      extraConnections: [
        connection("peer-spec-2", "peer/consumer.ts", "parent/test/spec.ts", "Again"),
        connection("spec-peer", "parent/test/spec.ts", "peer/consumer.ts", "Consumer")
      ]
    });
    const plan = buildRoutingPlan(nestedConnectorPlanInput(graph));

    expect(plan.parentChildConnectors.size).toBe(1);
    expect(plan.validation.childFoldersWithDuplicateParentConnectors).toBe(0);
  });

  it("creates one folder trunk for one cross-top-level dependency", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const trunk = layout.routingPlan.folderTrunks.get("trunk:frontend->backend");

    expect(layout.roads.filter((road) => road.routeKind === "trunk").length).toBeGreaterThan(0);
    expect(layout.routingPlan.folderTrunks.size).toBe(1);
    expect(trunk?.dependencyCount).toBe(3);
    expect(trunk?.providerFolderId).toBe("frontend");
    expect(trunk?.consumerFolderId).toBe("backend");
  });

  it("creates one exact dependency route per visible semantic dependency", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const routes = layout.routingPlan.exactDependencyRoutes;
    const propsRoute = routes.find((route) => route.connectionId === "props");

    expect(layout.routingPlan.validation.semanticDependencyCount).toBe(3);
    expect(layout.routingPlan.validation.exactDependencyRouteCount).toBe(3);
    expect(routes).toHaveLength(3);
    expect(propsRoute).toEqual(expect.objectContaining({
      providerFileId: "frontend/component.ts",
      consumerFileId: "backend/service.ts",
      providerFolderId: "frontend",
      consumerFolderId: "backend",
      providerTopLevelFolderId: "frontend",
      consumerTopLevelFolderId: "backend",
      trunkId: "trunk:frontend->backend",
      dependencyKind: "runtime"
    }));
    expect(propsRoute?.infrastructureRefs[0]).toEqual({
      kind: "internal-street-edge",
      folderId: "frontend",
      edgeId: layout.routingPlan.internalStreetGraphs.get("frontend")?.fileEntryEdgeByFileId.get("frontend/component.ts")
    });
    expect(propsRoute?.infrastructureRefs.at(-1)).toEqual({
      kind: "internal-street-edge",
      folderId: "backend",
      edgeId: layout.routingPlan.internalStreetGraphs.get("backend")?.fileEntryEdgeByFileId.get("backend/service.ts")
    });
    expect(layout.routingPlan.validation).toEqual(expect.objectContaining({
      exactRoutesMissingInfrastructure: 0,
      sameFolderRoutesUsingExternalTrunk: 0,
      crossTopLevelRoutesWithoutOneTrunk: 0,
      exactRoutesWithWrongEndpointPort: 0
    }));
  });

  it("renders shared infrastructure edges once for multiple exact routes", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));
    const sharedTrunkRoads = layout.roads.filter((road) => road.routeKind === "trunk" && road.connectionIds.length === 3);
    const routeIdsOnRoads = layout.roads.flatMap((road) => road.exactRouteIds);

    expect(new Set(layout.roads.map((road) => road.id)).size).toBe(layout.roads.length);
    expect(sharedTrunkRoads.length).toBeGreaterThan(0);
    expect(new Set(routeIdsOnRoads)).toEqual(new Set(layout.routingPlan.exactDependencyRoutes.map((route) => route.id)));
  });

  it("does not count root-level files as exact-route dependencies without folder infrastructure", async () => {
    const graph = rootFileDependencyGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.files.map((fileNode) => fileNode.id).sort()).toEqual(["consumer.ts", "src/provider.ts"]);
    expect(layout.routingPlan.validation.semanticDependencyCount).toBe(0);
    expect(layout.routingPlan.validation.exactDependencyRouteCount).toBe(0);
    expect(layout.routingPlan.validation.exactRoutesMissingInfrastructure).toBe(0);
  });

  it("keeps the consumer spur as the final route ref for parent-folder consumers", () => {
    const graph = parentConsumerNestedProviderGraph();
    const plan = buildRoutingPlan(parentConsumerNestedProviderPlanInput(graph));
    const route = plan.exactDependencyRoutes.find((candidate) => candidate.connectionId === "consumer-provider");
    const consumerSpurId = plan.internalStreetGraphs.get("parent")?.fileEntryEdgeByFileId.get("parent/consumer.ts");

    expect(plan.validation.exactRoutesWithWrongEndpointPort).toBe(0);
    expect(route?.infrastructureRefs.at(-1)).toEqual({
      kind: "internal-street-edge",
      folderId: "parent",
      edgeId: consumerSpurId
    });
  });

  it("keeps ten dependencies between the same folder pair on one shared trunk", () => {
    const graph = manyDependenciesSamePairGraph();
    const plan = buildRoutingPlan(manyDependenciesSamePairPlanInput(graph));
    const trunk = plan.folderTrunks.get("trunk:config->auth");

    expect(plan.folderTrunks.size).toBe(1);
    expect(trunk?.dependencyCount).toBe(10);
    expect(trunk?.dependencyIds).toHaveLength(10);
  });

  it("creates separate trunks for opposite ordered directions", async () => {
    const graph = bidirectionalGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect([...layout.routingPlan.folderTrunks.keys()].sort()).toEqual([
      "trunk:backend->frontend",
      "trunk:frontend->backend"
    ]);
  });

  it("resolves nested provider and consumer files to top-level trunk endpoints", () => {
    const graph = nestedTopLevelTrunkGraph();
    const plan = buildRoutingPlan(nestedTopLevelTrunkPlanInput(graph));
    const trunk = plan.folderTrunks.get("trunk:alpha->beta");

    expect(plan.folderTrunks.size).toBe(1);
    expect(trunk?.providerFileIds).toEqual(["alpha/feature/provider.ts"]);
    expect(trunk?.consumerFileIds).toEqual(["beta/tests/consumer.spec.ts"]);
    expect(trunk?.providerGatewayId).toBe(plan.folderGateways.get("alpha")?.id);
    expect(trunk?.consumerGatewayId).toBe(plan.folderGateways.get("beta")?.id);
  });

  it("creates no external trunk for same-top-level nested dependencies", () => {
    const graph = sameTopLevelNestedDependencyGraph();
    const plan = buildRoutingPlan(sameTopLevelNestedDependencyPlanInput(graph));

    expect(plan.folderTrunks.size).toBe(0);
    expect(plan.validation.expectedFolderTrunkCount).toBe(0);
  });

  it("reuses authoritative gateways for every folder trunk", async () => {
    const graph = threeGatewayGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.folderGateways.filter((gateway) => gateway.folderId === "hub")).toHaveLength(1);
    for (const trunk of layout.routingPlan.folderTrunks.values()) {
      expect(trunk.providerGatewayId).toBe(layout.routingPlan.folderGateways.get(trunk.providerFolderId)?.id);
      expect(trunk.consumerGatewayId).toBe(layout.routingPlan.folderGateways.get(trunk.consumerFolderId)?.id);
    }
  });

  it("allows folder trunks to share canonical corridor segments without duplicate geometry", () => {
    const graph = sharedCorridorTrunkGraph();
    const plan = buildRoutingPlan(sharedCorridorTrunkPlanInput(graph));
    const configAuth = plan.folderTrunks.get("trunk:config->auth");
    const configBilling = plan.folderTrunks.get("trunk:config->billing");
    const sharedEdgeIds = (configAuth?.edgeIds ?? []).filter((edgeId) => configBilling?.edgeIds.includes(edgeId));

    expect(plan.folderTrunks.size).toBe(2);
    expect(sharedEdgeIds.length).toBeGreaterThan(0);
    expect(plan.validation.duplicateExternalCorridorGeometry).toBe(0);
  });

  it("keeps external trunks orthogonal and clear of unrelated folders", () => {
    const graph = sharedCorridorTrunkGraph();
    const plan = buildRoutingPlan(sharedCorridorTrunkPlanInput(graph));

    expect(plan.validation).toEqual(expect.objectContaining({
      folderTrunksWithDiagonalSegments: 0,
      folderTrunksIntersectingFolders: 0,
      folderTrunksIntersectingBuildings: 0,
      folderTrunksIntersectingLabels: 0,
      externalJunctionsMissingCorridorEdge: 0
    }));
  });

  it("produces deterministic external trunk output for identical input", () => {
    const graph = sharedCorridorTrunkGraph();
    const first = buildRoutingPlan(sharedCorridorTrunkPlanInput(graph));
    const second = buildRoutingPlan(sharedCorridorTrunkPlanInput(graph));

    expect(serializedExternalRoutes(first)).toEqual(serializedExternalRoutes(second));
  });

  it("assigns every visible file exactly one building port, including unused files", async () => {
    const graph = threeTownGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.buildingPorts).toHaveLength(layout.files.length);
    expect(layout.roadDebug.visibleFileCount).toBe(layout.files.length);
    expect(layout.roadDebug.filePortCount).toBe(layout.files.length);
    expect(new Set(layout.buildingPorts.map((port) => port.fileId)).size).toBe(layout.files.length);
    for (const port of layout.buildingPorts) {
      expect(pointOnVisibleBuildingBoundary(port, node(layout.files, port.fileId))).toBe(true);
    }
  });

  it("stops at folder gateways when endpoint folders are collapsed", async () => {
    const graph = acceptanceGraph();
    const layout = await buildTownLayout(graph, new Set(["."]));

    expect(layout.files).toHaveLength(0);
    expect(layout.roads.length).toBeGreaterThan(0);
    expect(layout.roads.every((road) => road.routeKind === "trunk" && road.exactRouteIds.length === 0)).toBe(true);
    expect(layout.buildingPorts).toHaveLength(0);
    expect(layout.folderGateways.map((gateway) => gateway.folderId).sort()).toEqual(["backend", "frontend"]);
  });

  it("reports zero legacy road diagnostics with canonical production roads", async () => {
    const graph = threeTownGraph();
    const layout = await buildTownLayout(graph, new Set(graph.folders.map((folder) => folder.id)));

    expect(layout.roads.some((road) => road.routeKind === "direct")).toBe(false);
    expect(layout.roadDebug.diagonalSegmentCount).toBe(0);
    expect(layout.roadDebug.trunksIntersectingFolderBounds).toBe(0);
    expect(layout.roadDebug.trunksIntersectingBuildingBounds).toBe(0);
    expect(layout.roadDebug.filesWithInvalidMultipleEntrances).toBe(0);
    expect(layout.roadDebug.routesBypassingGateway).toBe(0);
    expect(layout.roadDebug.routesBypassingSpineOrCollector).toBe(0);
    expect(layout.roadDebug.buildingIntersectionCount).toBe(0);
    expect(layout.roadDebug.labelIntersectionCount).toBe(0);
  });

  it("keeps sourceFileId as importer and targetFileId as provider", () => {
    const connection = acceptanceGraph().connections[0]!;

    expect(connection.sourceFileId).toBe("backend/need_ts.ts");
    expect(connection.targetFileId).toBe("frontend/ts.ts");
    expect(consumerFileId(connection)).toBe("backend/need_ts.ts");
    expect(providerFileId(connection)).toBe("frontend/ts.ts");
    expect(getProviderConsumerFiles(connection)).toEqual({
      consumerFileId: "backend/need_ts.ts",
      providerFileId: "frontend/ts.ts"
    });
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

function pointOnFolderBoundary(point: { x: number; y: number }, folder: LayoutNode): boolean {
  const onVerticalSide = (point.x === folder.x || point.x === folder.x + folder.width) && point.y >= folder.y && point.y <= folder.y + folder.height;
  const onHorizontalSide = (point.y === folder.y || point.y === folder.y + folder.height) && point.x >= folder.x && point.x <= folder.x + folder.width;
  return onVerticalSide || onHorizontalSide;
}

function pointOnVisibleBuildingBoundary(point: { x: number; y: number }, fileNode: LayoutNode): boolean {
  const bounds = getVisibleBuildingBounds(fileNode);
  const onVerticalSide = (point.x === bounds.x || point.x === bounds.x + bounds.width) && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
  const onHorizontalSide = (point.y === bounds.y || point.y === bounds.y + bounds.height) && point.x >= bounds.x && point.x <= bounds.x + bounds.width;
  return onVerticalSide || onHorizontalSide;
}

function countDiagonalSegments(points: { x: number; y: number }[]): number {
  let count = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (previous.x !== current.x && previous.y !== current.y) {
      count += 1;
    }
  }
  return count;
}

function pointInsideRect(point: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function pathIntersectsAnyRect(points: { x: number; y: number }[], rects: { x: number; y: number; width: number; height: number }[]): boolean {
  return rects.some((rect) => {
    for (let index = 1; index < points.length; index += 1) {
      if (segmentIntersectsRectInterior(points[index - 1]!, points[index]!, rect)) {
        return true;
      }
    }
    return false;
  });
}

function segmentIntersectsRectInterior(start: { x: number; y: number }, end: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }): boolean {
  if (start.x === end.x) {
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    return start.x > rect.x && start.x < rect.x + rect.width && y2 > rect.y && y1 < rect.y + rect.height;
  }
  if (start.y === end.y) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    return start.y > rect.y && start.y < rect.y + rect.height && x2 > rect.x && x1 < rect.x + rect.width;
  }
  return true;
}

function serializedStreetGraphs(graphs: Map<string, InternalStreetGraph>): unknown {
  return [...graphs.values()]
    .sort((a, b) => a.folderId.localeCompare(b.folderId))
    .map((graph) => ({
      folderId: graph.folderId,
      gatewayId: graph.gatewayId,
      spineEdgeIds: graph.spineEdgeIds,
      collectorEdgeIds: graph.collectorEdgeIds,
      spurEdgeIds: graph.spurEdgeIds,
      fileEntryEdgeByFileId: [...graph.fileEntryEdgeByFileId.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      edges: graph.edges.map((edge) => ({
        id: edge.id,
        kind: edge.kind,
        from: edge.from,
        to: edge.to,
        connectedEdgeIds: edge.connectedEdgeIds,
        connectedFileIds: edge.connectedFileIds
      }))
    }));
}

function serializedExternalRoutes(plan: RoutingPlan): unknown {
  return {
    corridorEdges: [...plan.externalCorridorEdges.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        connectedJunctionIds: edge.connectedJunctionIds
      })),
    externalJunctions: [...plan.externalJunctions.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((junction) => ({
        id: junction.id,
        x: junction.x,
        y: junction.y,
        connectedEdgeIds: junction.connectedEdgeIds
      })),
    folderTrunks: [...plan.folderTrunks.values()]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((trunk) => ({
        id: trunk.id,
        providerFolderId: trunk.providerFolderId,
        consumerFolderId: trunk.consumerFolderId,
        providerGatewayId: trunk.providerGatewayId,
        consumerGatewayId: trunk.consumerGatewayId,
        edgeIds: trunk.edgeIds,
        junctionIds: trunk.junctionIds,
        points: trunk.points,
        dependencyIds: trunk.dependencyIds,
        dependencyCount: trunk.dependencyCount,
        symbolCount: trunk.symbolCount,
        providerFileIds: trunk.providerFileIds,
        consumerFileIds: trunk.consumerFileIds,
        dependencyTypes: trunk.dependencyTypes
      }))
  };
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

function acceptanceGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["frontend", "backend"], [], 0),
    folder("frontend", ".", [], ["frontend/ts.ts", "frontend/component.ts"], 1),
    folder("backend", ".", [], ["backend/need_ts.ts", "backend/service.ts"], 1)
  ];
  const graphFiles = [
    file("frontend/ts.ts", "frontend", "utility"),
    file("frontend/component.ts", "frontend", "component"),
    file("backend/need_ts.ts", "backend", "service"),
    file("backend/service.ts", "backend", "service")
  ];
  return projectGraph("acceptance", folders, graphFiles, [
    connection("user", "backend/need_ts.ts", "frontend/ts.ts", "User"),
    connection("role", "backend/service.ts", "frontend/ts.ts", "Role"),
    connection("props", "backend/service.ts", "frontend/component.ts", "ComponentProps")
  ]);
}

function rootFileDependencyGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["src"], ["consumer.ts"], 0),
    folder("src", ".", [], ["src/provider.ts"], 1)
  ];
  const graphFiles = [
    file("consumer.ts", ".", "service"),
    file("src/provider.ts", "src", "utility")
  ];
  return projectGraph("root-file-dependency", folders, graphFiles, [
    connection("root-consumer-provider", "consumer.ts", "src/provider.ts")
  ]);
}

function parentConsumerNestedProviderGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["parent"], [], 0),
    folder("parent", ".", ["parent/shared"], ["parent/consumer.ts"], 1),
    folder("parent/shared", "parent", [], ["parent/shared/provider.ts"], 2)
  ];
  const graphFiles = [
    file("parent/consumer.ts", "parent", "service"),
    file("parent/shared/provider.ts", "parent/shared", "utility")
  ];
  return projectGraph("parent-consumer-nested-provider", folders, graphFiles, [
    connection("consumer-provider", "parent/consumer.ts", "parent/shared/provider.ts")
  ]);
}

function parentConsumerNestedProviderPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "parent", kind: "folder" as const, x: 0, y: 0, width: 660, height: 420 },
      { id: "parent/shared", kind: "folder" as const, parentId: "parent", x: 80, y: 120, width: 260, height: 220 }
    ],
    files: [
      { id: "parent/consumer.ts", kind: "file" as const, parentId: "parent", x: 440, y: 176, width: 132, height: 118 },
      { id: "parent/shared/provider.ts", kind: "file" as const, parentId: "parent/shared", x: 124, y: 176, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function manyDependenciesSamePairGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["config", "auth"], [], 0),
    folder("config", ".", [], ["config/environment.ts"], 1),
    folder("auth", ".", [], ["auth/auth.service.ts"], 1)
  ];
  const graphFiles = [
    file("config/environment.ts", "config", "utility"),
    file("auth/auth.service.ts", "auth", "service")
  ];
  return projectGraph("many-dependencies-one-trunk", folders, graphFiles, Array.from({ length: 10 }, (_, index) => (
    connection(`config-auth-${index + 1}`, "auth/auth.service.ts", "config/environment.ts", `Value${index + 1}`)
  )));
}

function manyDependenciesSamePairPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "config", kind: "folder" as const, x: 0, y: 0, width: 280, height: 240 },
      { id: "auth", kind: "folder" as const, x: 620, y: 0, width: 280, height: 240 }
    ],
    files: [
      { id: "config/environment.ts", kind: "file" as const, parentId: "config", x: 74, y: 82, width: 132, height: 118 },
      { id: "auth/auth.service.ts", kind: "file" as const, parentId: "auth", x: 694, y: 82, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function sharedCorridorTrunkGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["config", "auth", "billing"], [], 0),
    folder("config", ".", [], ["config/environment.ts"], 1),
    folder("auth", ".", [], ["auth/auth.service.ts"], 1),
    folder("billing", ".", [], ["billing/billing.service.ts"], 1)
  ];
  const graphFiles = [
    file("config/environment.ts", "config", "utility"),
    file("auth/auth.service.ts", "auth", "service"),
    file("billing/billing.service.ts", "billing", "service")
  ];
  return projectGraph("shared-corridor-trunks", folders, graphFiles, [
    connection("config-auth", "auth/auth.service.ts", "config/environment.ts"),
    connection("config-billing", "billing/billing.service.ts", "config/environment.ts")
  ]);
}

function sharedCorridorTrunkPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "config", kind: "folder" as const, x: 0, y: 220, width: 280, height: 240 },
      { id: "auth", kind: "folder" as const, x: 620, y: 0, width: 280, height: 240 },
      { id: "billing", kind: "folder" as const, x: 620, y: 420, width: 280, height: 240 }
    ],
    files: [
      { id: "config/environment.ts", kind: "file" as const, parentId: "config", x: 74, y: 302, width: 132, height: 118 },
      { id: "auth/auth.service.ts", kind: "file" as const, parentId: "auth", x: 694, y: 82, width: 132, height: 118 },
      { id: "billing/billing.service.ts", kind: "file" as const, parentId: "billing", x: 694, y: 502, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function nestedTopLevelTrunkGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["alpha", "beta"], [], 0),
    folder("alpha", ".", ["alpha/feature"], [], 1),
    folder("alpha/feature", "alpha", [], ["alpha/feature/provider.ts"], 2),
    folder("beta", ".", ["beta/tests"], [], 1),
    folder("beta/tests", "beta", [], ["beta/tests/consumer.spec.ts"], 2)
  ];
  const graphFiles = [
    file("alpha/feature/provider.ts", "alpha/feature", "utility"),
    file("beta/tests/consumer.spec.ts", "beta/tests", "test")
  ];
  return projectGraph("nested-top-level-trunk", folders, graphFiles, [
    connection("beta-alpha", "beta/tests/consumer.spec.ts", "alpha/feature/provider.ts")
  ]);
}

function nestedTopLevelTrunkPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "alpha", kind: "folder" as const, x: 0, y: 0, width: 480, height: 360 },
      { id: "alpha/feature", kind: "folder" as const, parentId: "alpha", x: 90, y: 96, width: 260, height: 220 },
      { id: "beta", kind: "folder" as const, x: 760, y: 0, width: 480, height: 360 },
      { id: "beta/tests", kind: "folder" as const, parentId: "beta", x: 850, y: 96, width: 260, height: 220 }
    ],
    files: [
      { id: "alpha/feature/provider.ts", kind: "file" as const, parentId: "alpha/feature", x: 154, y: 162, width: 132, height: 118 },
      { id: "beta/tests/consumer.spec.ts", kind: "file" as const, parentId: "beta/tests", x: 914, y: 162, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function sameTopLevelNestedDependencyGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["app"], [], 0),
    folder("app", ".", ["app/provider", "app/consumer"], [], 1),
    folder("app/provider", "app", [], ["app/provider/provider.ts"], 2),
    folder("app/consumer", "app", [], ["app/consumer/consumer.ts"], 2)
  ];
  const graphFiles = [
    file("app/provider/provider.ts", "app/provider", "utility"),
    file("app/consumer/consumer.ts", "app/consumer", "service")
  ];
  return projectGraph("same-top-level-nested", folders, graphFiles, [
    connection("same-top-level", "app/consumer/consumer.ts", "app/provider/provider.ts")
  ]);
}

function sameTopLevelNestedDependencyPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "app", kind: "folder" as const, x: 0, y: 0, width: 700, height: 360 },
      { id: "app/provider", kind: "folder" as const, parentId: "app", x: 70, y: 96, width: 260, height: 220 },
      { id: "app/consumer", kind: "folder" as const, parentId: "app", x: 370, y: 96, width: 260, height: 220 }
    ],
    files: [
      { id: "app/provider/provider.ts", kind: "file" as const, parentId: "app/provider", x: 134, y: 162, width: 132, height: 118 },
      { id: "app/consumer/consumer.ts", kind: "file" as const, parentId: "app/consumer", x: 434, y: 162, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function multiFileStreetGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["providers", "consumers"], [], 0),
    folder("providers", ".", [], ["providers/a.ts", "providers/b.ts"], 1),
    folder("consumers", ".", [], ["consumers/app.ts"], 1)
  ];
  const graphFiles = [
    file("providers/a.ts", "providers", "utility"),
    file("providers/b.ts", "providers", "utility"),
    file("consumers/app.ts", "consumers", "service")
  ];
  return projectGraph("multi-file-streets", folders, graphFiles, [
    connection("app-a", "consumers/app.ts", "providers/a.ts"),
    connection("app-b", "consumers/app.ts", "providers/b.ts")
  ]);
}

function rightGatewayStreetGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["left", "right"], [], 0),
    folder("left", ".", [], ["left/a.ts", "left/b.ts"], 1),
    folder("right", ".", [], ["right/provider.ts"], 1)
  ];
  const graphFiles = [
    file("left/a.ts", "left", "service"),
    file("left/b.ts", "left", "service"),
    file("right/provider.ts", "right", "utility")
  ];
  return projectGraph("right-gateway", folders, graphFiles, [
    connection("a-provider", "left/a.ts", "right/provider.ts"),
    connection("b-provider", "left/b.ts", "right/provider.ts")
  ]);
}

function nestedConnectorGraph(options: { extraChildFiles?: string[]; extraConnections?: ImportConnection[] } = {}): ProjectGraph {
  const childFiles = ["parent/test/spec.ts", ...(options.extraChildFiles ?? [])];
  const folders = [
    folder(".", undefined, ["parent", "peer"], [], 0),
    folder("parent", ".", ["parent/test"], [], 1),
    folder("parent/test", "parent", [], childFiles, 2),
    folder("peer", ".", [], ["peer/consumer.ts"], 1)
  ];
  const graphFiles = [
    ...childFiles.map((fileId) => file(fileId, "parent/test", "test")),
    file("peer/consumer.ts", "peer", "service")
  ];
  return projectGraph("nested-connectors", folders, graphFiles, [
    connection("peer-spec", "peer/consumer.ts", "parent/test/spec.ts"),
    ...(options.extraConnections ?? [])
  ]);
}

function nestedConnectorPlanInput(graph: ProjectGraph, options: { extraFiles?: { id: string; kind: "file"; parentId: string; x: number; y: number; width: number; height: number }[] } = {}) {
  return {
    graph,
    folders: [
      { id: "parent", kind: "folder" as const, x: 0, y: 0, width: 680, height: 420 },
      { id: "parent/test", kind: "folder" as const, parentId: "parent", x: 80, y: 120, width: 440, height: 230 },
      { id: "peer", kind: "folder" as const, x: 860, y: 80, width: 260, height: 220 }
    ],
    files: [
      { id: "parent/test/spec.ts", kind: "file" as const, parentId: "parent/test", x: 130, y: 176, width: 132, height: 118 },
      ...(options.extraFiles ?? []),
      { id: "peer/consumer.ts", kind: "file" as const, parentId: "peer", x: 924, y: 146, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function siblingNestedConnectorGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["parent", "peer"], [], 0),
    folder("parent", ".", ["parent/a", "parent/b"], [], 1),
    folder("parent/a", "parent", [], ["parent/a/a.ts"], 2),
    folder("parent/b", "parent", [], ["parent/b/b.ts"], 2),
    folder("peer", ".", [], ["peer/consumer.ts"], 1)
  ];
  const graphFiles = [
    file("parent/a/a.ts", "parent/a", "test"),
    file("parent/b/b.ts", "parent/b", "test"),
    file("peer/consumer.ts", "peer", "service")
  ];
  return projectGraph("sibling-nested-connectors", folders, graphFiles, [
    connection("peer-a", "peer/consumer.ts", "parent/a/a.ts"),
    connection("peer-b", "peer/consumer.ts", "parent/b/b.ts")
  ]);
}

function siblingNestedConnectorPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "parent", kind: "folder" as const, x: 0, y: 0, width: 660, height: 460 },
      { id: "parent/a", kind: "folder" as const, parentId: "parent", x: 70, y: 120, width: 240, height: 220 },
      { id: "parent/b", kind: "folder" as const, parentId: "parent", x: 360, y: 120, width: 240, height: 220 },
      { id: "peer", kind: "folder" as const, x: 860, y: 100, width: 260, height: 220 }
    ],
    files: [
      { id: "parent/a/a.ts", kind: "file" as const, parentId: "parent/a", x: 124, y: 176, width: 132, height: 118 },
      { id: "parent/b/b.ts", kind: "file" as const, parentId: "parent/b", x: 414, y: 176, width: 132, height: 118 },
      { id: "peer/consumer.ts", kind: "file" as const, parentId: "peer", x: 924, y: 166, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function recursiveNestedConnectorGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["src", "peer"], [], 0),
    folder("src", ".", ["src/feature"], [], 1),
    folder("src/feature", "src", ["src/feature/tests"], [], 2),
    folder("src/feature/tests", "src/feature", ["src/feature/tests/integration"], [], 3),
    folder("src/feature/tests/integration", "src/feature/tests", [], ["src/feature/tests/integration/file.ts"], 4),
    folder("peer", ".", [], ["peer/consumer.ts"], 1)
  ];
  const graphFiles = [
    file("src/feature/tests/integration/file.ts", "src/feature/tests/integration", "test"),
    file("peer/consumer.ts", "peer", "service")
  ];
  return projectGraph("recursive-nested-connectors", folders, graphFiles, [
    connection("peer-integration", "peer/consumer.ts", "src/feature/tests/integration/file.ts")
  ]);
}

function recursiveNestedConnectorPlanInput(graph: ProjectGraph) {
  return {
    graph,
    folders: [
      { id: "src", kind: "folder" as const, x: 0, y: 0, width: 760, height: 560 },
      { id: "src/feature", kind: "folder" as const, parentId: "src", x: 70, y: 90, width: 600, height: 420 },
      { id: "src/feature/tests", kind: "folder" as const, parentId: "src/feature", x: 130, y: 160, width: 460, height: 300 },
      { id: "src/feature/tests/integration", kind: "folder" as const, parentId: "src/feature/tests", x: 190, y: 230, width: 300, height: 190 },
      { id: "peer", kind: "folder" as const, x: 980, y: 110, width: 260, height: 220 }
    ],
    files: [
      { id: "src/feature/tests/integration/file.ts", kind: "file" as const, parentId: "src/feature/tests/integration", x: 274, y: 286, width: 132, height: 118 },
      { id: "peer/consumer.ts", kind: "file" as const, parentId: "peer", x: 1044, y: 176, width: 132, height: 118 }
    ],
    connections: graph.connections,
    throwOnViolation: true
  };
}

function bidirectionalGraph(): ProjectGraph {
  const base = acceptanceGraph();
  return {
    ...base,
    project: { ...base.project, connectionCount: base.connections.length + 1 },
    connections: [...base.connections, connection("backend-contract", "frontend/component.ts", "backend/service.ts", "ServiceContract")]
  };
}

function threeTownGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["alpha", "beta", "gamma"], [], 0),
    folder("alpha", ".", [], ["alpha/provider.ts"], 1),
    folder("beta", ".", [], ["beta/unused.ts"], 1),
    folder("gamma", ".", [], ["gamma/consumer.ts"], 1)
  ];
  const graphFiles = [
    file("alpha/provider.ts", "alpha", "utility"),
    file("beta/unused.ts", "beta", "utility"),
    file("gamma/consumer.ts", "gamma", "service")
  ];
  return projectGraph("three", folders, graphFiles, [
    connection("alpha-gamma", "gamma/consumer.ts", "alpha/provider.ts", "Thing")
  ]);
}

function threeGatewayGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["hub", "north", "east", "south"], [], 0),
    folder("hub", ".", [], ["hub/index.ts"], 1),
    folder("north", ".", [], ["north/provider.ts"], 1),
    folder("east", ".", [], ["east/provider.ts"], 1),
    folder("south", ".", [], ["south/consumer.ts"], 1)
  ];
  const graphFiles = [
    file("hub/index.ts", "hub", "service"),
    file("north/provider.ts", "north", "utility"),
    file("east/provider.ts", "east", "utility"),
    file("south/consumer.ts", "south", "service")
  ];
  return projectGraph("gateway-three", folders, graphFiles, [
    connection("north-hub", "hub/index.ts", "north/provider.ts"),
    connection("east-hub", "hub/index.ts", "east/provider.ts"),
    connection("hub-south", "south/consumer.ts", "hub/index.ts")
  ]);
}

function nestedStreetGraph(): ProjectGraph {
  const folders = [
    folder(".", undefined, ["parent", "peer"], [], 0),
    folder("parent", ".", ["parent/child"], ["parent/local.ts"], 1),
    folder("parent/child", "parent", [], ["parent/child/provider.ts"], 2),
    folder("peer", ".", [], ["peer/consumer.ts"], 1)
  ];
  const graphFiles = [
    file("parent/local.ts", "parent", "service"),
    file("parent/child/provider.ts", "parent/child", "utility"),
    file("peer/consumer.ts", "peer", "service")
  ];
  return projectGraph("nested-streets", folders, graphFiles, [
    connection("parent-peer", "peer/consumer.ts", "parent/local.ts"),
    connection("child-peer", "peer/consumer.ts", "parent/child/provider.ts")
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

function connection(id: string, sourceFileId: string, targetFileId: string, importedName = "default"): ImportConnection {
  return {
    id,
    sourceFileId,
    targetFileId,
    moduleSpecifier: targetFileId,
    symbols: [{ importedName, localName: importedName, isDefault: importedName === "default", isNamespace: false, isTypeOnly: false }],
    type: "runtime",
    isResolved: true,
    isCircular: false
  };
}
