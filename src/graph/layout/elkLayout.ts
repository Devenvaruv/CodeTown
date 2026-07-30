import type { FileNode, FolderNode, ImportConnection, ProjectGraph } from "../../shared/graphTypes";

export type LayoutDirection = "RIGHT" | "DOWN";

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraphNode {
  id: string;
  kind: "folder" | "file";
  label: string;
  parentId?: string;
  width?: number;
  height?: number;
  collapsed?: boolean;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  level?: "folder" | "file";
  connectionId?: string;
  connectionIds?: string[];
  dependencyCount?: number;
  isAggregated?: boolean;
}

export interface GraphLayoutOptions {
  direction?: LayoutDirection;
  previousPositions?: Map<string, Point>;
}

export interface LayoutDebugInfo {
  parentId?: string;
  localX: number;
  localY: number;
  worldX: number;
  worldY: number;
  width: number;
  height: number;
  columns?: number;
}

export interface RoutedEdgeSection {
  startPoint: Point;
  bendPoints: Point[];
  endPoint: Point;
}

export interface PositionedGraphNode extends GraphNode {
  position: Point;
  x: number;
  y: number;
  width: number;
  height: number;
  layoutDebug?: LayoutDebugInfo;
}

export interface RoutedGraphEdge extends GraphEdge {
  sections: RoutedEdgeSection[];
  points: Point[];
}

export interface LayoutResult {
  nodes: PositionedGraphNode[];
  edges: RoutedGraphEdge[];
  width: number;
  height: number;
  layoutWarnings: string[];
  usedFallbackLayout: boolean;
}

export interface LayoutNode extends PositionedGraphNode {
  kind: "folder" | "file";
}

export interface LayoutRoad extends RoutedGraphEdge {
  connectionId: string;
  sourceId: string;
  targetId: string;
  level: "folder" | "file";
  points: Point[];
  isAggregated: boolean;
  dependencyCount: number;
}

export interface TownLayout {
  width: number;
  height: number;
  folders: LayoutNode[];
  files: LayoutNode[];
  roads: LayoutRoad[];
  layoutWarnings: string[];
  usedFallbackLayout: boolean;
}

export interface TownLayoutOptions extends GraphLayoutOptions {
  visibleConnections?: ImportConnection[];
}

export const GRID_LAYOUT_CONSTANTS = {
  fileWidth: 96,
  fileHeight: 110,
  horizontalGap: 48,
  verticalGap: 56,
  folderPadding: 56,
  folderHeaderHeight: 48,
  folderGap: 120,
  maxFolderColumns: 4,
  maxTopLevelColumns: 4,
  targetTopLevelWidth: 1680,
  minBuildingWidth: 64,
  minBuildingHeight: 72
} as const;

const ROOT_ID = "root";
const COLLAPSED_FOLDER_SIZE = { width: 240, height: 130 };
const EMPTY_FOLDER_SIZE = { width: 240, height: 130 };
const WORLD_PADDING = 80;
const MAX_FOLDER_ASPECT = 2.5;

interface MeasuredPlacement {
  id: string;
  localX: number;
  localY: number;
  columns?: number;
}

interface MeasuredFolder {
  node: GraphNode;
  childFolders: MeasuredFolder[];
  directFiles: GraphNode[];
  filePlacements: MeasuredPlacement[];
  folderPlacements: MeasuredPlacement[];
  width: number;
  height: number;
}

interface GridItem {
  id: string;
  width: number;
  height: number;
}

interface GridPlacement extends MeasuredPlacement {
  width: number;
  height: number;
}

interface GridMeasurement {
  columns: number;
  width: number;
  height: number;
  placements: GridPlacement[];
}

export async function layoutGraph(nodes: GraphNode[], edges: GraphEdge[], options: GraphLayoutOptions = {}): Promise<LayoutResult> {
  const cleanNodes = normalizeHierarchy(dedupeNodes(nodes));
  const cleanNodeMap = new Map(cleanNodes.map((node) => [node.id, node]));
  const cleanEdges = dedupeEdges(edges, cleanNodeMap);
  const measuredForest = measureForest(cleanNodes);
  const positionedNodes = positionMeasuredForest(measuredForest, cleanNodes, options.direction);
  const layoutWarnings = validatePositionedLayout(positionedNodes, cleanNodes);

  if (layoutWarnings.length > 0) {
    return fallbackLayout(cleanNodes, cleanEdges, layoutWarnings);
  }

  const routedEdges = routeEdgesFromPositionedNodes(cleanEdges, positionedNodes);
  return layoutResult(positionedNodes, routedEdges, [], false);
}

