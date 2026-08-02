import type { LayoutRoad } from "../../graph/layout/elkLayout";

export interface RoadSegment {
  orientation: "horizontal" | "vertical";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const TWO_LANE_ROAD_WIDTH = 7;

type LaneCount = 2 | 4 | 6;

interface OffsetSegment {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export function roadPathData(road: LayoutRoad): string {
  return pathDataForPoints(road.points);
}

export function laneCountForDependencies(count: number): LaneCount {
  if (count >= 21) {
    return 6;
  }
  if (count >= 11) {
    return 4;
  }
  return 2;
}

export function roadLanePathData(road: LayoutRoad, laneCount: LaneCount): string[] {
  return roadPairOffsets(laneCount).map((offset) => pathDataForPoints(offsetRoadPoints(road.points, offset)));
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

function roadPairOffsets(laneCount: LaneCount): number[] {
  const pairCount = laneCount / 2;
  return Array.from({ length: pairCount }, (_, index) => (index - (pairCount - 1) / 2) * TWO_LANE_ROAD_WIDTH);
}

function offsetRoadPoints(points: LayoutRoad["points"], offset: number): LayoutRoad["points"] {
  if (offset === 0 || points.length < 2) {
    return points;
  }

  const segments: OffsetSegment[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) {
      continue;
    }

    const dx = current.x - previous.x;
    const dy = current.y - previous.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
      continue;
    }

    const normalX = -dy / length;
    const normalY = dx / length;
    segments.push({
      from: { x: previous.x + normalX * offset, y: previous.y + normalY * offset },
      to: { x: current.x + normalX * offset, y: current.y + normalY * offset }
    });
  }

  if (segments.length === 0) {
    return points;
  }

  const offsetPoints: LayoutRoad["points"] = [segments[0]!.from];
  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!;
    const current = segments[index]!;
    offsetPoints.push(lineIntersection(previous, current) ?? previous.to);
  }
  offsetPoints.push(segments[segments.length - 1]!.to);
  return offsetPoints;
}

function lineIntersection(first: OffsetSegment, second: OffsetSegment): { x: number; y: number } | undefined {
  const x1 = first.from.x;
  const y1 = first.from.y;
  const x2 = first.to.x;
  const y2 = first.to.y;
  const x3 = second.from.x;
  const y3 = second.from.y;
  const x4 = second.to.x;
  const y4 = second.to.y;
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 0.0001) {
    return undefined;
  }

  const firstDeterminant = x1 * y2 - y1 * x2;
  const secondDeterminant = x3 * y4 - y3 * x4;
  return {
    x: (firstDeterminant * (x3 - x4) - (x1 - x2) * secondDeterminant) / denominator,
    y: (firstDeterminant * (y3 - y4) - (y1 - y2) * secondDeterminant) / denominator
  };
}

function pathDataForPoints(points: LayoutRoad["points"]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${formatCoordinate(point.x)},${formatCoordinate(point.y)}`).join(" ");
}

function formatCoordinate(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? "0" : `${rounded}`;
}
