import type { ImportConnection, ProjectGraph } from "../../shared/graphTypes";
import { getVisibleBuildingBounds, type Rect } from "./buildingGeometry";

export type PortSide = "top" | "right" | "bottom" | "left";
export type StreetPoint = Point;

export type BuildingPort = {
  fileId: string;
  side: PortSide;
  x: number;
  y: number;
};

export type FolderGateway = {
  id: string;
  folderId: string;
  side: PortSide;
  x: number;
  y: number;
};

export type StreetEdgeKind = "spine" | "collector" | "spur";

export type StreetEdge = {
  id: string;
  folderId: string;
  kind: StreetEdgeKind;
  from: StreetPoint;
  to: StreetPoint;
  connectedEdgeIds: string[];
  connectedFileIds: string[];
};

export type InternalStreetGraph = {
  folderId: string;
  gatewayId: string;
  edges: StreetEdge[];
  spineEdgeIds: string[];
  collectorEdgeIds: string[];
  spurEdgeIds: string[];
  edgeById: Map<string, StreetEdge>;
  fileEntryEdgeByFileId: Map<string, string>;
};

export type StreetJunction = {
  id: string;
  folderId: string;
  x: number;
  y: number;
  connectedEdgeIds: string[];
};

export type ParentChildConnectorEdge = {
  id: string;
  connectorId: string;
  parentFolderId: string;
  childFolderId: string;
  from: StreetPoint;
  to: StreetPoint;
  connectedEdgeIds: string[];
};

export type ParentChildConnector = {
  id: string;
  parentFolderId: string;
  childFolderId: string;
  childGatewayId: string;
  parentJunctionId: string;
  edgeIds: string[];
  edges: ParentChildConnectorEdge[];
};

export type ExternalCorridorEdge = {
  id: string;
  from: StreetPoint;
  to: StreetPoint;
  connectedJunctionIds: string[];
};

export type ExternalJunction = {
  id: string;
  x: number;
  y: number;
  connectedEdgeIds: string[];
};

export type FolderTrunk = {
  id: string;
  providerFolderId: string;
  consumerFolderId: string;
  providerGatewayId: string;
  consumerGatewayId: string;
  edgeIds: string[];
  junctionIds: string[];
  points: StreetPoint[];
  dependencyIds: string[];
  dependencyCount: number;
  symbolCount: number;
  providerFileIds: string[];
  consumerFileIds: string[];
  dependencyTypes: ImportConnection["type"][];
};

export type RouteInfrastructureRef =
  | {
      kind: "internal-street-edge";
      folderId: string;
      edgeId: string;
    }
  | {
      kind: "parent-child-connector-edge";
      connectorId: string;
      edgeId: string;
    }
  | {
      kind: "external-corridor-edge";
      edgeId: string;
    };

export type ExactDependencyRoute = {
  id: string;
  connectionId: string;
  providerFileId: string;
  consumerFileId: string;
  providerFolderId: string;
  consumerFolderId: string;
  providerTopLevelFolderId: string;
  consumerTopLevelFolderId: string;
  providerPortId: string;
  consumerPortId: string;
  infrastructureRefs: RouteInfrastructureRef[];
  trunkId?: string;
  symbols: string[];
  dependencyKind: ImportConnection["type"];
  isCircular: boolean;
};

type CollectorBuildResult = {
  edges: StreetEdge[];
  spineCollectorEdgeIds: string[];
  entryEdgeIdByFileId: Map<string, string>;
};

type ExternalRouteBuildResult = {
  corridorEdges: Map<string, ExternalCorridorEdge>;
  externalJunctions: Map<string, ExternalJunction>;
  folderTrunks: Map<string, FolderTrunk>;
  expectedFolderTrunkCount: number;
};

export type RoutingPlan = {
  buildingPorts: Map<string, BuildingPort>;
  folderGateways: Map<string, FolderGateway>;
  internalStreetGraphs: Map<string, InternalStreetGraph>;
  streetJunctions: Map<string, StreetJunction>;
  parentChildConnectors: Map<string, ParentChildConnector>;
  externalCorridorEdges: Map<string, ExternalCorridorEdge>;
  externalJunctions: Map<string, ExternalJunction>;
  folderTrunks: Map<string, FolderTrunk>;
  exactDependencyRoutes: ExactDependencyRoute[];
  validation: RoutingPlanValidation;
};

export interface RoutingPlanValidation {
  visibleFileCount: number;
  buildingPortCount: number;
  filesWithZeroPorts: number;
  filesWithMultiplePorts: number;
  externallyConnectedFolderCount: number;
  expandedFoldersNeedingStreetCount: number;
  participatingFileCount: number;
  foldersWithExternalDependenciesWithoutGateway: number;
  foldersWithMultipleGateways: number;
  internalStreetGraphCount: number;
  foldersWithGatewayWithoutStreetGraph: number;
  streetGraphsWithWrongGateway: number;
  streetGraphsMissingGatewaySpine: number;
  streetGraphsWithMultiplePrimarySpines: number;
  filesWithMissingStreetSpur: number;
  filesWithDuplicateStreetSpurs: number;
  streetSpursMissingPorts: number;
  streetEdgesWithDiagonalSegments: number;
  streetEdgesOutsideFolderBounds: number;
  streetEdgesIntersectingBuildings: number;
  streetEdgesIntersectingLabels: number;
  streetEdgesIntersectingNestedFolders: number;
  streetJunctionCount: number;
  childFoldersNeedingParentConnector: number;
  parentChildConnectorCount: number;
  childFoldersMissingParentConnector: number;
  childFoldersWithDuplicateParentConnectors: number;
  parentChildConnectorsWrongGateway: number;
  parentChildConnectorsMissingParentJunction: number;
  parentChildConnectorsBypassingChildGateway: number;
  parentChildConnectorsBypassingParentStreetGraph: number;
  parentChildConnectorsWithDiagonalSegments: number;
  parentChildConnectorsOutsideParent: number;
  parentChildConnectorsIntersectingBuildings: number;
  parentChildConnectorsIntersectingLabels: number;
  parentChildConnectorsIntersectingSiblingFolders: number;
  parentChildConnectorsCrossingChildBoundary: number;
  expectedFolderTrunkCount: number;
  folderTrunkCount: number;
  externalCorridorEdgeCount: number;
  externalJunctionCount: number;
  duplicateFolderTrunks: number;
  folderTrunksWrongGateway: number;
  folderTrunksAttachedToNestedFolder: number;
  folderTrunksWithDiagonalSegments: number;
  folderTrunksIntersectingFolders: number;
  folderTrunksIntersectingBuildings: number;
  folderTrunksIntersectingLabels: number;
  duplicateExternalCorridorGeometry: number;
  externalJunctionsMissingCorridorEdge: number;
  semanticDependencyCount: number;
  exactDependencyRouteCount: number;
  exactRoutesWithDuplicateIds: number;
  exactRoutesMissingBuildingPort: number;
  exactRoutesMissingInfrastructure: number;
  sameFolderRoutesUsingExternalTrunk: number;
  crossTopLevelRoutesWithoutOneTrunk: number;
  exactRoutesWithWrongEndpointPort: number;
}