export async function buildTownLayout(graph: ProjectGraph, expandedFolderIds: Set<string>, options: TownLayoutOptions = {}): Promise<TownLayout> {
  const visibleGraph = createVisibleProjectGraph(graph, expandedFolderIds, options.visibleConnections ?? graph.connections);
  const result = await layoutGraph(visibleGraph.nodes, [], options);
  const folders = result.nodes.filter((node): node is LayoutNode => node.kind === "folder");
  const files = result.nodes.filter((node): node is LayoutNode => node.kind === "file");
  const routedEdges = result.layoutWarnings.length > 0 ? [] : routeEdgesFromPositionedNodes(visibleGraph.edges, result.nodes);
  const roads = routedEdges.map((edge): LayoutRoad => ({
    ...edge,
    connectionId: edge.connectionId ?? edge.connectionIds?.[0] ?? edge.id,
    connectionIds: edge.connectionIds ?? (edge.connectionId ? [edge.connectionId] : []),
    level: edge.level ?? "file",
    isAggregated: edge.isAggregated ?? false,
    dependencyCount: edge.dependencyCount ?? 1
  }));

  return {
    width: Math.max(result.width, 860),
    height: Math.max(result.height, 640),
    folders,
    files,
    roads,
    layoutWarnings: result.layoutWarnings,
    usedFallbackLayout: result.usedFallbackLayout
  };
}

