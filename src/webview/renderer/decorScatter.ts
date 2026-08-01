import { getVisibleBuildingBounds, type Rect } from "../../graph/layout/buildingGeometry";
import type { LayoutNode, TownLayout } from "../../graph/layout/elkLayout";
import type { DecorAssetKind } from "../assets/mapAssets";
import { roadSegments } from "./roadGeometry";

export type DecorSizeTier = "large" | "medium" | "small";

export interface DecorScatterItem {
  id: string;
  kind: DecorAssetKind;
  tier: DecorSizeTier;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  hasShadow: boolean;
}

interface DecorSpec {
  kind: DecorAssetKind;
  tier: DecorSizeTier;
  weight: number;
  width: number;
  height: number;
  minScale: number;
  maxScale: number;
  maxRotation: number;
  hasShadow: boolean;
}

interface DecorGroup {
  tier: DecorSizeTier;
  targetAreaPerItem: number;
  maxCount: number;
  attemptsPerItem: number;
}

const WORLD_MARGIN = 34;
const STRUCTURE_CLEARANCE = 18;
const FOLDER_BORDER_CLEARANCE = 18;
const FILE_LABEL_HEIGHT = 28;

const DECOR_GROUPS: DecorGroup[] = [
  { tier: "large", targetAreaPerItem: 150_000, maxCount: 60, attemptsPerItem: 36 },
  { tier: "medium", targetAreaPerItem: 90_000, maxCount: 90, attemptsPerItem: 30 },
  { tier: "small", targetAreaPerItem: 42_000, maxCount: 180, attemptsPerItem: 24 }
];

const DECOR_SPECS: DecorSpec[] = [
  { kind: "natureTreePine", tier: "large", weight: 5, width: 76, height: 116, minScale: 0.88, maxScale: 1.15, maxRotation: 5, hasShadow: true },
  { kind: "natureTreeBroadleaf", tier: "large", weight: 5, width: 94, height: 104, minScale: 0.88, maxScale: 1.12, maxRotation: 5, hasShadow: true },
  { kind: "natureFallenLog", tier: "large", weight: 2, width: 122, height: 48, minScale: 0.9, maxScale: 1.12, maxRotation: 18, hasShadow: true },
  { kind: "natureBushCluster", tier: "medium", weight: 6, width: 72, height: 54, minScale: 0.86, maxScale: 1.16, maxRotation: 12, hasShadow: false },
  { kind: "groundRockCluster", tier: "medium", weight: 4, width: 66, height: 44, minScale: 0.82, maxScale: 1.18, maxRotation: 18, hasShadow: false },
  { kind: "groundGrassPatchSoft", tier: "small", weight: 7, width: 48, height: 30, minScale: 0.78, maxScale: 1.22, maxRotation: 180, hasShadow: false },
  { kind: "groundGrassPatchTall", tier: "small", weight: 6, width: 42, height: 38, minScale: 0.78, maxScale: 1.18, maxRotation: 32, hasShadow: false },
  { kind: "groundMossPatch", tier: "small", weight: 4, width: 54, height: 32, minScale: 0.8, maxScale: 1.2, maxRotation: 180, hasShadow: false },
  { kind: "groundDirtPatch", tier: "small", weight: 3, width: 58, height: 34, minScale: 0.82, maxScale: 1.24, maxRotation: 180, hasShadow: false },
  { kind: "natureFlowerPatch", tier: "small", weight: 3, width: 42, height: 32, minScale: 0.8, maxScale: 1.18, maxRotation: 40, hasShadow: false },
  { kind: "natureMushroomCluster", tier: "small", weight: 2, width: 38, height: 30, minScale: 0.78, maxScale: 1.12, maxRotation: 24, hasShadow: false }
];

export function generateDecorScatter(layout: TownLayout): DecorScatterItem[] {
  if (layout.width <= WORLD_MARGIN * 2 || layout.height <= WORLD_MARGIN * 2) {
    return [];
  }

  const random = seededRandom(seedForLayout(layout));
  const occupiedRects = layoutObstacleRects(layout);
  const decorRects: Rect[] = [];
  const items: DecorScatterItem[] = [];
  const mapArea = layout.width * layout.height;

  for (const group of DECOR_GROUPS) {
    const specs = DECOR_SPECS.filter((spec) => spec.tier === group.tier);
    const targetCount = Math.min(group.maxCount, Math.floor(mapArea / group.targetAreaPerItem));
    const maxAttempts = Math.max(0, targetCount * group.attemptsPerItem);
    let attempts = 0;

    while (items.filter((item) => item.tier === group.tier).length < targetCount && attempts < maxAttempts) {
      attempts += 1;
      const spec = weightedPick(specs, random);
      const scale = spec.minScale + random() * (spec.maxScale - spec.minScale);
      const width = Math.round(spec.width * scale);
      const height = Math.round(spec.height * scale);
      const x = Math.round(WORLD_MARGIN + random() * Math.max(0, layout.width - WORLD_MARGIN * 2 - width));
      const y = Math.round(WORLD_MARGIN + random() * Math.max(0, layout.height - WORLD_MARGIN * 2 - height));
      const rect = { id: `${spec.kind}:${items.length}`, x, y, width, height };

      if (intersectsAny(rect, occupiedRects, STRUCTURE_CLEARANCE) || intersectsAny(rect, decorRects, decorClearanceForTier(group.tier))) {
        continue;
      }

      decorRects.push(rect);
      items.push({
        id: rect.id,
        kind: spec.kind,
        tier: spec.tier,
        x,
        y,
        width,
        height,
        rotation: Math.round((random() * 2 - 1) * spec.maxRotation),
        hasShadow: spec.hasShadow
      });
    }
  }

  return items.sort((a, b) => tierOrder(a.tier) - tierOrder(b.tier) || a.y + a.height - (b.y + b.height) || a.id.localeCompare(b.id));
}