export interface RoutingLayoutNode {
  id: string;
  kind: "folder" | "file";
  parentId?: string;
  collapsed?: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutingPlanInput {
  graph: ProjectGraph;
  files: RoutingLayoutNode[];
  folders: RoutingLayoutNode[];
  connections: ImportConnection[];
  throwOnViolation?: boolean;
}

export interface ProviderConsumerFiles {
  providerFileId: string | undefined;
  consumerFileId: string;
}

export const ROUTING_LANES = {
  gatewayClearance: 20,
  spineClearance: 16,
  collectorClearance: 18,
  buildingSpurClearance: 16,
  obstaclePadding: 8,
  folderBoundaryClearance: 4,
  folderHeaderClearance: 48
} as const;

const SIDE_PRIORITY: PortSide[] = ["top", "right", "bottom", "left"];

export function buildRoutingPlan(input: RoutingPlanInput): RoutingPlan {
  const files = [...input.files].sort((a, b) => a.id.localeCompare(b.id));
  const folders = [...input.folders].sort((a, b) => a.id.localeCompare(b.id));
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const graphFiles = new Map(input.graph.files.map((file) => [file.id, file]));
  const graphFolders = new Map(input.graph.folders.map((folder) => [folder.id, folder]));
  const visibleFolderIds = new Set(folders.map((folder) => folder.id));
  const visibleFileIds = new Set(files.map((file) => file.id));
  const externalConnections = externalFolderConnections(input.connections, graphFiles, graphFolders, visibleFolderIds);
  const routableConnections = visibleSemanticConnections(input.connections, visibleFileIds, graphFiles, graphFolders, visibleFolderIds);
  const routeParticipantFolderIds = participatingRouteFolderIds(routableConnections, graphFiles, graphFolders, visibleFolderIds);
  const folderGateways = buildFolderGateways(folders, externalConnections, routeParticipantFolderIds);
  const buildingPorts = buildBuildingPorts(files, input.connections, graphFiles, graphFolders, visibleFolderIds, visibleFileIds, folderGateways, folderRects);
  const participatingFileIds = participatingVisibleFileIds(input.connections, graphFiles, graphFolders, visibleFolderIds, visibleFileIds);
  const internalStreetGraphs = buildInternalStreetGraphs(folders, files, buildingPorts, folderGateways, participatingFileIds);
  const streetJunctions = buildStreetJunctions(internalStreetGraphs);
  const parentChildConnectors = buildParentChildConnectors(folders, files, folderGateways, internalStreetGraphs, streetJunctions, externalConnections);
  const externalRoutes = buildExternalFolderTrunks(input.connections, graphFiles, graphFolders, folders, folderGateways);
  const exactDependencyRoutes = buildExactDependencyRoutes(routableConnections, graphFiles, graphFolders, folders, buildingPorts, internalStreetGraphs, parentChildConnectors, externalRoutes.folderTrunks);
  const validation = validateRoutingPlan(files, folders, buildingPorts, folderGateways, internalStreetGraphs, streetJunctions, parentChildConnectors, externalRoutes, externalConnections, participatingFileIds, routableConnections, exactDependencyRoutes);

  if ((input.throwOnViolation ?? isDevelopmentRuntime()) && hasRoutingPlanViolation(validation)) {
    throw new Error(`Codebase Town routing plan violation: ${JSON.stringify(validation)}`);
  }

  return {
    buildingPorts,
    folderGateways,
    internalStreetGraphs,
    streetJunctions,
    parentChildConnectors,
    externalCorridorEdges: externalRoutes.corridorEdges,
    externalJunctions: externalRoutes.externalJunctions,
    folderTrunks: externalRoutes.folderTrunks,
    exactDependencyRoutes,
    validation
  };
}

export function emptyRoutingPlan(): RoutingPlan {
  return {
    buildingPorts: new Map(),
    folderGateways: new Map(),
    internalStreetGraphs: new Map(),
    streetJunctions: new Map(),
    parentChildConnectors: new Map(),
    externalCorridorEdges: new Map(),
    externalJunctions: new Map(),
    folderTrunks: new Map(),
    exactDependencyRoutes: [],
    validation: emptyRoutingPlanValidation()
  };
}

export function getProviderConsumerFiles(connection: ImportConnection): ProviderConsumerFiles {
  return {
    providerFileId: connection.targetFileId,
    consumerFileId: connection.sourceFileId
  };
}

export function providerFileId(connection: ImportConnection): string | undefined {
  return getProviderConsumerFiles(connection).providerFileId;
}

export function consumerFileId(connection: ImportConnection): string {
  return getProviderConsumerFiles(connection).consumerFileId;
}

function buildBuildingPorts(
  files: RoutingLayoutNode[],
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>,
  visibleFileIds: Set<string>,
  folderGateways: Map<string, FolderGateway>,
  folderRects: Map<string, RoutingLayoutNode>
): Map<string, BuildingPort> {
  const connectedCentersByFile = connectedFolderCentersByFile(connections, graphFiles, graphFolders, visibleFolderIds, visibleFileIds, folderRects);
  const ports = new Map<string, BuildingPort>();

  for (const file of files) {
    const bounds = getVisibleBuildingBounds(file);
    const connectedCenters = connectedCentersByFile.get(file.id) ?? [];
    const parentGateway = file.parentId ? folderGateways.get(file.parentId) : undefined;
    const side = parentGateway
      ? buildingPortSideForGateway(parentGateway.side)
      : connectedCenters.length > 0
        ? sideFacingAverage(bounds, connectedCenters)
        : stableSideForId(file.id);
    ports.set(file.id, buildingPortOnBounds(file.id, bounds, usableBuildingPortSide(side)));
  }

  return ports;
}

function usableBuildingPortSide(side: PortSide): PortSide {
  return side === "bottom" ? "top" : side;
}

function buildingPortSideForGateway(gatewaySide: PortSide): PortSide {
  if (gatewaySide === "left" || gatewaySide === "right") {
    return gatewaySide;
  }
  return "top";
}

function buildFolderGateways(folders: RoutingLayoutNode[], externalConnections: ExternalFolderConnection[], routeParticipantFolderIds: Set<string>): Map<string, FolderGateway> {
  const connectedCentersByFolder = new Map<string, Point[]>();
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const ancestorIdsByFolder = new Map(folders.map((folder) => [folder.id, visibleAncestorFolderIds(folder.id, folderRects)]));

  for (const connection of externalConnections) {
    const provider = folderRects.get(connection.providerFolderId);
    const consumer = folderRects.get(connection.consumerFolderId);
    if (!provider || !consumer) {
      continue;
    }
    for (const folderId of ancestorIdsByFolder.get(provider.id) ?? [provider.id]) {
      addPoint(connectedCentersByFolder, folderId, center(consumer));
    }
    for (const folderId of ancestorIdsByFolder.get(consumer.id) ?? [consumer.id]) {
      addPoint(connectedCentersByFolder, folderId, center(provider));
    }
  }

  const gateways = new Map<string, FolderGateway>();
  for (const folder of folders) {
    const connectedCenters = uniquePoints(connectedCentersByFolder.get(folder.id) ?? []);
    if (connectedCenters.length === 0 && !routeParticipantFolderIds.has(folder.id)) {
      continue;
    }
    const side = connectedCenters.length > 0 ? sideFacingAverage(folder, connectedCenters) : stableSideForId(folder.id);
    gateways.set(folder.id, gatewayOnBounds(folder.id, folder, side));
  }

  return gateways;
}

function visibleAncestorFolderIds(folderId: string, folderRects: Map<string, RoutingLayoutNode>): string[] {
  const ids: string[] = [];
  let currentId: string | undefined = folderId;
  while (currentId) {
    const folder = folderRects.get(currentId);
    if (!folder) {
      break;
    }
    ids.push(folder.id);
    currentId = folder.parentId;
  }
  return ids;
}

function buildInternalStreetGraphs(
  folders: RoutingLayoutNode[],
  files: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>,
  folderGateways: Map<string, FolderGateway>,
  participatingFileIds: Set<string>
): Map<string, InternalStreetGraph> {
  const filesByParent = groupBy(files, (file) => file.parentId ?? "");
  const childFoldersByParent = groupBy(folders, (folder) => folder.parentId ?? "");
  const graphs = new Map<string, InternalStreetGraph>();

  for (const folder of folders) {
    const gateway = folderGateways.get(folder.id);
    if (!gateway || folder.collapsed) {
      continue;
    }
    const folderFiles = [...(filesByParent.get(folder.id) ?? [])].sort((a, b) => a.id.localeCompare(b.id));
    const directFiles = folderFiles
      .filter((file) => participatingFileIds.has(file.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    const obstacles = [
      ...folderFiles.flatMap((file) => [getVisibleBuildingBounds(file), fileLabelRect(file)]),
      ...(childFoldersByParent.get(folder.id) ?? [])
    ];
    const spineStart = { x: gateway.x, y: gateway.y };
    const spineEnd = choosePrimarySpineEnd(folder, gateway, directFiles, buildingPorts, obstacles);
    const edgeById = new Map<string, StreetEdge>();
    const fileEntryEdgeByFileId = new Map<string, string>();
    const spineEdgeId = streetEdgeId(folder.id, "spine", "primary");
    const spineCollectorEdgeIds = new Set<string>();
    const collectorEntryEdgeByFileId = new Map<string, string>();
    const collectorFilesByGroup = groupStreetFiles(folder, gateway, directFiles, buildingPorts);

    edgeById.set(spineEdgeId, {
      id: spineEdgeId,
      folderId: folder.id,
      kind: "spine",
      from: spineStart,
      to: spineEnd,
      connectedEdgeIds: [],
      connectedFileIds: directFiles.map((file) => file.id)
    });

    for (const [groupKey, groupFiles] of collectorFilesByGroup) {
      const collectorResult = collectorEdgesForGroup(folder, spineEnd, groupFiles, buildingPorts, obstacles, groupKey);
      if (collectorResult.edges.length === 0) {
        continue;
      }
      for (const collectorId of collectorResult.spineCollectorEdgeIds) {
        spineCollectorEdgeIds.add(collectorId);
      }
      for (const [fileId, collectorId] of collectorResult.entryEdgeIdByFileId) {
        collectorEntryEdgeByFileId.set(fileId, collectorId);
      }
      for (const collector of collectorResult.edges) {
        edgeById.set(collector.id, collector);
      }
    }

    for (const groupFiles of collectorFilesByGroup.values()) {
      for (const file of groupFiles) {
        const port = buildingPorts.get(file.id);
        const collectorId = collectorEntryEdgeByFileId.get(file.id);
        const collector = collectorId ? edgeById.get(collectorId) : undefined;
        if (!port) {
          continue;
        }
        const spurStart = spurStartForPort(port, folder);
        const spurId = streetEdgeId(folder.id, "spur", file.id);
        edgeById.set(spurId, {
          id: spurId,
          folderId: folder.id,
          kind: "spur",
          from: spurStart,
          to: { x: port.x, y: port.y },
          connectedEdgeIds: collectorId ? [collectorId] : [spineEdgeId],
          connectedFileIds: [file.id]
        });
        fileEntryEdgeByFileId.set(file.id, spurId);
        if (collector) {
          collector.connectedEdgeIds = [...new Set([...collector.connectedEdgeIds, spurId])].sort();
        }
      }
    }

    const spine = edgeById.get(spineEdgeId)!;
    spine.connectedEdgeIds = [...spineCollectorEdgeIds].sort();
    const edges = [...edgeById.values()].sort(compareStreetEdges);
    graphs.set(folder.id, {
      folderId: folder.id,
      gatewayId: gateway.id,
      spineEdgeIds: edges.filter((edge) => edge.kind === "spine").map((edge) => edge.id),
      collectorEdgeIds: edges.filter((edge) => edge.kind === "collector").map((edge) => edge.id),
      spurEdgeIds: edges.filter((edge) => edge.kind === "spur").map((edge) => edge.id),
      edges,
      edgeById,
      fileEntryEdgeByFileId
    });
  }

  return graphs;
}

function buildStreetJunctions(internalStreetGraphs: Map<string, InternalStreetGraph>): Map<string, StreetJunction> {
  const junctions = new Map<string, StreetJunction>();
  for (const graph of internalStreetGraphs.values()) {
    const connectedEdgeIdsByPoint = new Map<string, Set<string>>();
    const pointByKey = new Map<string, Point>();
    for (const edge of graph.edges) {
      for (const point of [edge.from, edge.to]) {
        const key = pointKey(point);
        pointByKey.set(key, point);
        connectedEdgeIdsByPoint.set(key, new Set([...(connectedEdgeIdsByPoint.get(key) ?? []), edge.id]));
      }
    }
    for (const [key, connectedEdgeIds] of [...connectedEdgeIdsByPoint.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      const point = pointByKey.get(key)!;
      const junction: StreetJunction = {
        id: streetJunctionId(graph.folderId, point),
        folderId: graph.folderId,
        x: point.x,
        y: point.y,
        connectedEdgeIds: [...connectedEdgeIds].sort()
      };
      junctions.set(junction.id, junction);
    }
  }
  return junctions;
}

function buildParentChildConnectors(
  folders: RoutingLayoutNode[],
  files: RoutingLayoutNode[],
  folderGateways: Map<string, FolderGateway>,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  streetJunctions: Map<string, StreetJunction>,
  externalConnections: ExternalFolderConnection[]
): Map<string, ParentChildConnector> {
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const filesByParent = groupBy(files, (file) => file.parentId ?? "");
  const childFoldersByParent = groupBy(folders, (folder) => folder.parentId ?? "");
  const neededChildIds = childFolderIdsNeedingParentConnectors(folders, folderGateways, internalStreetGraphs, externalConnections);
  const connectors = new Map<string, ParentChildConnector>();

  for (const childFolderId of [...neededChildIds].sort()) {
    const child = folderRects.get(childFolderId);
    const parentFolderId = child?.parentId;
    const parent = parentFolderId ? folderRects.get(parentFolderId) : undefined;
    const childGateway = folderGateways.get(childFolderId);
    const parentGraph = parentFolderId ? internalStreetGraphs.get(parentFolderId) : undefined;
    if (!child || !parent || !childGateway || !parentGraph) {
      continue;
    }
    const parentJunction = chooseParentAttachmentJunction(parent, child, childGateway, parentGraph, streetJunctions, filesByParent, childFoldersByParent);
    if (!parentJunction) {
      continue;
    }
    const obstacles = connectorObstacles(parent.id, filesByParent, childFoldersByParent);
    const path = routeConnectorPath(parent, childGateway, parentJunction, obstacles);
    if (!pathIsLegalInFolder(path, parent, obstacles)) {
      continue;
    }
    const connectorId = parentChildConnectorId(parent.id, child.id);
    const edges: ParentChildConnectorEdge[] = [];
    for (let index = 1; index < path.length; index += 1) {
      const edgeId = `${connectorId}:edge:${index}`;
      edges.push({
        id: edgeId,
        connectorId,
        parentFolderId: parent.id,
        childFolderId: child.id,
        from: clonePoint(path[index - 1]!),
        to: clonePoint(path[index]!),
        connectedEdgeIds: []
      });
    }
    for (let index = 0; index < edges.length; index += 1) {
      const connectedEdgeIds = new Set<string>();
      const previous = edges[index - 1];
      const next = edges[index + 1];
      if (previous) {
        connectedEdgeIds.add(previous.id);
      }
      if (next) {
        connectedEdgeIds.add(next.id);
      }
      if (index === edges.length - 1) {
        for (const streetEdgeId of parentJunction.connectedEdgeIds) {
          connectedEdgeIds.add(streetEdgeId);
        }
      }
      edges[index]!.connectedEdgeIds = [...connectedEdgeIds].sort();
    }
    connectors.set(connectorId, {
      id: connectorId,
      parentFolderId: parent.id,
      childFolderId: child.id,
      childGatewayId: childGateway.id,
      parentJunctionId: parentJunction.id,
      edgeIds: edges.map((edge) => edge.id),
      edges
    });
  }

  return connectors;
}

function childFolderIdsNeedingParentConnectors(
  folders: RoutingLayoutNode[],
  folderGateways: Map<string, FolderGateway>,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  externalConnections: ExternalFolderConnection[]
): Set<string> {
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const endpointFolderIds = new Set(externalConnections.flatMap((connection) => [connection.providerFolderId, connection.consumerFolderId]));
  const needed = new Set<string>();
  for (const folderId of endpointFolderIds) {
    let current = folderRects.get(folderId);
    while (current?.parentId) {
      if (folderGateways.has(current.id) && internalStreetGraphs.has(current.parentId)) {
        needed.add(current.id);
      }
      current = folderRects.get(current.parentId);
    }
  }
  return needed;
}

function chooseParentAttachmentJunction(
  parent: RoutingLayoutNode,
  child: RoutingLayoutNode,
  childGateway: FolderGateway,
  parentGraph: InternalStreetGraph,
  streetJunctions: Map<string, StreetJunction>,
  filesByParent: Map<string, RoutingLayoutNode[]>,
  childFoldersByParent: Map<string, RoutingLayoutNode[]>
): StreetJunction | undefined {
  const parentGatewayPoint = parentGraph.edgeById.get(parentGraph.spineEdgeIds[0]!)?.from;
  const obstacles = connectorObstacles(parent.id, filesByParent, childFoldersByParent);
  const candidates = [...streetJunctions.values()]
    .filter((junction) => junction.folderId === parent.id)
    .filter((junction) => parentGraph.edgeById.has(junction.connectedEdgeIds[0] ?? ""))
    .sort((a, b) => a.id.localeCompare(b.id));
  const nonGatewayCandidates = candidates.filter((junction) => !samePoint(junction, parentGatewayPoint));
  const candidatePool = nonGatewayCandidates.length > 0 ? nonGatewayCandidates : candidates;

  return candidatePool
    .map((junction) => {
      const path = routeConnectorPath(parent, childGateway, junction, obstacles);
      if (!pathIsLegalInFolder(path, parent, obstacles)) {
        return undefined;
      }
      const attachesToCollector = junction.connectedEdgeIds.some((edgeId) => parentGraph.edgeById.get(edgeId)?.kind === "collector");
      const attachesToSpine = junction.connectedEdgeIds.some((edgeId) => parentGraph.edgeById.get(edgeId)?.kind === "spine");
      const gatewayPenalty = samePoint(junction, parentGatewayPoint) ? 500 : 0;
      const kindPenalty = attachesToCollector ? 0 : attachesToSpine ? 20 : 50;
      return {
        junction,
        score: pathLength(path) * 10 + bendCount(path) * 40 + gatewayPenalty + kindPenalty + distanceToRectBoundary(junction, child)
      };
    })
    .filter((entry): entry is { junction: StreetJunction; score: number } => entry !== undefined)
    .sort((a, b) => a.score - b.score || a.junction.x - b.junction.x || a.junction.y - b.junction.y || a.junction.id.localeCompare(b.junction.id))[0]
    ?.junction;
}

function connectorObstacles(
  parentFolderId: string,
  filesByParent: Map<string, RoutingLayoutNode[]>,
  childFoldersByParent: Map<string, RoutingLayoutNode[]>
): { x: number; y: number; width: number; height: number }[] {
  return [
    ...(filesByParent.get(parentFolderId) ?? []).flatMap((file) => [getVisibleBuildingBounds(file), fileLabelRect(file)]),
    ...(childFoldersByParent.get(parentFolderId) ?? [])
  ];
}

function routeConnectorPath(folder: RoutingLayoutNode, start: Point, end: Point, obstacles: { x: number; y: number; width: number; height: number }[]): Point[] {
  return routeCollectorPath(folder, clonePoint(start), clonePoint(end), obstacles);
}

type FolderTrunkGroup = {
  providerFolderId: string;
  consumerFolderId: string;
  dependencies: ImportConnection[];
  providerFileIds: Set<string>;
  consumerFileIds: Set<string>;
};

type PlannedTrunkPath = {
  group: FolderTrunkGroup;
  providerGateway: FolderGateway;
  consumerGateway: FolderGateway;
  points: Point[];
};

function buildExternalFolderTrunks(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  folders: RoutingLayoutNode[],
  folderGateways: Map<string, FolderGateway>
): ExternalRouteBuildResult {
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const topLevelFolders = folders.filter((folder) => !folder.parentId).sort((a, b) => a.id.localeCompare(b.id));
  const groups = topLevelFolderTrunkGroups(connections, graphFiles, graphFolders, folderRects);
  const obstacles = externalObstacleRects(topLevelFolders);
  const plannedPaths: PlannedTrunkPath[] = [];
  const existingPathSegments: { from: Point; to: Point }[] = [];

  for (const group of groups) {
    const providerGateway = folderGateways.get(group.providerFolderId);
    const consumerGateway = folderGateways.get(group.consumerFolderId);
    if (!providerGateway || !consumerGateway) {
      continue;
    }
    const points = routeExternalTrunkPath(providerGateway, consumerGateway, topLevelFolders, obstacles, existingPathSegments);
    plannedPaths.push({ group, providerGateway, consumerGateway, points });
    for (let index = 1; index < points.length; index += 1) {
      existingPathSegments.push(normalizeSegment(points[index - 1]!, points[index]!));
    }
  }

  const atomicPaths = splitTrunkPathsAtSharedJunctions(plannedPaths);
  const corridorEdges = new Map<string, ExternalCorridorEdge>();
  const trunkEdgeIdsById = new Map<string, string[]>();
  const trunkJunctionIdsById = new Map<string, string[]>();

  for (const planned of atomicPaths) {
    const trunkId = folderTrunkId(planned.group.providerFolderId, planned.group.consumerFolderId);
    const edgeIds: string[] = [];
    const junctionIds = planned.points.map(externalJunctionId);
    for (let index = 1; index < planned.points.length; index += 1) {
      const segment = normalizeSegment(planned.points[index - 1]!, planned.points[index]!);
      const edgeId = externalCorridorEdgeId(segment.from, segment.to);
      if (!corridorEdges.has(edgeId)) {
        corridorEdges.set(edgeId, {
          id: edgeId,
          from: clonePoint(segment.from),
          to: clonePoint(segment.to),
          connectedJunctionIds: [externalJunctionId(segment.from), externalJunctionId(segment.to)].sort()
        });
      }
      edgeIds.push(edgeId);
    }
    trunkEdgeIdsById.set(trunkId, edgeIds);
    trunkJunctionIdsById.set(trunkId, [...new Set(junctionIds)].sort());
  }

  const externalJunctions = buildExternalJunctions(corridorEdges);
  const folderTrunks = new Map<string, FolderTrunk>();
  for (const planned of atomicPaths) {
    const trunkId = folderTrunkId(planned.group.providerFolderId, planned.group.consumerFolderId);
    const dependencies = [...planned.group.dependencies].sort((a, b) => a.id.localeCompare(b.id));
    folderTrunks.set(trunkId, {
      id: trunkId,
      providerFolderId: planned.group.providerFolderId,
      consumerFolderId: planned.group.consumerFolderId,
      providerGatewayId: planned.providerGateway.id,
      consumerGatewayId: planned.consumerGateway.id,
      edgeIds: trunkEdgeIdsById.get(trunkId) ?? [],
      junctionIds: trunkJunctionIdsById.get(trunkId) ?? [],
      points: planned.points.map(clonePoint),
      dependencyIds: dependencies.map((dependency) => dependency.id),
      dependencyCount: dependencies.length,
      symbolCount: dependencies.reduce((total, dependency) => total + dependency.symbols.length, 0),
      providerFileIds: [...planned.group.providerFileIds].sort(),
      consumerFileIds: [...planned.group.consumerFileIds].sort(),
      dependencyTypes: [...new Set(dependencies.map((dependency) => dependency.type))].sort()
    });
  }

  return { corridorEdges, externalJunctions, folderTrunks, expectedFolderTrunkCount: groups.length };
}

function topLevelFolderTrunkGroups(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  folderRects: Map<string, RoutingLayoutNode>
): FolderTrunkGroup[] {
  const groups = new Map<string, FolderTrunkGroup>();
  for (const connection of connections) {
    const providerId = providerFileId(connection);
    const consumerId = consumerFileId(connection);
    if (!providerId) {
      continue;
    }
    const providerTopLevelFolderId = topLevelVisibleFolderForFile(providerId, graphFiles, graphFolders, folderRects);
    const consumerTopLevelFolderId = topLevelVisibleFolderForFile(consumerId, graphFiles, graphFolders, folderRects);
    if (!providerTopLevelFolderId || !consumerTopLevelFolderId || providerTopLevelFolderId === consumerTopLevelFolderId) {
      continue;
    }
    const key = folderTrunkId(providerTopLevelFolderId, consumerTopLevelFolderId);
    const group = groups.get(key) ?? {
      providerFolderId: providerTopLevelFolderId,
      consumerFolderId: consumerTopLevelFolderId,
      dependencies: [],
      providerFileIds: new Set<string>(),
      consumerFileIds: new Set<string>()
    };
    group.dependencies.push(connection);
    group.providerFileIds.add(providerId);
    group.consumerFileIds.add(consumerId);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => a.providerFolderId.localeCompare(b.providerFolderId) || a.consumerFolderId.localeCompare(b.consumerFolderId));
}

function topLevelVisibleFolderForFile(
  fileId: string,
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  folderRects: Map<string, RoutingLayoutNode>
): string | undefined {
  const visibleFolderId = visibleFolderForFile(fileId, graphFiles, graphFolders, new Set(folderRects.keys()));
  let current = visibleFolderId ? folderRects.get(visibleFolderId) : undefined;
  let topLevel: RoutingLayoutNode | undefined;
  while (current) {
    topLevel = current;
    current = current.parentId ? folderRects.get(current.parentId) : undefined;
  }
  return topLevel?.id;
}

function routeExternalTrunkPath(
  providerGateway: FolderGateway,
  consumerGateway: FolderGateway,
  folders: RoutingLayoutNode[],
  obstacles: { x: number; y: number; width: number; height: number }[],
  existingSegments: { from: Point; to: Point }[]
): Point[] {
  const providerAccess = externalGatewayAccessPoint(providerGateway);
  const consumerAccess = externalGatewayAccessPoint(consumerGateway);
  return compactPoints([
    clonePoint(providerGateway),
    ...routeExternalGridPath(providerAccess, consumerAccess, folders, obstacles, existingSegments),
    clonePoint(consumerGateway)
  ]);
}

function routeExternalGridPath(
  start: Point,
  end: Point,
  folders: RoutingLayoutNode[],
  obstacles: { x: number; y: number; width: number; height: number }[],
  existingSegments: { from: Point; to: Point }[]
): Point[] {
  const nodes = externalRouteNodes(start, end, folders, obstacles);
  const startKey = pointKey(start);
  const endKey = pointKey(end);
  nodes.set(startKey, start);
  nodes.set(endKey, end);
  const neighborsByKey = externalRouteNeighbors(nodes, obstacles);
  const distances = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, { pointKey: string; direction: "horizontal" | "vertical" | undefined }>();
  const directionByPoint = new Map<string, "horizontal" | "vertical" | undefined>([[startKey, undefined]]);
  const open = new Set<string>([startKey]);

  while (open.size > 0) {
    const currentKey = [...open].sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity) || a.localeCompare(b))[0]!;
    open.delete(currentKey);
    const current = nodes.get(currentKey)!;
    if (currentKey === endKey) {
      return compactCollinearPoints(reconstructExternalPath(endKey, previous, nodes));
    }
    const currentDirection = directionByPoint.get(currentKey);
    for (const next of neighborsByKey.get(currentKey) ?? []) {
      const nextKey = pointKey(next);
      const direction = current.x === next.x ? "vertical" : "horizontal";
      const segment = normalizeSegment(current, next);
      const length = Math.abs(current.x - next.x) + Math.abs(current.y - next.y);
      const bendPenalty = currentDirection && currentDirection !== direction ? 1000 : 0;
      const sharedBonus = segmentOverlapsAny(segment, existingSegments) ? -Math.min(300, length * 4) : 0;
      const congestionPenalty = existingSegments.filter((existing) => sameSegment(existing, segment)).length * 25;
      const cost = (distances.get(currentKey) ?? Infinity) + length * 10 + bendPenalty + sharedBonus + congestionPenalty;
      if (cost < (distances.get(nextKey) ?? Infinity)) {
        distances.set(nextKey, cost);
        previous.set(nextKey, { pointKey: currentKey, direction });
        directionByPoint.set(nextKey, direction);
        open.add(nextKey);
      }
    }
  }

  return compactCollinearPoints([start, { x: start.x, y: end.y }, end]);
}

function externalGatewayAccessPoint(gateway: FolderGateway): Point {
  switch (gateway.side) {
    case "top":
      return { x: gateway.x, y: gateway.y - ROUTING_LANES.gatewayClearance };
    case "right":
      return { x: gateway.x + ROUTING_LANES.gatewayClearance, y: gateway.y };
    case "bottom":
      return { x: gateway.x, y: gateway.y + ROUTING_LANES.gatewayClearance };
    case "left":
      return { x: gateway.x - ROUTING_LANES.gatewayClearance, y: gateway.y };
  }
}

function externalRouteNodes(
  start: Point,
  end: Point,
  folders: RoutingLayoutNode[],
  obstacles: { x: number; y: number; width: number; height: number }[]
): Map<string, Point> {
  const margin = ROUTING_LANES.gatewayClearance * 3;
  const minX = Math.min(start.x, end.x, ...folders.map((folder) => folder.x)) - margin;
  const maxX = Math.max(start.x, end.x, ...folders.map((folder) => folder.x + folder.width)) + margin;
  const minY = Math.min(start.y, end.y, ...folders.map((folder) => folder.y)) - margin;
  const maxY = Math.max(start.y, end.y, ...folders.map((folder) => folder.y + folder.height)) + margin;
  const xs = new Set<number>([start.x, end.x, minX, maxX]);
  const ys = new Set<number>([start.y, end.y, minY, maxY]);

  for (const folder of folders) {
    xs.add(folder.x - ROUTING_LANES.gatewayClearance);
    xs.add(folder.x + folder.width + ROUTING_LANES.gatewayClearance);
    ys.add(folder.y - ROUTING_LANES.gatewayClearance);
    ys.add(folder.y + folder.height + ROUTING_LANES.gatewayClearance);
  }
  for (const gap of adjacentFolderGaps(folders, "x")) {
    xs.add(gap);
  }
  for (const gap of adjacentFolderGaps(folders, "y")) {
    ys.add(gap);
  }

  const nodes = new Map<string, Point>();
  for (const x of [...xs].sort((a, b) => a - b)) {
    for (const y of [...ys].sort((a, b) => a - b)) {
      const point = { x, y };
      if (!pointInsideAnyObstacle(point, obstacles)) {
        nodes.set(pointKey(point), point);
      }
    }
  }
  return nodes;
}

function externalRouteNeighbors(nodes: Map<string, Point>, obstacles: { x: number; y: number; width: number; height: number }[]): Map<string, Point[]> {
  const neighbors = new Map<string, Point[]>();
  const rows = groupBy([...nodes.values()], (point) => `y:${point.y}`);
  const columns = groupBy([...nodes.values()], (point) => `x:${point.x}`);

  for (const row of rows.values()) {
    addVisibleAdjacentNeighbors(row.sort((a, b) => a.x - b.x || a.y - b.y), neighbors, obstacles);
  }
  for (const column of columns.values()) {
    addVisibleAdjacentNeighbors(column.sort((a, b) => a.y - b.y || a.x - b.x), neighbors, obstacles);
  }

  return neighbors;
}

function addVisibleAdjacentNeighbors(points: Point[], neighbors: Map<string, Point[]>, obstacles: { x: number; y: number; width: number; height: number }[]): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    if (segmentIntersectsAnyRect(previous, current, obstacles)) {
      continue;
    }
    addNeighbor(neighbors, previous, current);
    addNeighbor(neighbors, current, previous);
  }
}

