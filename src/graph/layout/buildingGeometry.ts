export interface BoundsInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const VISIBLE_BUILDING_GEOMETRY = {
  insetX: 16,
  y: 10,
  height: 82,
  roofPeakY: 2,
  roofInsetX: 26
} as const;

export function getVisibleBuildingBounds(node: BoundsInput): Rect {
  return {
    id: node.id,
    x: Math.round(node.x + VISIBLE_BUILDING_GEOMETRY.insetX),
    y: Math.round(node.y + VISIBLE_BUILDING_GEOMETRY.y),
    width: Math.round(node.width - VISIBLE_BUILDING_GEOMETRY.insetX * 2),
    height: VISIBLE_BUILDING_GEOMETRY.height
  };
}