function layoutObstacleRects(layout: TownLayout): Rect[] {
  return [
    ...folderBorderRects(layout.folders),
    ...layout.files.flatMap(fileObstacleRects),
    ...layout.roads.flatMap((road) =>
      roadSegments(road).map((segment, index) => {
        const roadWidth = road.routeKind === "trunk" ? 24 : road.routeKind === "branch" ? 14 : 18;
        const minX = Math.min(segment.x1, segment.x2);
        const minY = Math.min(segment.y1, segment.y2);
        const width = Math.abs(segment.x2 - segment.x1);
        const height = Math.abs(segment.y2 - segment.y1);
        return {
          id: `${road.id}:segment:${index}`,
          x: Math.round(minX - roadWidth / 2),
          y: Math.round(minY - roadWidth / 2),
          width: Math.round(width + roadWidth),
          height: Math.round(height + roadWidth)
        };
      })
    )
  ];
}

function fileObstacleRects(file: LayoutNode): Rect[] {
  const building = getVisibleBuildingBounds(file);
  return [
    building,
    {
      id: `${file.id}:label`,
      x: Math.round(file.x),
      y: Math.round(file.y + 88),
      width: Math.round(file.width),
      height: FILE_LABEL_HEIGHT
    }
  ];
}

function folderBorderRects(folders: LayoutNode[]): Rect[] {
  return folders.flatMap((folder) => [
    { id: `${folder.id}:border-top`, x: folder.x, y: folder.y - FOLDER_BORDER_CLEARANCE / 2, width: folder.width, height: FOLDER_BORDER_CLEARANCE },
    { id: `${folder.id}:border-bottom`, x: folder.x, y: folder.y + folder.height - FOLDER_BORDER_CLEARANCE / 2, width: folder.width, height: FOLDER_BORDER_CLEARANCE },
    { id: `${folder.id}:border-left`, x: folder.x - FOLDER_BORDER_CLEARANCE / 2, y: folder.y, width: FOLDER_BORDER_CLEARANCE, height: folder.height },
    { id: `${folder.id}:border-right`, x: folder.x + folder.width - FOLDER_BORDER_CLEARANCE / 2, y: folder.y, width: FOLDER_BORDER_CLEARANCE, height: folder.height }
  ]);
}

function weightedPick(specs: DecorSpec[], random: () => number): DecorSpec {
  const totalWeight = specs.reduce((sum, spec) => sum + spec.weight, 0);
  let threshold = random() * totalWeight;
  for (const spec of specs) {
    threshold -= spec.weight;
    if (threshold <= 0) {
      return spec;
    }
  }
  return specs[specs.length - 1]!;
}

function intersectsAny(rect: Rect, others: Rect[], padding: number): boolean {
  return others.some((other) => rectsIntersect(rect, other, padding));
}

function rectsIntersect(a: Rect, b: Rect, padding: number): boolean {
  return (
    a.x < b.x + b.width + padding &&
    a.x + a.width + padding > b.x &&
    a.y < b.y + b.height + padding &&
    a.y + a.height + padding > b.y
  );
}

function decorClearanceForTier(tier: DecorSizeTier): number {
  switch (tier) {
    case "large":
      return 8;
    case "medium":
      return 2;
    case "small":
      return -5;
  }
}

function tierOrder(tier: DecorSizeTier): number {
  switch (tier) {
    case "large":
      return 0;
    case "medium":
      return 1;
    case "small":
      return 2;
  }
}

function seedForLayout(layout: TownLayout): number {
  const source = [
    layout.width,
    layout.height,
    ...layout.files.map((node) => `${node.id}:${Math.round(node.x)},${Math.round(node.y)},${Math.round(node.width)},${Math.round(node.height)}`),
    ...layout.folders.map((node) => `${node.id}:${Math.round(node.x)},${Math.round(node.y)},${Math.round(node.width)},${Math.round(node.height)}`),
    ...layout.roads.map((road) => `${road.id}:${road.points.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join("|")}`)
  ].join(";");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