function addNeighbor(neighbors: Map<string, Point[]>, from: Point, to: Point): void {
  const key = pointKey(from);
  neighbors.set(key, [...(neighbors.get(key) ?? []), to].sort(comparePoints));
}

function adjacentFolderGaps(folders: RoutingLayoutNode[], axis: "x" | "y"): number[] {
  const sorted = [...folders].sort((a, b) => axisStart(a, axis) - axisStart(b, axis) || a.id.localeCompare(b.id));
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!;
    const current = sorted[index]!;
    const previousEnd = axisEnd(previous, axis);
    const currentStart = axisStart(current, axis);
    if (currentStart - previousEnd > ROUTING_LANES.gatewayClearance * 2) {
      gaps.push(Math.round((previousEnd + currentStart) / 2));
    }
  }
  return gaps;
}

function axisStart(rect: { x: number; y: number }, axis: "x" | "y"): number {
  return axis === "x" ? rect.x : rect.y;
}

function axisEnd(rect: { x: number; y: number; width: number; height: number }, axis: "x" | "y"): number {
  return axis === "x" ? rect.x + rect.width : rect.y + rect.height;
}

function reconstructExternalPath(endKey: string, previousByKey: Map<string, { pointKey: string }>, nodes: Map<string, Point>): Point[] {
  const reversed: Point[] = [];
  let currentKey: string | undefined = endKey;
  while (currentKey) {
    const point = nodes.get(currentKey);
    if (point) {
      reversed.push(point);
    }
    currentKey = previousByKey.get(currentKey)?.pointKey;
  }
  return reversed.reverse();
}

function splitTrunkPathsAtSharedJunctions(paths: PlannedTrunkPath[]): PlannedTrunkPath[] {
  const allPoints = paths.flatMap((path) => path.points);
  return paths.map((path) => ({
    ...path,
    points: splitPathAtPoints(path.points, allPoints)
  }));
}

function splitPathAtPoints(path: Point[], allPoints: Point[]): Point[] {
  const result: Point[] = [];
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const splitPoints = allPoints
      .filter((point) => pointOnSegment(point, from, to))
      .sort((a, b) => Math.abs(a.x - from.x) + Math.abs(a.y - from.y) - (Math.abs(b.x - from.x) + Math.abs(b.y - from.y)) || comparePoints(a, b));
    for (const point of splitPoints) {
      if (!result.at(-1) || !samePoint(result.at(-1), point)) {
        result.push(clonePoint(point));
      }
    }
  }
  return result;
}

