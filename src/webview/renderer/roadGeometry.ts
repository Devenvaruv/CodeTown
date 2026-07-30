import type { LayoutRoad } from "../../graph/layout/elkLayout";

export interface RoadSegment {
  orientation: "horizontal" | "vertical";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function roadPathData(road: LayoutRoad): string {
  return road.points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

export function roadSegments(road: LayoutRoad): RoadSegment[] {
  const segments: RoadSegment[] = [];
  for (let index = 1; index < road.points.length; index += 1) {
    const previous = road.points[index - 1];
    const current = road.points[index];
    if (!previous || !current) {
      continue;
    }
    if (previous.x === current.x && previous.y !== current.y) {
      segments.push({ orientation: "vertical", x1: previous.x, y1: previous.y, x2: current.x, y2: current.y });
    } else if (previous.y === current.y && previous.x !== current.x) {
      segments.push({ orientation: "horizontal", x1: previous.x, y1: previous.y, x2: current.x, y2: current.y });
    }
  }
  return segments;
}
