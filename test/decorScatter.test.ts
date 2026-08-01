import { describe, expect, it } from "vitest";
import type { TownLayout } from "../src/graph/layout/elkLayout";
import { generateDecorScatter } from "../src/webview/renderer/decorScatter";

describe("decor scatter", () => {
  it("is deterministic and avoids padded building and road space", () => {
    const layout = createLayout();
    const first = generateDecorScatter(layout);
    const second = generateDecorScatter(layout);

    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(0);
    expect(first.some((item) => item.hasShadow)).toBe(true);

    for (const item of first) {
      expect(intersects(item, { x: 384, y: 292, width: 52, height: 82 }, 18)).toBe(false);
      expect(intersects(item, { x: 188, y: 288, width: 524, height: 24 }, 18)).toBe(false);
    }
  });

  it("places large items before medium and small items", () => {
    const order = generateDecorScatter(createLayout()).map((item) => item.tier);
    const tierRank = { large: 0, medium: 1, small: 2 };
    expect(order.map((tier) => tierRank[tier])).toEqual([...order.map((tier) => tierRank[tier])].sort((a, b) => a - b));
  });
});

function createLayout(): TownLayout {
  return {
    width: 1200,
    height: 900,
    folders: [],
    files: [
      {
        id: "src/app.ts",
        kind: "file",
        label: "app.ts",
        position: { x: 360, y: 280 },
        x: 360,
        y: 280,
        width: 100,
        height: 128
      }
    ],
    roads: [
      {
        id: "road:one",
        sourceId: "src/app.ts",
        targetId: "src/other.ts",
        level: "file",
        connectionId: "connection:one",
        connectionIds: ["connection:one"],
        points: [
          { x: 200, y: 300 },
          { x: 700, y: 300 }
        ],
        sections: [],
        isAggregated: false,
        dependencyCount: 1,
        routeKind: "trunk",
        participantFileIds: ["src/app.ts", "src/other.ts"],
        symbolCount: 1,
        dependencyTypes: ["runtime"],
        exactRouteIds: ["route:one"],
        infrastructureKind: "external-trunk",
        direction: "provider-to-consumer",
        hasCircularDependency: false
      }
    ],
    buildingPorts: [],
    folderGateways: [],
    routingPlan: {} as TownLayout["routingPlan"],
    roadDebug: {} as TownLayout["roadDebug"],
    layoutWarnings: [],
    usedFallbackLayout: false
  };
}

function intersects(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }, padding: number): boolean {
  return a.x < b.x + b.width + padding && a.x + a.width + padding > b.x && a.y < b.y + b.height + padding && a.y + a.height + padding > b.y;
}