function buildExternalJunctions(corridorEdges: Map<string, ExternalCorridorEdge>): Map<string, ExternalJunction> {
  const edgeIdsByPoint = new Map<string, Set<string>>();
  const pointByKey = new Map<string, Point>();
  for (const edge of corridorEdges.values()) {
    for (const point of [edge.from, edge.to]) {
      const key = pointKey(point);
      pointByKey.set(key, point);
      edgeIdsByPoint.set(key, new Set([...(edgeIdsByPoint.get(key) ?? []), edge.id]));
    }
  }

  const junctions = new Map<string, ExternalJunction>();
  for (const [key, edgeIds] of [...edgeIdsByPoint.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const point = pointByKey.get(key)!;
    junctions.set(externalJunctionId(point), {
      id: externalJunctionId(point),
      x: point.x,
      y: point.y,
      connectedEdgeIds: [...edgeIds].sort()
    });
  }
  return junctions;
}

function externalObstacleRects(topLevelFolders: RoutingLayoutNode[]): { x: number; y: number; width: number; height: number }[] {
  return topLevelFolders;
}

function groupStreetFiles(
  folder: RoutingLayoutNode,
  gateway: FolderGateway,
  files: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>
): Map<string, RoutingLayoutNode[]> {
  const groups = new Map<string, RoutingLayoutNode[]>();
  for (const file of files) {
    const port = buildingPorts.get(file.id);
    if (!port) {
      continue;
    }
    const spurStart = spurStartForPort(port, folder);
    const key = gateway.side === "top" || gateway.side === "bottom"
      ? `row:${spurStart.y}`
      : `column:${spurStart.x}`;
    groups.set(key, [...(groups.get(key) ?? []), file]);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function collectorEdgesForGroup(
  folder: RoutingLayoutNode,
  spineEnd: Point,
  files: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>,
  obstacles: { x: number; y: number; width: number; height: number }[],
  groupKey: string
): CollectorBuildResult {
  const spurStarts = files
    .map((file) => {
      const port = buildingPorts.get(file.id);
      return port ? { fileId: file.id, point: spurStartForPort(port, folder) } : undefined;
    })
    .filter((entry): entry is { fileId: string; point: Point } => entry !== undefined)
    .sort((a, b) => a.fileId.localeCompare(b.fileId));
  if (spurStarts.length === 0) {
    return { edges: [], spineCollectorEdgeIds: [], entryEdgeIdByFileId: new Map() };
  }

  const segmentFilesByKey = new Map<string, Set<string>>();
  const segmentPointsByKey = new Map<string, { from: Point; to: Point }>();
  const entrySegmentKeyByFileId = new Map<string, string>();

  for (const spurStart of spurStarts) {
    const path = routeCollectorPath(folder, spineEnd, spurStart.point, obstacles);
    for (let index = 1; index < path.length; index += 1) {
      const from = path[index - 1]!;
      const to = path[index]!;
      const key = segmentKey(from, to);
      segmentPointsByKey.set(key, normalizeSegment(from, to));
      segmentFilesByKey.set(key, new Set([...(segmentFilesByKey.get(key) ?? []), spurStart.fileId]));
      if (samePoint(from, spurStart.point) || samePoint(to, spurStart.point)) {
        entrySegmentKeyByFileId.set(spurStart.fileId, key);
      }
    }
  }

  const segmentEntries = [...segmentPointsByKey.entries()].sort((a, b) => compareSegments(a[1], b[1]));
  const edgeIdBySegmentKey = new Map<string, string>();
  const groupFileIds = spurStarts.map((entry) => entry.fileId);
  const edges: StreetEdge[] = segmentEntries.map(([key, segment], index) => {
    const id = streetEdgeId(folder.id, "collector", `${groupKey}:path:${index + 1}`);
    edgeIdBySegmentKey.set(key, id);
    return {
      id,
      folderId: folder.id,
      kind: "collector" as const,
      from: segment.from,
      to: segment.to,
      connectedEdgeIds: [],
      connectedFileIds: groupFileIds
    };
  });

  const spineCollectorEdgeIds: string[] = [];
  for (const edge of edges) {
    const connectedEdgeIds = new Set<string>();
    if (samePoint(edge.from, spineEnd) || samePoint(edge.to, spineEnd)) {
      connectedEdgeIds.add(streetEdgeId(folder.id, "spine", "primary"));
      spineCollectorEdgeIds.push(edge.id);
    }
    for (const other of edges) {
      if (edge.id !== other.id && edgesShareEndpoint(edge, other)) {
        connectedEdgeIds.add(other.id);
      }
    }
    edge.connectedEdgeIds = [...connectedEdgeIds].sort();
  }

  return {
    edges,
    spineCollectorEdgeIds: [...new Set(spineCollectorEdgeIds)].sort(),
    entryEdgeIdByFileId: new Map([...entrySegmentKeyByFileId.entries()].map(([fileId, key]) => [fileId, edgeIdBySegmentKey.get(key)!]))
  };
}

function routeCollectorPath(folder: RoutingLayoutNode, start: Point, end: Point, obstacles: { x: number; y: number; width: number; height: number }[]): Point[] {
  const candidateXs = candidateAxisValues(folder.x, folder.x + folder.width, [start.x, end.x], obstacles.flatMap((obstacle) => [obstacle.x - ROUTING_LANES.obstaclePadding, obstacle.x + obstacle.width + ROUTING_LANES.obstaclePadding]));
  const candidateYs = candidateAxisValues(folder.y, folder.y + folder.height, [start.y, end.y], obstacles.flatMap((obstacle) => [obstacle.y - ROUTING_LANES.obstaclePadding, obstacle.y + obstacle.height + ROUTING_LANES.obstaclePadding]));
  const nodes = new Map<string, Point>();
  for (const x of candidateXs) {
    for (const y of candidateYs) {
      const point = { x, y };
      if (pointInRect(point, folder) && !pointInsideAnyObstacle(point, obstacles)) {
        nodes.set(pointKey(point), point);
      }
    }
  }
  nodes.set(pointKey(start), start);
  nodes.set(pointKey(end), end);

  const queue: Point[] = [start];
  const previousByKey = new Map<string, string | undefined>([[pointKey(start), undefined]]);
  const sortedNodes = [...nodes.values()].sort((a, b) => Math.abs(a.x - end.x) + Math.abs(a.y - end.y) - (Math.abs(b.x - end.x) + Math.abs(b.y - end.y)) || a.x - b.x || a.y - b.y);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (samePoint(current, end)) {
      return compactCollinearPoints(reconstructPath(pointKey(end), previousByKey, nodes));
    }
    const currentKey = pointKey(current);
    for (const next of sortedNodes) {
      const nextKey = pointKey(next);
      if (previousByKey.has(nextKey) || samePoint(current, next) || (current.x !== next.x && current.y !== next.y)) {
        continue;
      }
      if (segmentIntersectsAnyRect(current, next, obstacles) || !pointInRect(next, folder)) {
        continue;
      }
      previousByKey.set(nextKey, currentKey);
      queue.push(next);
    }
  }

  return compactCollinearPoints([start, { x: start.x, y: end.y }, end]);
}

function candidateAxisValues(min: number, max: number, required: number[], candidates: number[]): number[] {
  const values = new Set<number>();
  for (const value of [...required, ...candidates, min + ROUTING_LANES.spineClearance, max - ROUTING_LANES.spineClearance]) {
    values.add(clampToRange(value, min + ROUTING_LANES.folderBoundaryClearance, max - ROUTING_LANES.folderBoundaryClearance));
  }
  return [...values].sort((a, b) => a - b);
}

function pointInsideAnyObstacle(point: Point, obstacles: { x: number; y: number; width: number; height: number }[]): boolean {
  return obstacles.some((obstacle) => point.x > obstacle.x && point.x < obstacle.x + obstacle.width && point.y > obstacle.y && point.y < obstacle.y + obstacle.height);
}

function segmentIntersectsAnyRect(start: Point, end: Point, rects: { x: number; y: number; width: number; height: number }[]): boolean {
  return rects.some((rect) => segmentIntersectsRectInterior(start, end, rect));
}

function reconstructPath(endKey: string, previousByKey: Map<string, string | undefined>, nodes: Map<string, Point>): Point[] {
  const reversed: Point[] = [];
  let currentKey: string | undefined = endKey;
  while (currentKey) {
    const point = nodes.get(currentKey);
    if (point) {
      reversed.push(point);
    }
    currentKey = previousByKey.get(currentKey);
  }
  return reversed.reverse();
}

function compactCollinearPoints(points: Point[]): Point[] {
  const compacted: Point[] = [];
  for (const point of compactPoints(points)) {
    const previous = compacted.at(-1);
    const beforePrevious = compacted.at(-2);
    if (previous && beforePrevious && ((beforePrevious.x === previous.x && previous.x === point.x) || (beforePrevious.y === previous.y && previous.y === point.y))) {
      compacted[compacted.length - 1] = point;
    } else {
      compacted.push(point);
    }
  }
  return compacted;
}

type SpineCandidate = {
  end: Point;
  score: number;
};

function choosePrimarySpineEnd(
  folder: RoutingLayoutNode,
  gateway: FolderGateway,
  files: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>,
  obstacles: { x: number; y: number; width: number; height: number }[]
): Point {
  const fallback = inwardPointFromGateway(gateway, folder);
  const candidates = spineEndpointCandidates(folder, gateway, files, buildingPorts);
  const validCandidates: SpineCandidate[] = [];

  for (const end of candidates) {
    if (!pointInRect(end, folder) || segmentIntersectsAnyRect(gateway, end, obstacles)) {
      continue;
    }
    const paths = files
      .map((file) => {
        const port = buildingPorts.get(file.id);
        return port ? routeCollectorPath(folder, end, spurStartForPort(port, folder), obstacles) : undefined;
      })
      .filter((path): path is Point[] => path !== undefined);
    if (paths.some((path) => !pathIsLegalInFolder(path, folder, obstacles))) {
      continue;
    }
    validCandidates.push({ end, score: scoreSpineCandidate(folder, gateway, end, paths, files, buildingPorts) });
  }

  return validCandidates
    .sort((a, b) => a.score - b.score || a.end.x - b.end.x || a.end.y - b.end.y)[0]
    ?.end ?? fallback;
}

function spineEndpointCandidates(folder: RoutingLayoutNode, gateway: FolderGateway, files: RoutingLayoutNode[], buildingPorts: Map<string, BuildingPort>): Point[] {
  const axisValues = new Set<number>();
  const folderCenter = center(folder);
  const fallback = inwardPointFromGateway(gateway, folder);
  const vertical = gateway.side === "top" || gateway.side === "bottom";
  const minX = folder.x + ROUTING_LANES.folderBoundaryClearance;
  const maxX = folder.x + folder.width - ROUTING_LANES.folderBoundaryClearance;
  const minY = folder.y + ROUTING_LANES.folderHeaderClearance;
  const maxY = folder.y + folder.height - ROUTING_LANES.folderBoundaryClearance;
  const inwardMinY = gateway.side === "top" ? folder.y + ROUTING_LANES.folderHeaderClearance : minY;
  const inwardMaxY = gateway.side === "bottom" ? folder.y + folder.height - ROUTING_LANES.spineClearance : maxY;
  const inwardMinX = gateway.side === "left" ? folder.x + ROUTING_LANES.spineClearance : minX;
  const inwardMaxX = gateway.side === "right" ? folder.x + folder.width - ROUTING_LANES.spineClearance : maxX;
  const spurStarts = files
    .map((file) => {
      const port = buildingPorts.get(file.id);
      return port ? spurStartForPort(port, folder) : undefined;
    })
    .filter((point): point is Point => point !== undefined);

  if (vertical) {
    axisValues.add(folderCenter.y);
    axisValues.add(fallback.y);
    for (const point of spurStarts) {
      axisValues.add(point.y);
    }
    if (spurStarts.length > 0) {
      axisValues.add(averagePoint(spurStarts).y);
      axisValues.add(Math.min(...spurStarts.map((point) => point.y)));
      axisValues.add(Math.max(...spurStarts.map((point) => point.y)));
    }
    return [...axisValues]
      .map((y) => ({ x: gateway.x, y: clampToRange(y, inwardMinY, inwardMaxY) }))
      .filter(uniquePointFilter)
      .sort(comparePoints);
  }

  axisValues.add(folderCenter.x);
  axisValues.add(fallback.x);
  for (const point of spurStarts) {
    axisValues.add(point.x);
  }
  if (spurStarts.length > 0) {
    axisValues.add(averagePoint(spurStarts).x);
    axisValues.add(Math.min(...spurStarts.map((point) => point.x)));
    axisValues.add(Math.max(...spurStarts.map((point) => point.x)));
  }
  return [...axisValues]
    .map((x) => ({ x: clampToRange(x, inwardMinX, inwardMaxX), y: gateway.y }))
    .filter(uniquePointFilter)
    .sort(comparePoints);
}

function scoreSpineCandidate(
  folder: RoutingLayoutNode,
  gateway: FolderGateway,
  end: Point,
  collectorPaths: Point[][],
  files: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>
): number {
  const collectorLength = collectorPaths.reduce((total, path) => total + pathLength(path), 0);
  const bends = collectorPaths.reduce((total, path) => total + bendCount(path), 0);
  const gatewayDistance = Math.abs(gateway.x - end.x) + Math.abs(gateway.y - end.y);
  const clearance = distanceToRectBoundary(end, folder);
  const balance = collectorBalance(files, buildingPorts, folder, end);
  return Math.round(collectorLength * 10 + bends * 40 + gatewayDistance * 1.5 + balance * 2 - clearance * 3);
}

function collectorBalance(files: RoutingLayoutNode[], buildingPorts: Map<string, BuildingPort>, folder: RoutingLayoutNode, spineEnd: Point): number {
  const lengths = files
    .map((file) => {
      const port = buildingPorts.get(file.id);
      if (!port) {
        return 0;
      }
      const spurStart = spurStartForPort(port, folder);
      return Math.abs(spurStart.x - spineEnd.x) + Math.abs(spurStart.y - spineEnd.y);
    })
    .sort((a, b) => a - b);
  return lengths.length > 0 ? lengths.at(-1)! - lengths[0]! : 0;
}

function pathIsLegalInFolder(path: Point[], folder: RoutingLayoutNode, obstacles: { x: number; y: number; width: number; height: number }[]): boolean {
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!;
    const to = path[index]!;
    if ((from.x !== to.x && from.y !== to.y) || !pointInRect(from, folder) || !pointInRect(to, folder) || segmentIntersectsAnyRect(from, to, obstacles)) {
      return false;
    }
  }
  return true;
}

function pathLength(path: Point[]): number {
  let length = 0;
  for (let index = 1; index < path.length; index += 1) {
    length += Math.abs(path[index]!.x - path[index - 1]!.x) + Math.abs(path[index]!.y - path[index - 1]!.y);
  }
  return length;
}

function bendCount(path: Point[]): number {
  let bends = 0;
  for (let index = 2; index < path.length; index += 1) {
    const a = path[index - 2]!;
    const b = path[index - 1]!;
    const c = path[index]!;
    if ((a.x === b.x && b.y === c.y) || (a.y === b.y && b.x === c.x)) {
      bends += 1;
    }
  }
  return bends;
}

function distanceToRectBoundary(point: Point, rect: { x: number; y: number; width: number; height: number }): number {
  return Math.min(point.x - rect.x, rect.x + rect.width - point.x, point.y - rect.y, rect.y + rect.height - point.y);
}

function inwardPointFromGateway(gateway: FolderGateway, folder: RoutingLayoutNode): Point {
  switch (gateway.side) {
    case "top":
      return { x: gateway.x, y: clampToRange(folder.y + ROUTING_LANES.spineClearance, folder.y + ROUTING_LANES.folderBoundaryClearance, folder.y + folder.height - ROUTING_LANES.folderBoundaryClearance) };
    case "right":
      return { x: clampToRange(folder.x + folder.width - ROUTING_LANES.spineClearance, folder.x + ROUTING_LANES.folderBoundaryClearance, folder.x + folder.width - ROUTING_LANES.folderBoundaryClearance), y: gateway.y };
    case "bottom":
      return { x: gateway.x, y: clampToRange(folder.y + folder.height - ROUTING_LANES.spineClearance, folder.y + ROUTING_LANES.folderBoundaryClearance, folder.y + folder.height - ROUTING_LANES.folderBoundaryClearance) };
    case "left":
      return { x: clampToRange(folder.x + ROUTING_LANES.spineClearance, folder.x + ROUTING_LANES.folderBoundaryClearance, folder.x + folder.width - ROUTING_LANES.folderBoundaryClearance), y: gateway.y };
  }
}

function spurStartForPort(port: BuildingPort, folder: RoutingLayoutNode): Point {
  switch (port.side) {
    case "top":
      return { x: port.x, y: clampToRange(port.y - ROUTING_LANES.buildingSpurClearance, folder.y + ROUTING_LANES.folderBoundaryClearance, folder.y + folder.height - ROUTING_LANES.folderBoundaryClearance) };
    case "right":
      return { x: clampToRange(port.x + ROUTING_LANES.buildingSpurClearance, folder.x + ROUTING_LANES.folderBoundaryClearance, folder.x + folder.width - ROUTING_LANES.folderBoundaryClearance), y: port.y };
    case "bottom":
      return { x: port.x, y: clampToRange(port.y + ROUTING_LANES.buildingSpurClearance, folder.y + ROUTING_LANES.folderBoundaryClearance, folder.y + folder.height - ROUTING_LANES.folderBoundaryClearance) };
    case "left":
      return { x: clampToRange(port.x - ROUTING_LANES.buildingSpurClearance, folder.x + ROUTING_LANES.folderBoundaryClearance, folder.x + folder.width - ROUTING_LANES.folderBoundaryClearance), y: port.y };
  }
}

function streetEdgeId(folderId: string, kind: StreetEdgeKind, suffix: string): string {
  return `street:${folderId}:${kind}:${suffix}`;
}

function streetJunctionId(folderId: string, point: Point): string {
  return `junction:${folderId}:${point.x}:${point.y}`;
}

function parentChildConnectorId(parentFolderId: string, childFolderId: string): string {
  return `parent-child:${parentFolderId}->${childFolderId}`;
}

function folderTrunkId(providerFolderId: string, consumerFolderId: string): string {
  return `trunk:${providerFolderId}->${consumerFolderId}`;
}

function externalCorridorEdgeId(from: Point, to: Point): string {
  const segment = normalizeSegment(from, to);
  return `external-edge:${pointKey(segment.from)}->${pointKey(segment.to)}`;
}

function externalJunctionId(point: Point): string {
  return `external-junction:${point.x}:${point.y}`;
}

function compareStreetEdges(a: StreetEdge, b: StreetEdge): number {
  return edgeKindOrder(a.kind) - edgeKindOrder(b.kind) || a.id.localeCompare(b.id);
}

function edgeKindOrder(kind: StreetEdgeKind): number {
  switch (kind) {
    case "spine":
      return 0;
    case "collector":
      return 1;
    case "spur":
      return 2;
  }
}

interface ExternalFolderConnection {
  providerFolderId: string;
  consumerFolderId: string;
}

function externalFolderConnections(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>
): ExternalFolderConnection[] {
  const externalConnections: ExternalFolderConnection[] = [];
  const seen = new Set<string>();

  for (const connection of connections) {
    const providerId = providerFileId(connection);
    const consumerId = consumerFileId(connection);
    if (!providerId) {
      continue;
    }
    const providerFolderId = visibleFolderForFile(providerId, graphFiles, graphFolders, visibleFolderIds);
    const consumerFolderId = visibleFolderForFile(consumerId, graphFiles, graphFolders, visibleFolderIds);
    if (!providerFolderId || !consumerFolderId || providerFolderId === consumerFolderId) {
      continue;
    }
    const key = `${providerFolderId}->${consumerFolderId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    externalConnections.push({ providerFolderId, consumerFolderId });
  }

  return externalConnections.sort((a, b) => a.providerFolderId.localeCompare(b.providerFolderId) || a.consumerFolderId.localeCompare(b.consumerFolderId));
}

function participatingVisibleFileIds(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>,
  visibleFileIds: Set<string>
): Set<string> {
  const fileIds = new Set<string>();
  for (const connection of connections) {
    const providerId = providerFileId(connection);
    const consumerId = consumerFileId(connection);
    if (!providerId || providerId === consumerId) {
      continue;
    }
    const providerFolderId = visibleFolderForFile(providerId, graphFiles, graphFolders, visibleFolderIds);
    const consumerFolderId = visibleFolderForFile(consumerId, graphFiles, graphFolders, visibleFolderIds);
    if (!providerFolderId || !consumerFolderId) {
      continue;
    }
    if (visibleFileIds.has(providerId)) {
      fileIds.add(providerId);
    }
    if (visibleFileIds.has(consumerId)) {
      fileIds.add(consumerId);
    }
  }
  return fileIds;
}

function connectedFolderCentersByFile(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>,
  visibleFileIds: Set<string>,
  folderRects: Map<string, RoutingLayoutNode>
): Map<string, Point[]> {
  const centersByFile = new Map<string, Point[]>();

  for (const connection of connections) {
    const providerId = providerFileId(connection);
    const consumerId = consumerFileId(connection);
    if (!providerId) {
      continue;
    }
    const providerFolderId = visibleFolderForFile(providerId, graphFiles, graphFolders, visibleFolderIds);
    const consumerFolderId = visibleFolderForFile(consumerId, graphFiles, graphFolders, visibleFolderIds);
    if (!providerFolderId || !consumerFolderId || providerFolderId === consumerFolderId) {
      continue;
    }
    const providerFolder = folderRects.get(providerFolderId);
    const consumerFolder = folderRects.get(consumerFolderId);
    if (!providerFolder || !consumerFolder) {
      continue;
    }
    if (visibleFileIds.has(providerId)) {
      addPoint(centersByFile, providerId, center(consumerFolder));
    }
    if (visibleFileIds.has(consumerId)) {
      addPoint(centersByFile, consumerId, center(providerFolder));
    }
  }

  return centersByFile;
}

function visibleFolderForFile(
  fileId: string,
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>
): string | undefined {
  let folderId: string | undefined = graphFiles.get(fileId)?.folderId;
  while (folderId) {
    if (folderId !== "." && visibleFolderIds.has(folderId)) {
      return folderId;
    }
    folderId = graphFolders.get(folderId)?.parentFolderId;
  }
  return undefined;
}

function visibleSemanticConnections(
  connections: ImportConnection[],
  visibleFileIds: Set<string>,
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>
): ImportConnection[] {
  return connections
    .filter((connection) => connection.targetFileId && connection.targetFileId !== connection.sourceFileId)
    .filter((connection) => visibleFileIds.has(connection.sourceFileId) && visibleFileIds.has(connection.targetFileId!))
    .filter((connection) => Boolean(visibleFolderForFile(connection.sourceFileId, graphFiles, graphFolders, visibleFolderIds) && visibleFolderForFile(connection.targetFileId!, graphFiles, graphFolders, visibleFolderIds)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function participatingRouteFolderIds(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  visibleFolderIds: Set<string>
): Set<string> {
  const folderIds = new Set<string>();
  for (const connection of connections) {
    const providerFolderId = visibleFolderForFile(connection.targetFileId!, graphFiles, graphFolders, visibleFolderIds);
    const consumerFolderId = visibleFolderForFile(connection.sourceFileId, graphFiles, graphFolders, visibleFolderIds);
    for (const folderId of [providerFolderId, consumerFolderId]) {
      let currentId = folderId;
      while (currentId) {
        folderIds.add(currentId);
        currentId = graphFolders.get(currentId)?.parentFolderId;
        if (currentId === ".") {
          break;
        }
      }
    }
  }
  return folderIds;
}

function buildExactDependencyRoutes(
  connections: ImportConnection[],
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  folders: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  parentChildConnectors: Map<string, ParentChildConnector>,
  folderTrunks: Map<string, FolderTrunk>
): ExactDependencyRoute[] {
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const routes: ExactDependencyRoute[] = [];

  for (const connection of connections) {
    const providerId = connection.targetFileId;
    const consumerId = connection.sourceFileId;
    if (!providerId || providerId === consumerId) {
      continue;
    }

    const providerChain = visibleFolderChainForFile(providerId, graphFiles, graphFolders, folderRects);
    const consumerChain = visibleFolderChainForFile(consumerId, graphFiles, graphFolders, folderRects);
    const providerFolderId = providerChain[0];
    const consumerFolderId = consumerChain[0];
    const providerTopLevelFolderId = providerChain.at(-1);
    const consumerTopLevelFolderId = consumerChain.at(-1);
    const providerPort = buildingPorts.get(providerId);
    const consumerPort = buildingPorts.get(consumerId);
    if (!providerFolderId || !consumerFolderId || !providerTopLevelFolderId || !consumerTopLevelFolderId || !providerPort || !consumerPort) {
      continue;
    }

    const refs: RouteInfrastructureRef[] = [];
    appendUniqueRefs(refs, internalPathRefsFromFileToGateway(providerFolderId, providerId, internalStreetGraphs));
    const commonFolderId = providerTopLevelFolderId === consumerTopLevelFolderId
      ? lowestCommonVisibleFolder(providerChain, consumerChain)
      : providerTopLevelFolderId;
    appendUniqueRefs(refs, upwardFolderTraversalRefs(providerChain, commonFolderId, internalStreetGraphs, parentChildConnectors));

    let trunkId: string | undefined;
    if (providerTopLevelFolderId !== consumerTopLevelFolderId) {
      trunkId = folderTrunkId(providerTopLevelFolderId, consumerTopLevelFolderId);
      const trunk = folderTrunks.get(trunkId);
      if (trunk) {
        for (const edgeId of trunk.edgeIds) {
          appendUniqueRefs(refs, [{ kind: "external-corridor-edge", edgeId }]);
        }
      }
    }

    const consumerStartFolderId = providerTopLevelFolderId === consumerTopLevelFolderId ? commonFolderId : consumerTopLevelFolderId;
    appendUniqueRefs(refs, downwardFolderTraversalRefs(consumerChain, consumerStartFolderId, internalStreetGraphs, parentChildConnectors));
    appendUniqueRefs(refs, [...internalPathRefsFromFileToGateway(consumerFolderId, consumerId, internalStreetGraphs)].reverse());

    routes.push({
      id: exactDependencyRouteId(connection.id),
      connectionId: connection.id,
      providerFileId: providerId,
      consumerFileId: consumerId,
      providerFolderId,
      consumerFolderId,
      providerTopLevelFolderId,
      consumerTopLevelFolderId,
      providerPortId: providerId,
      consumerPortId: consumerId,
      infrastructureRefs: refs,
      trunkId,
      symbols: connection.symbols.map((symbol) => symbol.importedName).sort(),
      dependencyKind: connection.type,
      isCircular: connection.isCircular
    });
  }

  return routes.sort((a, b) => a.id.localeCompare(b.id));
}

function exactDependencyRouteId(connectionId: string): string {
  return `exact:${connectionId}`;
}

function visibleFolderChainForFile(
  fileId: string,
  graphFiles: Map<string, { folderId: string }>,
  graphFolders: Map<string, { parentFolderId?: string }>,
  folderRects: Map<string, RoutingLayoutNode>
): string[] {
  const chain: string[] = [];
  let folderId: string | undefined = graphFiles.get(fileId)?.folderId;
  while (folderId) {
    if (folderId !== "." && folderRects.has(folderId)) {
      chain.push(folderId);
    }
    folderId = graphFolders.get(folderId)?.parentFolderId;
  }
  return chain;
}

function lowestCommonVisibleFolder(providerChain: string[], consumerChain: string[]): string {
  const consumerIds = new Set(consumerChain);
  return providerChain.find((folderId) => consumerIds.has(folderId)) ?? providerChain.at(-1) ?? consumerChain.at(-1) ?? "";
}

function upwardFolderTraversalRefs(
  chain: string[],
  stopFolderId: string,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  parentChildConnectors: Map<string, ParentChildConnector>
): RouteInfrastructureRef[] {
  const refs: RouteInfrastructureRef[] = [];
  for (let index = 0; index < chain.length; index += 1) {
    const currentFolderId = chain[index]!;
    if (currentFolderId === stopFolderId) {
      break;
    }
    const parentFolderId = chain[index + 1];
    if (!parentFolderId) {
      break;
    }
    const connector = parentChildConnectors.get(parentChildConnectorId(parentFolderId, currentFolderId));
    if (!connector) {
      continue;
    }
    for (const edgeId of connector.edgeIds) {
      refs.push({ kind: "parent-child-connector-edge", connectorId: connector.id, edgeId });
    }
    appendUniqueRefs(refs, internalPathRefsFromJunctionToGateway(parentFolderId, connector.parentJunctionId, internalStreetGraphs));
  }
  return refs;
}

function downwardFolderTraversalRefs(
  consumerChain: string[],
  startFolderId: string,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  parentChildConnectors: Map<string, ParentChildConnector>
): RouteInfrastructureRef[] {
  const refs: RouteInfrastructureRef[] = [];
  const startIndex = consumerChain.indexOf(startFolderId);
  if (startIndex < 0) {
    return refs;
  }
  for (let index = startIndex - 1; index >= 0; index -= 1) {
    const childFolderId = consumerChain[index]!;
    const parentFolderId = consumerChain[index + 1]!;
    const connector = parentChildConnectors.get(parentChildConnectorId(parentFolderId, childFolderId));
    if (!connector) {
      continue;
    }
    appendUniqueRefs(refs, [...internalPathRefsFromJunctionToGateway(parentFolderId, connector.parentJunctionId, internalStreetGraphs)].reverse());
    for (const edgeId of [...connector.edgeIds].reverse()) {
      refs.push({ kind: "parent-child-connector-edge", connectorId: connector.id, edgeId });
    }
  }
  return refs;
}

function internalPathRefsFromFileToGateway(
  folderId: string,
  fileId: string,
  internalStreetGraphs: Map<string, InternalStreetGraph>
): RouteInfrastructureRef[] {
  const graph = internalStreetGraphs.get(folderId);
  const startEdgeId = graph?.fileEntryEdgeByFileId.get(fileId);
  return graph && startEdgeId ? internalPathRefsToGateway(graph, [startEdgeId]) : [];
}

function internalPathRefsFromJunctionToGateway(
  folderId: string,
  junctionId: string,
  internalStreetGraphs: Map<string, InternalStreetGraph>
): RouteInfrastructureRef[] {
  const graph = internalStreetGraphs.get(folderId);
  const junction = graph ? [...graph.edges].flatMap((edge) => [edge.from, edge.to]).find((point) => streetJunctionId(folderId, point) === junctionId) : undefined;
  if (!graph || !junction) {
    return [];
  }
  const startEdgeIds = graph.edges
    .filter((edge) => samePoint(edge.from, junction) || samePoint(edge.to, junction))
    .map((edge) => edge.id);
  return internalPathRefsToGateway(graph, startEdgeIds);
}

function internalPathRefsToGateway(graph: InternalStreetGraph, startEdgeIds: string[]): RouteInfrastructureRef[] {
  const spineIds = new Set(graph.spineEdgeIds);
  const queue = [...startEdgeIds].sort();
  const previous = new Map<string, string | undefined>();
  for (const edgeId of queue) {
    previous.set(edgeId, undefined);
  }

  while (queue.length > 0) {
    const currentEdgeId = queue.shift()!;
    if (spineIds.has(currentEdgeId)) {
      return reconstructEdgePath(currentEdgeId, previous).map((edgeId) => ({
        kind: "internal-street-edge" as const,
        folderId: graph.folderId,
        edgeId
      }));
    }
    const edge = graph.edgeById.get(currentEdgeId);
    for (const nextEdgeId of [...(edge?.connectedEdgeIds ?? [])].sort()) {
      if (!graph.edgeById.has(nextEdgeId) || previous.has(nextEdgeId)) {
        continue;
      }
      previous.set(nextEdgeId, currentEdgeId);
      queue.push(nextEdgeId);
    }
  }

  return startEdgeIds
    .filter((edgeId) => graph.edgeById.has(edgeId))
    .map((edgeId) => ({ kind: "internal-street-edge" as const, folderId: graph.folderId, edgeId }));
}

function reconstructEdgePath(endEdgeId: string, previousByEdgeId: Map<string, string | undefined>): string[] {
  const reversed: string[] = [];
  let currentEdgeId: string | undefined = endEdgeId;
  while (currentEdgeId) {
    reversed.push(currentEdgeId);
    currentEdgeId = previousByEdgeId.get(currentEdgeId);
  }
  return reversed.reverse();
}

function appendUniqueRefs(target: RouteInfrastructureRef[], refs: RouteInfrastructureRef[]): void {
  for (const ref of refs) {
    const previous = target.at(-1);
    if (!previous || routeInfrastructureRefKey(previous) !== routeInfrastructureRefKey(ref)) {
      target.push(ref);
    }
  }
}

function routeInfrastructureRefKey(ref: RouteInfrastructureRef): string {
  switch (ref.kind) {
    case "internal-street-edge":
      return `${ref.kind}:${ref.folderId}:${ref.edgeId}`;
    case "parent-child-connector-edge":
      return `${ref.kind}:${ref.connectorId}:${ref.edgeId}`;
    case "external-corridor-edge":
      return `${ref.kind}:${ref.edgeId}`;
  }
}

function validateRoutingPlan(
  files: RoutingLayoutNode[],
  folders: RoutingLayoutNode[],
  buildingPorts: Map<string, BuildingPort>,
  folderGateways: Map<string, FolderGateway>,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  streetJunctions: Map<string, StreetJunction>,
  parentChildConnectors: Map<string, ParentChildConnector>,
  externalRoutes: ExternalRouteBuildResult,
  externalConnections: ExternalFolderConnection[],
  participatingFileIds: Set<string>,
  routableConnections: ImportConnection[],
  exactDependencyRoutes: ExactDependencyRoute[]
): RoutingPlanValidation {
  const visibleFileIds = files.map((file) => file.id);
  const externallyConnectedFolderIds = new Set(externalConnections.flatMap((connection) => [connection.providerFolderId, connection.consumerFolderId]));
  const filePortCounts = countMapKeys([...buildingPorts.keys()]);
  const folderGatewayCounts = countMapKeys([...folderGateways.keys()]);
  const fileRects = new Map(files.map((file) => [file.id, getVisibleBuildingBounds(file)]));
  const folderRects = new Map(folders.map((folder) => [folder.id, folder]));
  const filesByParent = groupBy(files, (file) => file.parentId ?? "");
  const childFoldersByParent = groupBy(folders, (folder) => folder.parentId ?? "");
  const childFoldersNeedingConnectors = childFolderIdsNeedingParentConnectors(folders, folderGateways, internalStreetGraphs, externalConnections);
  const expandedFoldersNeedingStreets = new Set(
    folders
      .filter((folder) => !folder.collapsed && folderGateways.has(folder.id))
      .map((folder) => folder.id)
  );

  let filesWithZeroPorts = 0;
  let filesWithMultiplePorts = 0;
  for (const fileId of visibleFileIds) {
    const count = filePortCounts.get(fileId) ?? 0;
    if (count === 0) {
      filesWithZeroPorts += 1;
    } else if (count > 1) {
      filesWithMultiplePorts += 1;
    }
  }

  let foldersWithExternalDependenciesWithoutGateway = 0;
  let foldersWithMultipleGateways = 0;
  for (const folderId of externallyConnectedFolderIds) {
    const count = folderGatewayCounts.get(folderId) ?? 0;
    if (count === 0) {
      foldersWithExternalDependenciesWithoutGateway += 1;
    } else if (count > 1) {
      foldersWithMultipleGateways += 1;
    }
  }

  for (const port of buildingPorts.values()) {
    const bounds = fileRects.get(port.fileId);
    if (!bounds || !pointOnExactlyOneSide(port, bounds)) {
      filesWithMultiplePorts += 1;
    }
  }

  for (const gateway of folderGateways.values()) {
    const folder = folderRects.get(gateway.folderId);
    if (!folder || !pointOnExactlyOneSide(gateway, folder)) {
      foldersWithMultipleGateways += 1;
    }
  }

  let foldersWithGatewayWithoutStreetGraph = 0;
  let streetGraphsWithWrongGateway = 0;
  let streetGraphsMissingGatewaySpine = 0;
  let streetGraphsWithMultiplePrimarySpines = 0;
  let filesWithMissingStreetSpur = 0;
  let filesWithDuplicateStreetSpurs = 0;
  let streetSpursMissingPorts = 0;
  let streetEdgesWithDiagonalSegments = 0;
  let streetEdgesOutsideFolderBounds = 0;
  let streetEdgesIntersectingBuildings = 0;
  let streetEdgesIntersectingLabels = 0;
  let streetEdgesIntersectingNestedFolders = 0;
  let childFoldersMissingParentConnector = 0;
  let childFoldersWithDuplicateParentConnectors = 0;
  let parentChildConnectorsWrongGateway = 0;
  let parentChildConnectorsMissingParentJunction = 0;
  let parentChildConnectorsBypassingChildGateway = 0;
  let parentChildConnectorsBypassingParentStreetGraph = 0;
  let parentChildConnectorsWithDiagonalSegments = 0;
  let parentChildConnectorsOutsideParent = 0;
  let parentChildConnectorsIntersectingBuildings = 0;
  let parentChildConnectorsIntersectingLabels = 0;
  let parentChildConnectorsIntersectingSiblingFolders = 0;
  let parentChildConnectorsCrossingChildBoundary = 0;
  let duplicateFolderTrunks = 0;
  let folderTrunksWrongGateway = 0;
  let folderTrunksAttachedToNestedFolder = 0;
  let folderTrunksWithDiagonalSegments = 0;
  let folderTrunksIntersectingFolders = 0;
  let folderTrunksIntersectingBuildings = 0;
  let folderTrunksIntersectingLabels = 0;
  let duplicateExternalCorridorGeometry = 0;
  let externalJunctionsMissingCorridorEdge = 0;

  for (const folderId of expandedFoldersNeedingStreets) {
    const gateway = folderGateways.get(folderId);
    const graph = internalStreetGraphs.get(folderId);
    if (!graph) {
      foldersWithGatewayWithoutStreetGraph += 1;
      continue;
    }
    if (!gateway || graph.gatewayId !== gateway.id) {
      streetGraphsWithWrongGateway += 1;
    }
    if (graph.spineEdgeIds.length !== 1) {
      streetGraphsWithMultiplePrimarySpines += 1;
    }
    const firstSpine = graph.spineEdgeIds.length === 1 ? graph.edgeById.get(graph.spineEdgeIds[0]!) : undefined;
    if (!firstSpine || !samePoint(firstSpine.from, gateway)) {
      streetGraphsMissingGatewaySpine += 1;
    }
  }

  for (const graphFolderId of internalStreetGraphs.keys()) {
    if (!expandedFoldersNeedingStreets.has(graphFolderId)) {
      foldersWithGatewayWithoutStreetGraph += 1;
    }
  }

  for (const graph of internalStreetGraphs.values()) {
    const folder = folderRects.get(graph.folderId);
    if (!folder) {
      streetEdgesOutsideFolderBounds += graph.edges.length;
      continue;
    }
    if (graph.edgeById.size !== graph.edges.length) {
      streetGraphsWithWrongGateway += 1;
    }
    const folderFiles = filesByParent.get(folder.id) ?? [];
    const folderBuildings = folderFiles.map((file) => getVisibleBuildingBounds(file));
    const folderLabels = folderFiles.map(fileLabelRect);
    const nestedFolders = childFoldersByParent.get(folder.id) ?? [];
    const directParticipatingFileIds = folderFiles.filter((file) => participatingFileIds.has(file.id)).map((file) => file.id);

    for (const fileId of directParticipatingFileIds) {
      const matchingSpurs = graph.edges.filter((edge) => edge.kind === "spur" && edge.connectedFileIds.includes(fileId));
      if (matchingSpurs.length === 0 || !graph.fileEntryEdgeByFileId.has(fileId)) {
        filesWithMissingStreetSpur += 1;
      } else if (matchingSpurs.length > 1) {
        filesWithDuplicateStreetSpurs += 1;
      }
    }
    for (const fileId of graph.fileEntryEdgeByFileId.keys()) {
      if (!directParticipatingFileIds.includes(fileId)) {
        filesWithDuplicateStreetSpurs += 1;
      }
    }

    for (const edge of graph.edges) {
      if (!sameEdge(edge, graph.edgeById.get(edge.id))) {
        streetGraphsWithWrongGateway += 1;
      }
      if (!pointInRect(edge.from, folder) || !pointInRect(edge.to, folder)) {
        streetEdgesOutsideFolderBounds += 1;
      }
      if (edge.from.x !== edge.to.x && edge.from.y !== edge.to.y) {
        streetEdgesWithDiagonalSegments += 1;
      }
      if (edge.kind === "spur") {
        const fileId = edge.connectedFileIds[0];
        const port = fileId ? buildingPorts.get(fileId) : undefined;
        if (!port || !samePoint(edge.to, port)) {
          streetSpursMissingPorts += 1;
        }
      }
      const spurFileId = edge.kind === "spur" ? edge.connectedFileIds[0] : undefined;
      const blockingBuildings = edge.kind === "spur" && spurFileId
        ? folderBuildings.filter((building) => building.id !== spurFileId)
        : folderBuildings;
      const blockingLabels = edge.kind === "spur" && spurFileId
        ? folderLabels.filter((label) => label.id !== spurFileId)
        : folderLabels;
      streetEdgesIntersectingBuildings += countSegmentRectIntersections(edge, blockingBuildings);
      streetEdgesIntersectingLabels += countSegmentRectIntersections(edge, blockingLabels);
      streetEdgesIntersectingNestedFolders += countSegmentRectIntersections(edge, nestedFolders);
    }
  }

  const connectorCountsByPair = countMapKeys([...parentChildConnectors.values()].map((connector) => `${connector.parentFolderId}->${connector.childFolderId}`));
  for (const childFolderId of childFoldersNeedingConnectors) {
    const child = folderRects.get(childFolderId);
    const parentFolderId = child?.parentId;
    const count = parentFolderId ? connectorCountsByPair.get(`${parentFolderId}->${childFolderId}`) ?? 0 : 0;
    if (count === 0) {
      childFoldersMissingParentConnector += 1;
    } else if (count > 1) {
      childFoldersWithDuplicateParentConnectors += 1;
    }
  }

  for (const [pair, count] of connectorCountsByPair) {
    const childFolderId = pair.split("->").at(1);
    if (count > 1) {
      childFoldersWithDuplicateParentConnectors += 1;
    }
    if (childFolderId && !childFoldersNeedingConnectors.has(childFolderId)) {
      childFoldersWithDuplicateParentConnectors += 1;
    }
  }

  for (const connector of parentChildConnectors.values()) {
    const parent = folderRects.get(connector.parentFolderId);
    const child = folderRects.get(connector.childFolderId);
    const childGateway = folderGateways.get(connector.childFolderId);
    const parentJunction = streetJunctions.get(connector.parentJunctionId);
    const parentGraph = internalStreetGraphs.get(connector.parentFolderId);

    if (!childGateway || connector.childGatewayId !== childGateway.id) {
      parentChildConnectorsWrongGateway += 1;
    }
    if (!parentJunction || parentJunction.folderId !== connector.parentFolderId) {
      parentChildConnectorsMissingParentJunction += 1;
    }
    if (!parentGraph || !parentJunction?.connectedEdgeIds.some((edgeId) => parentGraph.edgeById.has(edgeId))) {
      parentChildConnectorsBypassingParentStreetGraph += 1;
    }
    if (!parent || !child) {
      parentChildConnectorsOutsideParent += connector.edges.length;
      continue;
    }
    if (connector.edges.length === 0 || connector.edgeIds.length !== connector.edges.length) {
      parentChildConnectorsBypassingParentStreetGraph += 1;
    }
    const firstEdge = connector.edges[0];
    const lastEdge = connector.edges.at(-1);
    if (!firstEdge || !samePoint(firstEdge.from, childGateway)) {
      parentChildConnectorsBypassingChildGateway += 1;
    }
    if (!lastEdge || !samePoint(lastEdge.to, parentJunction)) {
      parentChildConnectorsMissingParentJunction += 1;
    }

    const parentFiles = filesByParent.get(parent.id) ?? [];
    const parentBuildings = parentFiles.map((file) => getVisibleBuildingBounds(file));
    const parentLabels = parentFiles.map(fileLabelRect);
    const siblingFolders = (childFoldersByParent.get(parent.id) ?? []).filter((folder) => folder.id !== child.id);

    for (const edge of connector.edges) {
      if (edge.from.x !== edge.to.x && edge.from.y !== edge.to.y) {
        parentChildConnectorsWithDiagonalSegments += 1;
      }
      if (!pointInRect(edge.from, parent) || !pointInRect(edge.to, parent)) {
        parentChildConnectorsOutsideParent += 1;
      }
      parentChildConnectorsIntersectingBuildings += countSegmentRectIntersections(edge, parentBuildings);
      parentChildConnectorsIntersectingLabels += countSegmentRectIntersections(edge, parentLabels);
      parentChildConnectorsIntersectingSiblingFolders += countSegmentRectIntersections(edge, siblingFolders);
      parentChildConnectorsCrossingChildBoundary += countSegmentRectIntersections(edge, [child]);
    }
  }

  const trunkPairCounts = countMapKeys([...externalRoutes.folderTrunks.values()].map((trunk) => `${trunk.providerFolderId}->${trunk.consumerFolderId}`));
  duplicateFolderTrunks += [...trunkPairCounts.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0);
  const corridorGeometryCounts = countMapKeys([...externalRoutes.corridorEdges.values()].map((edge) => segmentKey(edge.from, edge.to)));
  duplicateExternalCorridorGeometry += [...corridorGeometryCounts.values()].filter((count) => count > 1).reduce((total, count) => total + count - 1, 0);
  const topLevelFolders = folders.filter((folder) => !folder.parentId);
  const topLevelFolderIds = new Set(topLevelFolders.map((folder) => folder.id));
  const topLevelFolderLabels = topLevelFolders.map(folderLabelRect);

  for (const edge of externalRoutes.corridorEdges.values()) {
    if (edge.from.x !== edge.to.x && edge.from.y !== edge.to.y) {
      folderTrunksWithDiagonalSegments += 1;
    }
    folderTrunksIntersectingFolders += countSegmentRectIntersections(edge, topLevelFolders);
    folderTrunksIntersectingLabels += countSegmentRectIntersections(edge, topLevelFolderLabels);
    for (const junctionId of edge.connectedJunctionIds) {
      const junction = externalRoutes.externalJunctions.get(junctionId);
      if (!junction || !junction.connectedEdgeIds.includes(edge.id)) {
        externalJunctionsMissingCorridorEdge += 1;
      }
    }
  }

  for (const junction of externalRoutes.externalJunctions.values()) {
    if (!junction.connectedEdgeIds.every((edgeId) => externalRoutes.corridorEdges.has(edgeId))) {
      externalJunctionsMissingCorridorEdge += 1;
    }
  }

  for (const trunk of externalRoutes.folderTrunks.values()) {
    const providerGateway = folderGateways.get(trunk.providerFolderId);
    const consumerGateway = folderGateways.get(trunk.consumerFolderId);
    if (!providerGateway || !consumerGateway || trunk.providerGatewayId !== providerGateway.id || trunk.consumerGatewayId !== consumerGateway.id) {
      folderTrunksWrongGateway += 1;
    }
    if (!topLevelFolderIds.has(trunk.providerFolderId) || !topLevelFolderIds.has(trunk.consumerFolderId)) {
      folderTrunksAttachedToNestedFolder += 1;
    }
    if (!samePoint(trunk.points[0], providerGateway) || !samePoint(trunk.points.at(-1), consumerGateway)) {
      folderTrunksWrongGateway += 1;
    }
    if (!trunk.edgeIds.every((edgeId) => externalRoutes.corridorEdges.has(edgeId))) {
      folderTrunksWrongGateway += 1;
    }
    if (!trunk.junctionIds.every((junctionId) => externalRoutes.externalJunctions.has(junctionId))) {
      externalJunctionsMissingCorridorEdge += 1;
    }
  }

  const exactRouteIds = countMapKeys(exactDependencyRoutes.map((route) => route.id));
  let exactRoutesWithDuplicateIds = 0;
  let exactRoutesMissingBuildingPort = 0;
  let exactRoutesMissingInfrastructure = 0;
  let sameFolderRoutesUsingExternalTrunk = 0;
  let crossTopLevelRoutesWithoutOneTrunk = 0;
  let exactRoutesWithWrongEndpointPort = 0;

  for (const count of exactRouteIds.values()) {
    if (count > 1) {
      exactRoutesWithDuplicateIds += count - 1;
    }
  }

  for (const route of exactDependencyRoutes) {
    const providerPort = buildingPorts.get(route.providerFileId);
    const consumerPort = buildingPorts.get(route.consumerFileId);
    if (!providerPort || !consumerPort) {
      exactRoutesMissingBuildingPort += 1;
    }
    const providerSpurId = internalStreetGraphs.get(route.providerFolderId)?.fileEntryEdgeByFileId.get(route.providerFileId);
    const consumerSpurId = internalStreetGraphs.get(route.consumerFolderId)?.fileEntryEdgeByFileId.get(route.consumerFileId);
    if (
      route.providerPortId !== route.providerFileId ||
      route.consumerPortId !== route.consumerFileId ||
      !providerSpurId ||
      !consumerSpurId ||
      route.infrastructureRefs[0]?.kind !== "internal-street-edge" ||
      route.infrastructureRefs[0]?.edgeId !== providerSpurId ||
      route.infrastructureRefs.at(-1)?.kind !== "internal-street-edge" ||
      route.infrastructureRefs.at(-1)?.edgeId !== consumerSpurId
    ) {
      exactRoutesWithWrongEndpointPort += 1;
    }
    for (const ref of route.infrastructureRefs) {
      if (!routeInfrastructureExists(ref, internalStreetGraphs, parentChildConnectors, externalRoutes.corridorEdges)) {
        exactRoutesMissingInfrastructure += 1;
      }
    }
    if (route.providerTopLevelFolderId === route.consumerTopLevelFolderId && route.trunkId) {
      sameFolderRoutesUsingExternalTrunk += 1;
    }
    if (route.providerTopLevelFolderId !== route.consumerTopLevelFolderId) {
      const trunk = route.trunkId ? externalRoutes.folderTrunks.get(route.trunkId) : undefined;
      const trunkRefs = route.infrastructureRefs.filter((ref) => ref.kind === "external-corridor-edge");
      if (
        !route.trunkId ||
        !trunk ||
        route.trunkId !== folderTrunkId(route.providerTopLevelFolderId, route.consumerTopLevelFolderId) ||
        trunkRefs.length !== trunk.edgeIds.length
      ) {
        crossTopLevelRoutesWithoutOneTrunk += 1;
      }
    }
  }

  return {
    visibleFileCount: files.length,
    buildingPortCount: buildingPorts.size,
    filesWithZeroPorts,
    filesWithMultiplePorts,
    externallyConnectedFolderCount: externallyConnectedFolderIds.size,
    expandedFoldersNeedingStreetCount: expandedFoldersNeedingStreets.size,
    participatingFileCount: participatingFileIds.size,
    foldersWithExternalDependenciesWithoutGateway,
    foldersWithMultipleGateways,
    internalStreetGraphCount: internalStreetGraphs.size,
    foldersWithGatewayWithoutStreetGraph,
    streetGraphsWithWrongGateway,
    streetGraphsMissingGatewaySpine,
    streetGraphsWithMultiplePrimarySpines,
    filesWithMissingStreetSpur,
    filesWithDuplicateStreetSpurs,
    streetSpursMissingPorts,
    streetEdgesWithDiagonalSegments,
    streetEdgesOutsideFolderBounds,
    streetEdgesIntersectingBuildings,
    streetEdgesIntersectingLabels,
    streetEdgesIntersectingNestedFolders,
    streetJunctionCount: streetJunctions.size,
    childFoldersNeedingParentConnector: childFoldersNeedingConnectors.size,
    parentChildConnectorCount: parentChildConnectors.size,
    childFoldersMissingParentConnector,
    childFoldersWithDuplicateParentConnectors,
    parentChildConnectorsWrongGateway,
    parentChildConnectorsMissingParentJunction,
    parentChildConnectorsBypassingChildGateway,
    parentChildConnectorsBypassingParentStreetGraph,
    parentChildConnectorsWithDiagonalSegments,
    parentChildConnectorsOutsideParent,
    parentChildConnectorsIntersectingBuildings,
    parentChildConnectorsIntersectingLabels,
    parentChildConnectorsIntersectingSiblingFolders,
    parentChildConnectorsCrossingChildBoundary,
    expectedFolderTrunkCount: externalRoutes.expectedFolderTrunkCount,
    folderTrunkCount: externalRoutes.folderTrunks.size,
    externalCorridorEdgeCount: externalRoutes.corridorEdges.size,
    externalJunctionCount: externalRoutes.externalJunctions.size,
    duplicateFolderTrunks,
    folderTrunksWrongGateway,
    folderTrunksAttachedToNestedFolder,
    folderTrunksWithDiagonalSegments,
    folderTrunksIntersectingFolders,
    folderTrunksIntersectingBuildings,
    folderTrunksIntersectingLabels,
    duplicateExternalCorridorGeometry,
    externalJunctionsMissingCorridorEdge,
    semanticDependencyCount: routableConnections.length,
    exactDependencyRouteCount: exactDependencyRoutes.length,
    exactRoutesWithDuplicateIds,
    exactRoutesMissingBuildingPort,
    exactRoutesMissingInfrastructure,
    sameFolderRoutesUsingExternalTrunk,
    crossTopLevelRoutesWithoutOneTrunk,
    exactRoutesWithWrongEndpointPort
  };
}

function routeInfrastructureExists(
  ref: RouteInfrastructureRef,
  internalStreetGraphs: Map<string, InternalStreetGraph>,
  parentChildConnectors: Map<string, ParentChildConnector>,
  externalCorridorEdges: Map<string, ExternalCorridorEdge>
): boolean {
  switch (ref.kind) {
    case "internal-street-edge":
      return internalStreetGraphs.get(ref.folderId)?.edgeById.has(ref.edgeId) ?? false;
    case "parent-child-connector-edge":
      return parentChildConnectors.get(ref.connectorId)?.edgeIds.includes(ref.edgeId) ?? false;
    case "external-corridor-edge":
      return externalCorridorEdges.has(ref.edgeId);
  }
}

function hasRoutingPlanViolation(validation: RoutingPlanValidation): boolean {
  return (
    validation.visibleFileCount !== validation.buildingPortCount ||
    validation.filesWithZeroPorts > 0 ||
    validation.filesWithMultiplePorts > 0 ||
    validation.foldersWithExternalDependenciesWithoutGateway > 0 ||
    validation.foldersWithMultipleGateways > 0 ||
    validation.expandedFoldersNeedingStreetCount !== validation.internalStreetGraphCount ||
    validation.foldersWithGatewayWithoutStreetGraph > 0 ||
    validation.streetGraphsWithWrongGateway > 0 ||
    validation.streetGraphsMissingGatewaySpine > 0 ||
    validation.streetGraphsWithMultiplePrimarySpines > 0 ||
    validation.filesWithMissingStreetSpur > 0 ||
    validation.filesWithDuplicateStreetSpurs > 0 ||
    validation.streetSpursMissingPorts > 0 ||
    validation.streetEdgesWithDiagonalSegments > 0 ||
    validation.streetEdgesOutsideFolderBounds > 0 ||
    validation.streetEdgesIntersectingBuildings > 0 ||
    validation.streetEdgesIntersectingLabels > 0 ||
    validation.streetEdgesIntersectingNestedFolders > 0 ||
    validation.childFoldersNeedingParentConnector !== validation.parentChildConnectorCount ||
    validation.childFoldersMissingParentConnector > 0 ||
    validation.childFoldersWithDuplicateParentConnectors > 0 ||
    validation.parentChildConnectorsWrongGateway > 0 ||
    validation.parentChildConnectorsMissingParentJunction > 0 ||
    validation.parentChildConnectorsBypassingChildGateway > 0 ||
    validation.parentChildConnectorsBypassingParentStreetGraph > 0 ||
    validation.parentChildConnectorsWithDiagonalSegments > 0 ||
    validation.parentChildConnectorsOutsideParent > 0 ||
    validation.parentChildConnectorsIntersectingBuildings > 0 ||
    validation.parentChildConnectorsIntersectingLabels > 0 ||
    validation.parentChildConnectorsIntersectingSiblingFolders > 0 ||
    validation.parentChildConnectorsCrossingChildBoundary > 0 ||
    validation.expectedFolderTrunkCount !== validation.folderTrunkCount ||
    validation.duplicateFolderTrunks > 0 ||
    validation.folderTrunksWrongGateway > 0 ||
    validation.folderTrunksAttachedToNestedFolder > 0 ||
    validation.folderTrunksWithDiagonalSegments > 0 ||
    validation.folderTrunksIntersectingFolders > 0 ||
    validation.folderTrunksIntersectingBuildings > 0 ||
    validation.folderTrunksIntersectingLabels > 0 ||
    validation.duplicateExternalCorridorGeometry > 0 ||
    validation.externalJunctionsMissingCorridorEdge > 0 ||
    validation.semanticDependencyCount !== validation.exactDependencyRouteCount ||
    validation.exactRoutesWithDuplicateIds > 0 ||
    validation.exactRoutesMissingBuildingPort > 0 ||
    validation.exactRoutesMissingInfrastructure > 0 ||
    validation.sameFolderRoutesUsingExternalTrunk > 0 ||
    validation.crossTopLevelRoutesWithoutOneTrunk > 0 ||
    validation.exactRoutesWithWrongEndpointPort > 0
  );
}

function emptyRoutingPlanValidation(): RoutingPlanValidation {
  return {
    visibleFileCount: 0,
    buildingPortCount: 0,
    filesWithZeroPorts: 0,
    filesWithMultiplePorts: 0,
    externallyConnectedFolderCount: 0,
    expandedFoldersNeedingStreetCount: 0,
    participatingFileCount: 0,
    foldersWithExternalDependenciesWithoutGateway: 0,
    foldersWithMultipleGateways: 0,
    internalStreetGraphCount: 0,
    foldersWithGatewayWithoutStreetGraph: 0,
    streetGraphsWithWrongGateway: 0,
    streetGraphsMissingGatewaySpine: 0,
    streetGraphsWithMultiplePrimarySpines: 0,
    filesWithMissingStreetSpur: 0,
    filesWithDuplicateStreetSpurs: 0,
    streetSpursMissingPorts: 0,
    streetEdgesWithDiagonalSegments: 0,
    streetEdgesOutsideFolderBounds: 0,
    streetEdgesIntersectingBuildings: 0,
    streetEdgesIntersectingLabels: 0,
    streetEdgesIntersectingNestedFolders: 0,
    streetJunctionCount: 0,
    childFoldersNeedingParentConnector: 0,
    parentChildConnectorCount: 0,
    childFoldersMissingParentConnector: 0,
    childFoldersWithDuplicateParentConnectors: 0,
    parentChildConnectorsWrongGateway: 0,
    parentChildConnectorsMissingParentJunction: 0,
    parentChildConnectorsBypassingChildGateway: 0,
    parentChildConnectorsBypassingParentStreetGraph: 0,
    parentChildConnectorsWithDiagonalSegments: 0,
    parentChildConnectorsOutsideParent: 0,
    parentChildConnectorsIntersectingBuildings: 0,
    parentChildConnectorsIntersectingLabels: 0,
    parentChildConnectorsIntersectingSiblingFolders: 0,
    parentChildConnectorsCrossingChildBoundary: 0,
    expectedFolderTrunkCount: 0,
    folderTrunkCount: 0,
    externalCorridorEdgeCount: 0,
    externalJunctionCount: 0,
    duplicateFolderTrunks: 0,
    folderTrunksWrongGateway: 0,
    folderTrunksAttachedToNestedFolder: 0,
    folderTrunksWithDiagonalSegments: 0,
    folderTrunksIntersectingFolders: 0,
    folderTrunksIntersectingBuildings: 0,
    folderTrunksIntersectingLabels: 0,
    duplicateExternalCorridorGeometry: 0,
    externalJunctionsMissingCorridorEdge: 0,
    semanticDependencyCount: 0,
    exactDependencyRouteCount: 0,
    exactRoutesWithDuplicateIds: 0,
    exactRoutesMissingBuildingPort: 0,
    exactRoutesMissingInfrastructure: 0,
    sameFolderRoutesUsingExternalTrunk: 0,
    crossTopLevelRoutesWithoutOneTrunk: 0,
    exactRoutesWithWrongEndpointPort: 0
  };
}

function buildingPortOnBounds(fileId: string, bounds: Rect, side: PortSide): BuildingPort {
  const point = pointOnBounds(bounds, side);
  return { fileId, side, x: point.x, y: point.y };
}

function gatewayOnBounds(folderId: string, bounds: RoutingLayoutNode, side: PortSide): FolderGateway {
  const point = pointOnBounds(bounds, side);
  return { id: `gateway:${folderId}`, folderId, side, x: point.x, y: point.y };
}

function pointOnBounds(bounds: { x: number; y: number; width: number; height: number }, side: PortSide): Point {
  switch (side) {
    case "top":
      return { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y) };
    case "right":
      return { x: Math.round(bounds.x + bounds.width), y: Math.round(bounds.y + bounds.height / 2) };
    case "bottom":
      return { x: Math.round(bounds.x + bounds.width / 2), y: Math.round(bounds.y + bounds.height) };
    case "left":
      return { x: Math.round(bounds.x), y: Math.round(bounds.y + bounds.height / 2) };
  }
}

function sideFacingAverage(bounds: { x: number; y: number; width: number; height: number }, points: Point[]): PortSide {
  return sideFacingPoint(bounds, averagePoint(points));
}

function sideFacingPoint(bounds: { x: number; y: number; width: number; height: number }, point: Point): PortSide {
  const boundsCenter = center(bounds);
  const dx = point.x - boundsCenter.x;
  const dy = point.y - boundsCenter.y;
  const candidates: PortSide[] = [];
  if (dy < 0) {
    candidates.push("top");
  } else if (dy > 0) {
    candidates.push("bottom");
  }
  if (dx > 0) {
    candidates.push("right");
  } else if (dx < 0) {
    candidates.push("left");
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  if (Math.abs(dy) > Math.abs(dx)) {
    return dy >= 0 ? "bottom" : "top";
  }
  return SIDE_PRIORITY.find((side) => candidates.includes(side)) ?? "top";
}

function stableSideForId(id: string): PortSide {
  const hash = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
  return SIDE_PRIORITY[hash % SIDE_PRIORITY.length] ?? "top";
}

function pointOnExactlyOneSide(point: Point, bounds: { x: number; y: number; width: number; height: number }): boolean {
  const sideMatches = [
    point.y === bounds.y && point.x >= bounds.x && point.x <= bounds.x + bounds.width,
    point.x === bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height,
    point.y === bounds.y + bounds.height && point.x >= bounds.x && point.x <= bounds.x + bounds.width,
    point.x === bounds.x && point.y >= bounds.y && point.y <= bounds.y + bounds.height
  ].filter(Boolean).length;
  return sideMatches === 1;
}

interface Point {
  x: number;
  y: number;
}

function center(rect: { x: number; y: number; width: number; height: number }): Point {
  return {
    x: Math.round(rect.x + rect.width / 2),
    y: Math.round(rect.y + rect.height / 2)
  };
}

function averagePoint(points: Point[]): Point {
  return {
    x: Math.round(points.reduce((total, point) => total + point.x, 0) / points.length),
    y: Math.round(points.reduce((total, point) => total + point.y, 0) / points.length)
  };
}

function uniquePoints(points: Point[]): Point[] {
  const seen = new Set<string>();
  const result: Point[] = [];
  for (const point of points) {
    const key = `${point.x}:${point.y}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(point);
    }
  }
  return result;
}

