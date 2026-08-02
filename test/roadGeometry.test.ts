import { describe, expect, it } from "vitest";
import type { LayoutRoad } from "../src/graph/layout/elkLayout";
import { laneCountForDependencies, roadPathData, roadSegments } from "../src/webview/renderer/roadGeometry";

describe("road geometry", () => {
  it.each([
    [10, 2],
    [11, 4],
    [20, 4],
    [21, 6]
  ] as const)("uses %i dependencies to render %i road lanes", (dependencyCount, laneCount) => {
    expect(laneCountForDependencies(dependencyCount)).toBe(laneCount);
  });

  it("keeps source-to-target point order for dependency direction", () => {
    const road = createRoad();
    expect(roadPathData(road)).toBe("M10,20 L40,20 L40,80 L100,80");
  });

  it("segments orthogonal roads for optional horizontal texture overlays", () => {
    const road = createRoad();
    expect(roadSegments(road)).toEqual([
      { orientation: "horizontal", x1: 10, y1: 20, x2: 40, y2: 20 },
      { orientation: "vertical", x1: 40, y1: 20, x2: 40, y2: 80 },
      { orientation: "horizontal", x1: 40, y1: 80, x2: 100, y2: 80 }
    ]);
  });
});

function createRoad(): LayoutRoad {
  return {
    id: "src/a.ts::src/b.ts::runtime::1::0::b:b",
    connectionId: "src/a.ts::src/b.ts::runtime::1::0::b:b",
    connectionIds: ["src/a.ts::src/b.ts::runtime::1::0::b:b"],
    sourceId: "src/a.ts",
    targetId: "src/b.ts",
    level: "file",
    routeKind: "direct",
    points: [
      { x: 10, y: 20 },
      { x: 40, y: 20 },
      { x: 40, y: 80 },
      { x: 100, y: 80 }
    ],
    sections: [
      {
        startPoint: { x: 10, y: 20 },
        bendPoints: [
          { x: 40, y: 20 },
          { x: 40, y: 80 }
        ],
        endPoint: { x: 100, y: 80 }
      }
    ],
    isAggregated: false,
    dependencyCount: 1,
    participantFileIds: ["src/a.ts", "src/b.ts"],
    symbolCount: 1,
    dependencyTypes: ["runtime"],
    exactRouteIds: ["exact:src/a.ts::src/b.ts::runtime::1::0::b:b"],
    infrastructureKind: "legacy-direct",
    direction: "provider-to-consumer",
    hasCircularDependency: false
  };
}