export function createVisibleProjectGraph(graph: ProjectGraph, expandedFolderIds: Set<string>, connections: ImportConnection[] = graph.connections): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const foldersById = new Map(graph.folders.map((folder) => [folder.id, folder]));
  const filesById = new Map(graph.files.map((file) => [file.id, file]));
  const expanded = new Set(expandedFolderIds);
  expanded.add(".");

  const visibleFolderIds = new Set(
    graph.folders
      .filter((folder) => folder.id !== "." && isFolderReachable(folder, foldersById, expanded))
      .map((folder) => folder.id)
  );
  const visibleFileIds = new Set(
    graph.files
      .filter((file) => isFileVisible(file, foldersById, visibleFolderIds, expanded))
      .map((file) => file.id)
  );

  const nodes: GraphNode[] = [
    ...graph.folders
      .filter((folder) => visibleFolderIds.has(folder.id))
      .map((folder): GraphNode => ({
        id: folder.id,
        kind: "folder",
        label: folder.name,
        parentId: folder.parentFolderId && visibleFolderIds.has(folder.parentFolderId) ? folder.parentFolderId : undefined,
        collapsed: !expanded.has(folder.id)
      })),
    ...graph.files
      .filter((file) => visibleFileIds.has(file.id))
      .map((file): GraphNode => ({
        id: file.id,
        kind: "file",
        label: file.name,
        parentId: file.folderId !== "." && visibleFolderIds.has(file.folderId) ? file.folderId : undefined,
        width: GRID_LAYOUT_CONSTANTS.fileWidth,
        height: GRID_LAYOUT_CONSTANTS.fileHeight
      }))
  ].sort(compareNodes);

  const edgesByKey = new Map<string, GraphEdge>();
  for (const connection of connections) {
    if (!connection.targetFileId) {
      continue;
    }
    addVisualEdge(edgesByKey, connection, "file", visibleAnchorForFile(connection.targetFileId, filesById, foldersById, visibleFileIds, visibleFolderIds, expanded), visibleAnchorForFile(connection.sourceFileId, filesById, foldersById, visibleFileIds, visibleFolderIds, expanded));
    addVisualEdge(edgesByKey, connection, "folder", visibleFolderAnchorForFile(connection.targetFileId, filesById, foldersById, visibleFolderIds), visibleFolderAnchorForFile(connection.sourceFileId, filesById, foldersById, visibleFolderIds));
  }

  return { nodes, edges: [...edgesByKey.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

function measureForest(nodes: GraphNode[]): { topFolders: MeasuredFolder[]; topFiles: GraphNode[] } {
  const folders = nodes.filter((node) => node.kind === "folder");
  const files = nodes.filter((node) => node.kind === "file");
  const folderTrees = new Map(folders.map((node): [string, MeasuredFolder] => [
    node.id,
    {
      node,
      childFolders: [],
      directFiles: [],
      filePlacements: [],
      folderPlacements: [],
      width: EMPTY_FOLDER_SIZE.width,
      height: EMPTY_FOLDER_SIZE.height
    }
  ]));
  const topFolders: MeasuredFolder[] = [];
  const topFiles: GraphNode[] = [];

  for (const folder of folders) {
    const measured = folderTrees.get(folder.id);
    if (!measured) {
      continue;
    }
    const parent = folder.parentId ? folderTrees.get(folder.parentId) : undefined;
    if (parent) {
      parent.childFolders.push(measured);
    } else {
      topFolders.push(measured);
    }
  }

  for (const file of files) {
    const parent = file.parentId ? folderTrees.get(file.parentId) : undefined;
    if (parent) {
      parent.directFiles.push(file);
    } else {
      topFiles.push(file);
    }
  }

  for (const folder of [...topFolders].sort((a, b) => a.node.id.localeCompare(b.node.id))) {
    measureFolder(folder);
  }

  return {
    topFolders: topFolders.sort((a, b) => a.node.id.localeCompare(b.node.id)),
    topFiles: topFiles.sort((a, b) => a.id.localeCompare(b.id))
  };
}

function measureFolder(folder: MeasuredFolder): void {
  folder.directFiles.sort(compareNodes);
  folder.childFolders.sort((a, b) => a.node.id.localeCompare(b.node.id));
  for (const child of folder.childFolders) {
    measureFolder(child);
  }

  if (folder.node.collapsed) {
    folder.width = COLLAPSED_FOLDER_SIZE.width;
    folder.height = COLLAPSED_FOLDER_SIZE.height;
    folder.filePlacements = [];
    folder.folderPlacements = [];
    return;
  }

  const padding = GRID_LAYOUT_CONSTANTS.folderPadding;
  const contentY = GRID_LAYOUT_CONSTANTS.folderHeaderHeight + padding;
  const fileGrid = measureFixedFileGrid(folder.directFiles);
  const childGridStartY = contentY + (fileGrid.height > 0 ? fileGrid.height + GRID_LAYOUT_CONSTANTS.verticalGap : 0);
  const childGrid = measureVariableGrid(
    folder.childFolders.map((child) => ({ id: child.node.id, width: child.width, height: child.height })),
    chooseChildFolderColumns(folder.childFolders, fileGrid),
    GRID_LAYOUT_CONSTANTS.horizontalGap,
    GRID_LAYOUT_CONSTANTS.verticalGap
  );

  folder.filePlacements = fileGrid.placements.map((placement) => ({
    ...placement,
    localX: padding + placement.localX,
    localY: contentY + placement.localY
  }));
  folder.folderPlacements = childGrid.placements.map((placement) => ({
    ...placement,
    localX: padding + placement.localX,
    localY: childGridStartY + placement.localY
  }));

  const contentWidth = Math.max(fileGrid.width, childGrid.width);
  const contentHeight = fileGrid.height + (fileGrid.height > 0 && childGrid.height > 0 ? GRID_LAYOUT_CONSTANTS.verticalGap : 0) + childGrid.height;
  folder.width = Math.max(EMPTY_FOLDER_SIZE.width, contentWidth + padding * 2);
  folder.height = Math.max(EMPTY_FOLDER_SIZE.height, GRID_LAYOUT_CONSTANTS.folderHeaderHeight + padding * 2 + contentHeight);
}

function chooseChildFolderColumns(children: MeasuredFolder[], fileGrid: GridMeasurement): number {
  if (children.length <= 1) {
    return children.length;
  }

  const maxColumns = Math.min(GRID_LAYOUT_CONSTANTS.maxFolderColumns, children.length);
  let bestColumns = Math.min(maxColumns, Math.ceil(Math.sqrt(children.length)));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columns = 1; columns <= maxColumns; columns += 1) {
    const grid = measureVariableGrid(
      children.map((child) => ({ id: child.node.id, width: child.width, height: child.height })),
      columns,
      GRID_LAYOUT_CONSTANTS.horizontalGap,
      GRID_LAYOUT_CONSTANTS.verticalGap
    );
    const contentHeight = fileGrid.height + (fileGrid.height > 0 && grid.height > 0 ? GRID_LAYOUT_CONSTANTS.verticalGap : 0) + grid.height;
    const width = Math.max(fileGrid.width, grid.width) + GRID_LAYOUT_CONSTANTS.folderPadding * 2;
    const height = GRID_LAYOUT_CONSTANTS.folderHeaderHeight + GRID_LAYOUT_CONSTANTS.folderPadding * 2 + contentHeight;
    const aspect = height / Math.max(1, width);
    const aspectPenalty = aspect > MAX_FOLDER_ASPECT ? 1000 + aspect * 100 : Math.abs(1.25 - aspect) * 10;
    const widthPenalty = columns > 1 ? grid.width / 10000 : 0;
    const score = aspectPenalty + widthPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestColumns;
}

function measureFixedFileGrid(files: GraphNode[]): GridMeasurement {
  if (files.length === 0) {
    return { columns: 0, width: 0, height: 0, placements: [] };
  }

  const columns = Math.min(GRID_LAYOUT_CONSTANTS.maxFolderColumns, Math.ceil(Math.sqrt(files.length)));
  const rows = Math.ceil(files.length / columns);
  const placements = files.map((file, index): GridPlacement => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: file.id,
      localX: column * (GRID_LAYOUT_CONSTANTS.fileWidth + GRID_LAYOUT_CONSTANTS.horizontalGap),
      localY: row * (GRID_LAYOUT_CONSTANTS.fileHeight + GRID_LAYOUT_CONSTANTS.verticalGap),
      width: GRID_LAYOUT_CONSTANTS.fileWidth,
      height: GRID_LAYOUT_CONSTANTS.fileHeight,
      columns
    };
  });

  return {
    columns,
    width: columns * GRID_LAYOUT_CONSTANTS.fileWidth + (columns - 1) * GRID_LAYOUT_CONSTANTS.horizontalGap,
    height: rows * GRID_LAYOUT_CONSTANTS.fileHeight + (rows - 1) * GRID_LAYOUT_CONSTANTS.verticalGap,
    placements
  };
}