function addPoint(map: Map<string, Point[]>, key: string, point: Point): void {
  map.set(key, [...(map.get(key) ?? []), point]);
}

function uniquePointFilter(point: Point, index: number, points: Point[]): boolean {
  return points.findIndex((candidate) => samePoint(candidate, point)) === index;
}

function comparePoints(a: Point, b: Point): number {
  return a.x - b.x || a.y - b.y;
}

function clonePoint(point: Point): Point {
  return { x: point.x, y: point.y };
}

function samePoint(left: Point | undefined, right: Point | undefined): boolean {
  return Boolean(left && right && left.x === right.x && left.y === right.y);
}

function sameEdge(left: StreetEdge | undefined, right: StreetEdge | undefined): boolean {
  return Boolean(
    left &&
    right &&
    left.id === right.id &&
    left.kind === right.kind &&
    samePoint(left.from, right.from) &&
    samePoint(left.to, right.to)
  );
}

function segmentKey(from: Point, to: Point): string {
  const segment = normalizeSegment(from, to);
  return `${pointKey(segment.from)}->${pointKey(segment.to)}`;
}

function normalizeSegment(from: Point, to: Point): { from: Point; to: Point } {
  if (from.x < to.x || (from.x === to.x && from.y <= to.y)) {
    return { from, to };
  }
  return { from: to, to: from };
}

function sameSegment(left: { from: Point; to: Point }, right: { from: Point; to: Point }): boolean {
  return samePoint(left.from, right.from) && samePoint(left.to, right.to);
}

function segmentOverlapsAny(segment: { from: Point; to: Point }, candidates: { from: Point; to: Point }[]): boolean {
  return candidates.some((candidate) => segmentsOverlap(segment, candidate));
}

function segmentsOverlap(left: { from: Point; to: Point }, right: { from: Point; to: Point }): boolean {
  if (left.from.x === left.to.x && right.from.x === right.to.x && left.from.x === right.from.x) {
    return rangesOverlap(left.from.y, left.to.y, right.from.y, right.to.y);
  }
  if (left.from.y === left.to.y && right.from.y === right.to.y && left.from.y === right.from.y) {
    return rangesOverlap(left.from.x, left.to.x, right.from.x, right.to.x);
  }
  return false;
}

function rangesOverlap(a1: number, a2: number, b1: number, b2: number): boolean {
  const leftMin = Math.min(a1, a2);
  const leftMax = Math.max(a1, a2);
  const rightMin = Math.min(b1, b2);
  const rightMax = Math.max(b1, b2);
  return Math.max(leftMin, rightMin) < Math.min(leftMax, rightMax);
}

function pointOnSegment(point: Point, from: Point, to: Point): boolean {
  if (from.x === to.x && point.x === from.x) {
    return point.y >= Math.min(from.y, to.y) && point.y <= Math.max(from.y, to.y);
  }
  if (from.y === to.y && point.y === from.y) {
    return point.x >= Math.min(from.x, to.x) && point.x <= Math.max(from.x, to.x);
  }
  return false;
}