function measureVariableGrid(items: GridItem[], columns: number, horizontalGap: number, verticalGap: number): GridMeasurement {
  if (items.length === 0 || columns <= 0) {
    return { columns: 0, width: 0, height: 0, placements: [] };
  }

  const boundedColumns = Math.max(1, Math.min(columns, items.length));
  const columnWidths = Array.from({ length: boundedColumns }, () => 0);
  const rowCount = Math.ceil(items.length / boundedColumns);
  const rowHeights = Array.from({ length: rowCount }, () => 0);

  items.forEach((item, index) => {
    const column = index % boundedColumns;
    const row = Math.floor(index / boundedColumns);
    columnWidths[column] = Math.max(columnWidths[column] ?? 0, item.width);
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, item.height);
  });

  const columnX = prefixOffsets(columnWidths, horizontalGap);
  const rowY = prefixOffsets(rowHeights, verticalGap);
  const placements = items.map((item, index): GridPlacement => {
    const column = index % boundedColumns;
    const row = Math.floor(index / boundedColumns);
    return {
      id: item.id,
      localX: columnX[column] ?? 0,
      localY: rowY[row] ?? 0,
      width: item.width,
      height: item.height,
      columns: boundedColumns
    };
  });

  return {
    columns: boundedColumns,
    width: sum(columnWidths) + (boundedColumns - 1) * horizontalGap,
    height: sum(rowHeights) + (rowCount - 1) * verticalGap,
    placements
  };
}

function positionMeasuredForest(forest: { topFolders: MeasuredFolder[]; topFiles: GraphNode[] }, nodes: GraphNode[], direction: LayoutDirection | undefined): PositionedGraphNode[] {
  const topItems: GridItem[] = [
    ...forest.topFolders.map((folder) => ({ id: folder.node.id, width: folder.width, height: folder.height })),
    ...forest.topFiles.map((file) => ({ id: file.id, width: GRID_LAYOUT_CONSTANTS.fileWidth, height: GRID_LAYOUT_CONSTANTS.fileHeight }))
  ];
  const topColumns = chooseTopLevelColumns(topItems, direction, forest.topFolders.length > 0);
  const topGrid = measureVariableGrid(topItems, topColumns, GRID_LAYOUT_CONSTANTS.folderGap, GRID_LAYOUT_CONSTANTS.folderGap);
  const topPlacements = new Map(topGrid.placements.map((placement) => [placement.id, placement]));
  const folderById = new Map(forest.topFolders.map((folder) => [folder.node.id, folder]));
  const fileById = new Map(forest.topFiles.map((file) => [file.id, file]));
  const output: PositionedGraphNode[] = [];

  for (const item of topItems) {
    const placement = topPlacements.get(item.id);
    if (!placement) {
      continue;
    }
    const worldX = WORLD_PADDING + placement.localX;
    const worldY = WORLD_PADDING + placement.localY;
    const folder = folderById.get(item.id);
    if (folder) {
      positionFolder(folder, undefined, placement.localX, placement.localY, worldX, worldY, output);
      continue;
    }

    const file = fileById.get(item.id);
    if (file) {
      output.push(positionedNode(file, undefined, placement.localX, placement.localY, worldX, worldY, GRID_LAYOUT_CONSTANTS.fileWidth, GRID_LAYOUT_CONSTANTS.fileHeight, topGrid.columns));
    }
  }

  const missingTopNodes = nodes.filter((node) => !output.some((positioned) => positioned.id === node.id));
  for (const missing of missingTopNodes) {
    output.push(positionedNode(missing, undefined, 0, 0, WORLD_PADDING, WORLD_PADDING, fallbackWidth(missing), fallbackHeight(missing)));
  }

  return output.sort(comparePositionedNodes);
}

function chooseTopLevelColumns(items: GridItem[], direction: LayoutDirection | undefined, hasFolders: boolean): number {
  if (items.length <= 1) {
    return items.length;
  }
  if (direction === "DOWN" && !hasFolders) {
    return 1;
  }

  const minColumns = hasFolders ? Math.min(2, items.length) : 1;
  const maxColumns = Math.min(GRID_LAYOUT_CONSTANTS.maxTopLevelColumns, items.length);
  let bestColumns = Math.max(minColumns, Math.min(maxColumns, Math.ceil(Math.sqrt(items.length))));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columns = minColumns; columns <= maxColumns; columns += 1) {
    const grid = measureVariableGrid(items, columns, GRID_LAYOUT_CONSTANTS.folderGap, GRID_LAYOUT_CONSTANTS.folderGap);
    const rowWidths = rowWidthsForItems(items, columns);
    const averageRowWidth = sum(rowWidths) / rowWidths.length;
    const variance = sum(rowWidths.map((width) => Math.abs(width - averageRowWidth))) / Math.max(1, rowWidths.length);
    const targetPenalty = Math.abs(grid.width - GRID_LAYOUT_CONSTANTS.targetTopLevelWidth) / 100;
    const aspect = grid.height / Math.max(1, grid.width);
    const score = variance / 100 + targetPenalty + Math.abs(0.7 - aspect) * 20;
    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestColumns;
}

function positionFolder(folder: MeasuredFolder, parentId: string | undefined, localX: number, localY: number, worldX: number, worldY: number, output: PositionedGraphNode[]): void {
  output.push(positionedNode(folder.node, parentId, localX, localY, worldX, worldY, folder.width, folder.height));

  const filesById = new Map(folder.directFiles.map((file) => [file.id, file]));
  for (const placement of folder.filePlacements) {
    const file = filesById.get(placement.id);
    if (!file) {
      continue;
    }
    positionFile(file, folder.node.id, placement, worldX, worldY, output);
  }

  const foldersById = new Map(folder.childFolders.map((child) => [child.node.id, child]));
  for (const placement of folder.folderPlacements) {
    const child = foldersById.get(placement.id);
    if (!child) {
      continue;
    }
    positionFolder(child, folder.node.id, placement.localX, placement.localY, worldX + placement.localX, worldY + placement.localY, output);
  }
}

function positionFile(file: GraphNode, parentId: string | undefined, placement: MeasuredPlacement, parentWorldX: number, parentWorldY: number, output: PositionedGraphNode[]): void {
  output.push(positionedNode(file, parentId, placement.localX, placement.localY, parentWorldX + placement.localX, parentWorldY + placement.localY, GRID_LAYOUT_CONSTANTS.fileWidth, GRID_LAYOUT_CONSTANTS.fileHeight, placement.columns));
}

function positionedNode(node: GraphNode, parentId: string | undefined, localX: number, localY: number, worldX: number, worldY: number, width: number, height: number, columns?: number): PositionedGraphNode {
  return {
    ...node,
    parentId,
    position: { x: Math.round(worldX), y: Math.round(worldY) },
    x: Math.round(worldX),
    y: Math.round(worldY),
    width: Math.round(width),
    height: Math.round(height),
    layoutDebug: {
      parentId,
      localX: Math.round(localX),
      localY: Math.round(localY),
      worldX: Math.round(worldX),
      worldY: Math.round(worldY),
      width: Math.round(width),
      height: Math.round(height),
      columns
    }
  };
}

function validatePositionedLayout(positionedNodes: PositionedGraphNode[], sourceNodes: GraphNode[]): string[] {
  const warnings: string[] = [];
  const files = positionedNodes.filter((node) => node.kind === "file");
  const expectedFiles = sourceNodes.filter((node) => node.kind === "file").length;
  if (files.length !== expectedFiles) {
    warnings.push(`Rendered building count ${files.length} does not match visible file count ${expectedFiles}.`);
  }

  for (const file of files) {
    if (file.width < GRID_LAYOUT_CONSTANTS.minBuildingWidth) {
      warnings.push(`Building ${file.id} width ${file.width} is below ${GRID_LAYOUT_CONSTANTS.minBuildingWidth}.`);
    }
    if (file.height < GRID_LAYOUT_CONSTANTS.minBuildingHeight) {
      warnings.push(`Building ${file.id} height ${file.height} is below ${GRID_LAYOUT_CONSTANTS.minBuildingHeight}.`);
    }
  }

  const nodesById = new Map(positionedNodes.map((node) => [node.id, node]));
  for (const node of positionedNodes) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y) || !Number.isFinite(node.width) || !Number.isFinite(node.height)) {
      warnings.push(`Node ${node.id} has non-finite bounds.`);
      continue;
    }
    if (node.parentId) {
      const parent = nodesById.get(node.parentId);
      if (!parent) {
        warnings.push(`Node ${node.id} references missing parent ${node.parentId}.`);
      } else if (!containsRect(parent, node)) {
        warnings.push(`Node ${node.id} is outside parent ${node.parentId}.`);
      }
    }
  }

  const filesByParent = groupBy(files, (file) => file.parentId ?? ROOT_ID);
  for (const [parentId, siblings] of filesByParent) {
    const coordinateGuard = new Map<string, string>();
    for (const file of siblings) {
      const key = `${file.layoutDebug?.localX ?? file.x}:${file.layoutDebug?.localY ?? file.y}`;
      const existing = coordinateGuard.get(key);
      if (existing) {
        warnings.push(`Buildings ${existing} and ${file.id} share coordinates inside ${parentId}.`);
      }
      coordinateGuard.set(key, file.id);
    }

    for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
        const left = siblings[leftIndex];
        const right = siblings[rightIndex];
        if (left && right && rectsOverlap(left, right)) {
          warnings.push(`Buildings ${left.id} and ${right.id} overlap inside ${parentId}.`);
        }
      }
    }
  }

  for (const folder of positionedNodes.filter((node) => node.kind === "folder")) {
    const directChildren = positionedNodes.filter((node) => node.parentId === folder.id);
    if (directChildren.length > 1 && folder.height > folder.width * MAX_FOLDER_ASPECT) {
      warnings.push(`Folder ${folder.id} aspect ratio ${Math.round((folder.height / folder.width) * 100) / 100} is too tall.`);
    }
  }

  return warnings;
}