function compareSegments(a: { from: Point; to: Point }, b: { from: Point; to: Point }): number {
  return a.from.x - b.from.x || a.from.y - b.from.y || a.to.x - b.to.x || a.to.y - b.to.y;
}

function edgesShareEndpoint(a: StreetEdge, b: StreetEdge): boolean {
  return samePoint(a.from, b.from) || samePoint(a.from, b.to) || samePoint(a.to, b.from) || samePoint(a.to, b.to);
}

function pointKey(point: Point): string {
  return `${point.x}:${point.y}`;
}

function pointInRect(point: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function countSegmentRectIntersections(edge: { from: Point; to: Point }, rects: { x: number; y: number; width: number; height: number }[]): number {
  let count = 0;
  for (const rect of rects) {
    if (segmentIntersectsRectInterior(edge.from, edge.to, rect)) {
      count += 1;
    }
  }
  return count;
}

function segmentIntersectsRectInterior(start: Point, end: Point, rect: { x: number; y: number; width: number; height: number }): boolean {
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

function fileLabelRect(file: RoutingLayoutNode): Rect {
  return {
    id: file.id,
    x: file.x + 4,
    y: file.y + 84,
    width: file.width - 8,
    height: 28
  };
}

function folderLabelRect(folder: RoutingLayoutNode): Rect {
  return {
    id: folder.id,
    x: folder.x + 8,
    y: folder.y + 8,
    width: folder.width - 16,
    height: 28
  };
}

function compactPoints(points: Point[]): Point[] {
  const compacted: Point[] = [];
  for (const point of points) {
    const previous = compacted.at(-1);
    if (!previous || !samePoint(previous, point)) {
      compacted.push(point);
    }
  }
  return compacted;
}

function clampToRange(value: number, min: number, max: number): number {
  return Math.round(Math.max(min, Math.min(max, value)));
}

function countMapKeys(keys: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function groupBy<T>(items: T[], keyForItem: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyForItem(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function isDevelopmentRuntime(): boolean {
  return typeof process === "undefined" || process.env.NODE_ENV !== "production";
}