function fallbackLayout(nodes: GraphNode[], edges: GraphEdge[], originalWarnings: string[]): LayoutResult {
  const items = nodes.map((node) => ({ id: node.id, width: fallbackWidth(node), height: fallbackHeight(node) }));
  const columns = Math.min(GRID_LAYOUT_CONSTANTS.maxTopLevelColumns, Math.max(1, Math.ceil(Math.sqrt(items.length))));
  const grid = measureVariableGrid(items, columns, GRID_LAYOUT_CONSTANTS.folderGap, GRID_LAYOUT_CONSTANTS.folderGap);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const positionedNodes = grid.placements
    .map((placement) => {
      const node = nodesById.get(placement.id);
      return node ? positionedNode(node, undefined, placement.localX, placement.localY, WORLD_PADDING + placement.localX, WORLD_PADDING + placement.localY, fallbackWidth(node), fallbackHeight(node), grid.columns) : undefined;
    })
    .filter((node): node is PositionedGraphNode => Boolean(node))
    .sort(comparePositionedNodes);
  const routedEdges = routeEdgesFromPositionedNodes(edges, positionedNodes);
  return layoutResult(positionedNodes, routedEdges, originalWarnings, true);
}

function layoutResult(nodes: PositionedGraphNode[], edges: RoutedGraphEdge[], layoutWarnings: string[], usedFallbackLayout: boolean): LayoutResult {
  const maxX = Math.max(0, ...nodes.map((node) => node.x + node.width), ...edges.flatMap((edge) => edge.points.map((point) => point.x)));
  const maxY = Math.max(0, ...nodes.map((node) => node.y + node.height), ...edges.flatMap((edge) => edge.points.map((point) => point.y)));
  return {
    nodes: nodes.sort(comparePositionedNodes),
    edges,
    width: Math.ceil(maxX + WORLD_PADDING),
    height: Math.ceil(maxY + WORLD_PADDING),
    layoutWarnings,
    usedFallbackLayout
  };
}

function fallbackWidth(node: GraphNode): number {
  if (node.kind === "file") {
    return GRID_LAYOUT_CONSTANTS.fileWidth;
  }
  return node.collapsed ? COLLAPSED_FOLDER_SIZE.width : EMPTY_FOLDER_SIZE.width;
}

function fallbackHeight(node: GraphNode): number {
  if (node.kind === "file") {
    return GRID_LAYOUT_CONSTANTS.fileHeight;
  }
  return node.collapsed ? COLLAPSED_FOLDER_SIZE.height : EMPTY_FOLDER_SIZE.height;
}

function addVisualEdge(
  edgesByKey: Map<string, GraphEdge>,
  connection: ImportConnection,
  level: "folder" | "file",
  source: { id: string; kind: "folder" | "file" } | undefined,
  target: { id: string; kind: "folder" | "file" } | undefined
): void {
  if (!source || !target || source.id === target.id) {
    return;
  }
  const isAggregated = level === "folder" || source.kind === "folder" || target.kind === "folder";
  const key = `${level}:${source.id}->${target.id}`;
  const existing = edgesByKey.get(key);
  if (existing) {
    existing.dependencyCount = (existing.dependencyCount ?? 1) + 1;
    existing.connectionIds = [...(existing.connectionIds ?? []), connection.id].sort();
    existing.connectionId = existing.connectionIds[0];
    return;
  }

  edgesByKey.set(key, {
    id: `${isAggregated ? "aggregate" : "dependency"}:${key}`,
    sourceId: source.id,
    targetId: target.id,
    level,
    connectionId: connection.id,
    connectionIds: [connection.id],
    dependencyCount: 1,
    isAggregated
  });
}

function normalizeHierarchy(nodes: GraphNode[]): GraphNode[] {
  const folders = new Map(nodes.filter((node) => node.kind === "folder").map((node) => [node.id, node]));
  return nodes.map((node) => {
    if (!node.parentId) {
      return { ...node };
    }
    const parent = folders.get(node.parentId);
    if (!parent || parent.collapsed || (node.kind === "folder" && wouldCreateCycle(node.id, parent.id, folders))) {
      return { ...node, parentId: undefined };
    }
    return { ...node };
  });
}

function wouldCreateCycle(folderId: string, parentId: string, folders: Map<string, GraphNode>): boolean {
  let currentId: string | undefined = parentId;
  while (currentId) {
    if (currentId === folderId) {
      return true;
    }
    currentId = folders.get(currentId)?.parentId;
  }
  return false;
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const node of [...nodes].sort(compareNodes)) {
    if (!node.id || byId.has(node.id)) {
      continue;
    }
    byId.set(node.id, { ...node });
  }
  return [...byId.values()];
}

function dedupeEdges(edges: GraphEdge[], nodeMap: Map<string, GraphNode>): GraphEdge[] {
  const byId = new Map<string, GraphEdge>();
  for (const edge of [...edges].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!edge.id || !nodeMap.has(edge.sourceId) || !nodeMap.has(edge.targetId) || byId.has(edge.id)) {
      continue;
    }
    byId.set(edge.id, { ...edge });
  }
  return [...byId.values()];
}

function routeEdgesFromPositionedNodes(edges: GraphEdge[], nodes: PositionedGraphNode[]): RoutedGraphEdge[] {
  const nodeRects = new Map(nodes.map((node) => [node.id, node]));
  const duplicateGuard = new Set<string>();
  const portUseCounts = new Map<string, number>();
  const routed: RoutedGraphEdge[] = [];

  for (const edge of edges) {
    const source = nodeRects.get(edge.sourceId);
    const target = nodeRects.get(edge.targetId);
    const duplicateKey = `${edge.sourceId}->${edge.targetId}`;
    if (!source || !target || duplicateGuard.has(duplicateKey)) {
      continue;
    }

    const sourcePort = choosePort(source, target);
    const targetPort = oppositePort(choosePort(target, source));
    const sourcePortIndex = incrementPortUse(portUseCounts, source.id, sourcePort);
    const targetPortIndex = incrementPortUse(portUseCounts, target.id, targetPort);
    const startPoint = portPoint(source, sourcePort, sourcePortIndex);
    const endPoint = portPoint(target, targetPort, targetPortIndex);
    const sections = routeBetweenPorts(edge, startPoint, endPoint, sourcePort, targetPort, nodes);
    if (sections.length === 0) {
      continue;
    }

    duplicateGuard.add(duplicateKey);
    routed.push({
      ...edge,
      sections,
      points: sections.flatMap((section) => [section.startPoint, ...section.bendPoints, section.endPoint])
    });
  }

  return routed.sort((a, b) => a.id.localeCompare(b.id));
}

type PortSide = "top" | "right" | "bottom" | "left";

function choosePort(source: PositionedGraphNode, target: PositionedGraphNode): PortSide {
  const sourceCenter = center(source);
  const targetCenter = center(target);
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

function oppositePort(side: PortSide): PortSide {
  switch (side) {
    case "top":
      return "bottom";
    case "right":
      return "left";
    case "bottom":
      return "top";
    case "left":
      return "right";
  }
}

function incrementPortUse(counts: Map<string, number>, nodeId: string, side: PortSide): number {
  const key = `${nodeId}:${side}`;
  const next = counts.get(key) ?? 0;
  counts.set(key, next + 1);
  return next;
}

function portPoint(rect: PositionedGraphNode, side: PortSide, index: number): Point {
  const offset = portOffset(index);
  switch (side) {
    case "top":
      return { x: Math.round(rect.x + rect.width / 2 + offset), y: Math.round(rect.y) };
    case "right":
      return { x: Math.round(rect.x + rect.width), y: Math.round(rect.y + rect.height / 2 + offset) };
    case "bottom":
      return { x: Math.round(rect.x + rect.width / 2 + offset), y: Math.round(rect.y + rect.height) };
    case "left":
      return { x: Math.round(rect.x), y: Math.round(rect.y + rect.height / 2 + offset) };
  }
}

function portOffset(index: number): number {
  if (index === 0) {
    return 0;
  }
  const lane = Math.ceil(index / 2);
  return lane * 16 * (index % 2 === 0 ? -1 : 1);
}

function routeBetweenPorts(
  edge: GraphEdge,
  startPoint: Point,
  endPoint: Point,
  sourcePort: PortSide,
  targetPort: PortSide,
  nodes: PositionedGraphNode[]
): RoutedEdgeSection[] {
  const candidates = routeCandidates(startPoint, endPoint, sourcePort, targetPort);
  const sourceAndTarget = new Set([edge.sourceId, edge.targetId]);
  const clearPath = candidates.find((candidate) => !pathIntersectsBlockingRects(candidate, nodes, sourceAndTarget));
  const points = clearPath ?? (edge.level === "folder" ? candidates[0] : undefined);
  if (!points) {
    return [];
  }
  return [
    {
      startPoint,
      bendPoints: points.slice(1, -1),
      endPoint
    }
  ];
}

function routeCandidates(startPoint: Point, endPoint: Point, sourcePort: PortSide, targetPort: PortSide): Point[][] {
  const horizontalFirst = [
    startPoint,
    { x: Math.round((startPoint.x + endPoint.x) / 2), y: startPoint.y },
    { x: Math.round((startPoint.x + endPoint.x) / 2), y: endPoint.y },
    endPoint
  ];
  const verticalFirst = [
    startPoint,
    { x: startPoint.x, y: Math.round((startPoint.y + endPoint.y) / 2) },
    { x: endPoint.x, y: Math.round((startPoint.y + endPoint.y) / 2) },
    endPoint
  ];
  const direct = [startPoint, endPoint];

  if ((sourcePort === "left" || sourcePort === "right") && (targetPort === "left" || targetPort === "right")) {
    return [horizontalFirst, verticalFirst, direct];
  }
  if ((sourcePort === "top" || sourcePort === "bottom") && (targetPort === "top" || targetPort === "bottom")) {
    return [verticalFirst, horizontalFirst, direct];
  }
  return [horizontalFirst, verticalFirst, direct];
}

function pathIntersectsBlockingRects(points: Point[], nodes: PositionedGraphNode[], sourceAndTarget: Set<string>): boolean {
  const blockers = nodes
    .filter((node) => !sourceAndTarget.has(node.id))
    .map(blockingRectForNode);

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) {
      continue;
    }
    if (blockers.some((rect) => segmentIntersectsRect(previous, current, rect))) {
      return true;
    }
  }
  return false;
}

function blockingRectForNode(node: PositionedGraphNode): Rect {
  if (node.kind === "folder") {
    return { id: `${node.id}:header`, x: node.x, y: node.y, width: node.width, height: Math.min(72, node.height) };
  }
  return { id: node.id, x: node.x, y: node.y, width: node.width, height: node.height };
}

function segmentIntersectsRect(start: Point, end: Point, rect: Rect): boolean {
  const padding = 8;
  const minX = rect.x - padding;
  const maxX = rect.x + rect.width + padding;
  const minY = rect.y - padding;
  const maxY = rect.y + rect.height + padding;
  if (start.x === end.x) {
    const y1 = Math.min(start.y, end.y);
    const y2 = Math.max(start.y, end.y);
    return start.x >= minX && start.x <= maxX && y2 >= minY && y1 <= maxY;
  }
  if (start.y === end.y) {
    const x1 = Math.min(start.x, end.x);
    const x2 = Math.max(start.x, end.x);
    return start.y >= minY && start.y <= maxY && x2 >= minX && x1 <= maxX;
  }
  return false;
}

function visibleAnchorForFile(
  fileId: string,
  filesById: Map<string, FileNode>,
  foldersById: Map<string, FolderNode>,
  visibleFileIds: Set<string>,
  visibleFolderIds: Set<string>,
  expandedFolderIds: Set<string>
): { id: string; kind: "folder" | "file" } | undefined {
  if (visibleFileIds.has(fileId)) {
    return { id: fileId, kind: "file" };
  }

  let folderId = filesById.get(fileId)?.folderId;
  while (folderId) {
    if (visibleFolderIds.has(folderId) && !expandedFolderIds.has(folderId)) {
      return { id: folderId, kind: "folder" };
    }
    folderId = foldersById.get(folderId)?.parentFolderId;
  }

  return undefined;
}

function visibleFolderAnchorForFile(
  fileId: string,
  filesById: Map<string, FileNode>,
  foldersById: Map<string, FolderNode>,
  visibleFolderIds: Set<string>
): { id: string; kind: "folder" | "file" } | undefined {
  const file = filesById.get(fileId);
  if (!file) {
    return undefined;
  }

  let folderId: string | undefined = file.folderId;
  while (folderId) {
    if (visibleFolderIds.has(folderId)) {
      if (folderId === ".") {
        return { id: file.id, kind: "file" };
      }
      return { id: folderId, kind: "folder" };
    }
    folderId = foldersById.get(folderId)?.parentFolderId;
  }
  return { id: file.id, kind: "file" };
}

function isFileVisible(file: FileNode, foldersById: Map<string, FolderNode>, visibleFolderIds: Set<string>, expandedFolderIds: Set<string>): boolean {
  const folder = foldersById.get(file.folderId);
  if (!folder) {
    return true;
  }
  if (folder.id === ".") {
    return true;
  }
  return visibleFolderIds.has(folder.id) && expandedFolderIds.has(folder.id);
}

function isFolderReachable(folder: FolderNode, foldersById: Map<string, FolderNode>, expandedFolderIds: Set<string>): boolean {
  let parentId = folder.parentFolderId;
  while (parentId) {
    if (!expandedFolderIds.has(parentId)) {
      return false;
    }
    parentId = foldersById.get(parentId)?.parentFolderId;
  }
  return true;
}

function center(rect: { x: number; y: number; width: number; height: number }): Point {
  return { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
}

function containsRect(parent: Rect, child: Rect): boolean {
  return child.x >= parent.x && child.y >= parent.y && child.x + child.width <= parent.x + parent.width && child.y + child.height <= parent.y + parent.height;
}

function rectsOverlap(left: Rect, right: Rect): boolean {
  return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}

function prefixOffsets(values: number[], gap: number): number[] {
  const result: number[] = [];
  let current = 0;
  for (const value of values) {
    result.push(current);
    current += value + gap;
  }
  return result;
}

function rowWidthsForItems(items: GridItem[], columns: number): number[] {
  const rows: number[] = [];
  items.forEach((item, index) => {
    const row = Math.floor(index / columns);
    rows[row] = (rows[row] ?? 0) + item.width + (index % columns === 0 ? 0 : GRID_LAYOUT_CONSTANTS.folderGap);
  });
  return rows;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function compareNodes(a: GraphNode, b: GraphNode): number {
  return a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}

function comparePositionedNodes(a: PositionedGraphNode, b: PositionedGraphNode): number {
  return compareNodes(a, b);
}
