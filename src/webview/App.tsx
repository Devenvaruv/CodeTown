import { useEffect, useMemo, useRef, useState } from "react";
import { getVisibleBuildingBounds, VISIBLE_BUILDING_GEOMETRY } from "../graph/layout/buildingGeometry";
import { buildTownLayout, type LayoutDirection, type LayoutNode, type Point, type TownLayout } from "../graph/layout/elkLayout";
import { visibleRoadsForState } from "../graph/layout/roadVisibility";
import type { FileNode, FolderNode, ImportConnection, ProjectGraph } from "../shared/graphTypes";
import type { ExtensionToWebviewMessage } from "../shared/messageTypes";
import { isExtensionToWebviewMessage } from "../shared/messageTypes";
import { MAP_SIZES, assetUrl, buildingAssetForFileKind, mapAssets, type OverlayAssetKind } from "./assets/mapAssets";
import { generateDecorScatter, type DecorScatterItem } from "./renderer/decorScatter";
import { roadPathData } from "./renderer/roadGeometry";
import { ENABLE_AGENT_ACTIVITY_DEMO, type AgentActivityState } from "./state/agentActivity";
import { fileOverlayStates } from "./state/overlays";
import { vscodeApi } from "./vscodeApi";

type Selection = { kind: "file"; id: string } | { kind: "folder"; id: string } | { kind: "road"; id: string };

interface Filters {
  runtime: boolean;
  typeOnly: boolean;
  dynamic: boolean;
  reExport: boolean;
  circular: boolean;
  tests: boolean;
}

const defaultFilters: Filters = {
  runtime: true,
  typeOnly: true,
  dynamic: true,
  reExport: true,
  circular: true,
  tests: true
};

export function App(): JSX.Element {
  const [graph, setGraph] = useState<ProjectGraph | undefined>();
  const [status, setStatus] = useState("Waiting for analysis");
  const [selection, setSelection] = useState<Selection | undefined>();
  const [hoveredFileId, setHoveredFileId] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showExternal, setShowExternal] = useState(false);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("RIGHT");
  const [showAllDependencies, setShowAllDependencies] = useState(false);
  const [showStreetDebug, setShowStreetDebug] = useState(() => isLayoutDebugModeEnabled());
  const [layout, setLayout] = useState<TownLayout | undefined>();
  const [showProjectHud, setShowProjectHud] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const mapPanelRef = useRef<HTMLElement | null>(null);
  const previousFileIdsRef = useRef<Set<string>>(new Set());
  const previousLayoutPositionsRef = useRef<Map<string, Point>>(new Map());
  const layoutRequestIdRef = useRef(0);
  const autoFitProjectIdRef = useRef<string | undefined>();
  const [newlyCreatedFileIds, setNewlyCreatedFileIds] = useState<Set<string>>(() => new Set());
  const [agentState] = useState<AgentActivityState | undefined>(undefined);

  useEffect(() => {
    const handler = (event: MessageEvent<unknown>) => {
      const message = event.data;
      if (!isExtensionToWebviewMessage(message)) {
        return;
      }
      handleExtensionMessage(message);
    };
    window.addEventListener("message", handler);
    vscodeApi().postMessage({ type: "ready" });
    return () => window.removeEventListener("message", handler);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputTarget(event.target)) {
        return;
      }

      const step = event.shiftKey ? 220 : 80;
      const deltaByKey: Record<string, [number, number] | undefined> = {
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0]
      };
      const delta = deltaByKey[event.key];
      if (!delta) {
        return;
      }

      event.preventDefault();
      mapPanelRef.current?.scrollBy({ left: delta[0], top: delta[1], behavior: event.shiftKey ? "smooth" : "auto" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleExtensionMessage = (message: ExtensionToWebviewMessage): void => {
    switch (message.type) {
      case "analysisStarted":
        setStatus("Analyzing workspace");
        return;
      case "analysisProgress":
        setStatus(message.total ? `${message.phase} ${message.completed ?? 0}/${message.total}` : message.phase);
        return;
      case "graphLoaded":
        setGraph(message.graph);
        previousFileIdsRef.current = new Set(message.graph.files.map((file) => file.id));
        setNewlyCreatedFileIds(new Set());
        setStatus(`${message.graph.project.fileCount} files, ${message.graph.project.connectionCount} dependencies`);
        return;
      case "graphUpdated": {
        const previousFileIds = previousFileIdsRef.current;
        const currentFileIds = new Set(message.graph.files.map((file) => file.id));
        const created = message.graph.files.filter((file) => !previousFileIds.has(file.id)).map((file) => file.id);
        previousFileIdsRef.current = currentFileIds;
        setNewlyCreatedFileIds(new Set(created));
        setGraph(message.graph);
        setStatus(`${message.graph.project.fileCount} files, ${message.graph.project.connectionCount} dependencies`);
        return;
      }
      case "analysisFailed":
        setStatus(message.message);
        return;
      case "fileFocused":
        setSelection({ kind: "file", id: message.fileId });
        return;
    }
  };

  const fileMap = useMemo(() => new Map(graph?.files.map((file) => [file.id, file]) ?? []), [graph]);
  const folderMap = useMemo(() => new Map(graph?.folders.map((folder) => [folder.id, folder]) ?? []), [graph]);
  const connectionMap = useMemo(() => new Map(graph?.connections.map((connection) => [connection.id, connection]) ?? []), [graph]);

  const searchMatches = useMemo(() => findSearchMatches(graph, query), [graph, query]);
  const visibleFolderIds = useMemo(() => new Set(graph?.folders.map((folder) => folder.id) ?? ["."]), [graph]);
  const visibleConnections = useMemo(
    () => (graph ? graph.connections.filter((connection) => isConnectionVisible(connection, graph, fileMap, filters, showExternal)) : []),
    [graph, fileMap, filters, showExternal]
  );

  useEffect(() => {
    if (!graph) {
      setLayout(undefined);
      return;
    }

    const requestId = layoutRequestIdRef.current + 1;
    layoutRequestIdRef.current = requestId;
    const timeoutId = window.setTimeout(() => {
      void buildTownLayout(graph, visibleFolderIds, {
        direction: layoutDirection,
        visibleConnections,
        previousPositions: previousLayoutPositionsRef.current
      })
        .then((nextLayout) => {
          if (layoutRequestIdRef.current !== requestId) {
            return;
          }
          setLayout(nextLayout);
          previousLayoutPositionsRef.current = positionsFromLayout(nextLayout);
          if (autoFitProjectIdRef.current !== graph.project.id) {
            autoFitProjectIdRef.current = graph.project.id;
            fitLayoutToPanel(nextLayout);
          }
        })
        .catch((error: unknown) => {
          if (layoutRequestIdRef.current !== requestId) {
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          console.error("Codebase Town layout failed.", error);
          setLayout(undefined);
          setStatus(`Layout failed: ${message}`);
        });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [graph, visibleFolderIds, visibleConnections, layoutDirection]);

  const connectedIds = useMemo(() => connectedEntityIds(selection, graph), [selection, graph]);
  const renderedRoads = useMemo(
    () => (layout && layout.layoutWarnings.length === 0 ? visibleRoadsForState(layout.roads, graph, { selection, showAllDependencies }) : []),
    [layout, graph, selection, showAllDependencies]
  );
  const foldersByDepth = useMemo(() => [...(layout?.folders ?? [])].sort((a, b) => (folderMap.get(a.id)?.depth ?? 0) - (folderMap.get(b.id)?.depth ?? 0) || a.id.localeCompare(b.id)), [layout, folderMap]);
  const hasCompleteLayout = useMemo(() => Boolean(layout && layout.layoutWarnings.length === 0 && layout.files.every(hasValidBounds) && layout.folders.every(hasValidBounds)), [layout]);
  const decorItems = useMemo(() => (layout && hasCompleteLayout ? generateDecorScatter(layout) : []), [layout, hasCompleteLayout]);
  const selectedFile = selection?.kind === "file" ? fileMap.get(selection.id) : undefined;
  const selectedLayoutRoad = selection?.kind === "road" ? layout?.roads.find((road) => road.id === selection.id) : undefined;
  const selectedRoad = selectedLayoutRoad ? connectionMap.get(selectedLayoutRoad.connectionId) : undefined;
  const selectedFolder = selection?.kind === "folder" ? folderMap.get(selection.id) : undefined;
  const projectIssueCount = useMemo(() => {
    if (!graph) {
      return 0;
    }
    return graph.diagnostics.length + graph.files.filter((file) => file.metrics.cycleCount > 0 || file.diagnostics.length > 0).length;
  }, [graph]);

  useEffect(() => {
    if (!graph || !layout) {
      return;
    }
    for (const warning of layout.layoutWarnings) {
      console.warn(`Codebase Town layout warning: ${warning}`);
    }
    if (graph.files.length !== layout.files.length) {
      console.warn(`Codebase Town rendered ${layout.files.length} file buildings for ${graph.files.length} visible graph files.`);
    }
  }, [graph, layout]);

  useEffect(() => {
    if (!layout) {
      return;
    }
    const renderedPairs = new Set<string>();
    for (const road of renderedRoads) {
      const pair = road.id;
      if (renderedPairs.has(pair)) {
        console.warn(`Codebase Town rendered duplicate road ${pair}.`);
      }
      renderedPairs.add(pair);
      if (!layout.folders.some((node) => node.id === road.sourceId) && !layout.files.some((node) => node.id === road.sourceId)) {
        console.warn(`Codebase Town road ${road.id} is missing source bounds.`);
      }
      if (!layout.folders.some((node) => node.id === road.targetId) && !layout.files.some((node) => node.id === road.targetId)) {
        console.warn(`Codebase Town road ${road.id} is missing target bounds.`);
      }
    }
    if (renderedRoads.some((road) => road.routeKind === "direct")) {
      console.warn("Codebase Town road policy violation: direct file-to-file roads may not be rendered.");
    }
    const debug = layout.roadDebug;
    if (
      debug.duplicateBundleCount > 0 ||
      debug.diagonalSegmentCount > 0 ||
      debug.trunksIntersectingFolderBounds > 0 ||
      debug.trunksIntersectingBuildingBounds > 0 ||
      debug.filesWithInvalidMultipleEntrances > 0 ||
      debug.filesWithZeroPorts > 0 ||
      debug.filesWithMultiplePorts > 0 ||
      debug.foldersWithExternalDependenciesWithoutGateway > 0 ||
      debug.foldersWithMultipleGateways > 0 ||
      debug.foldersWithGatewayWithoutStreetGraph > 0 ||
      debug.streetGraphsWithWrongGateway > 0 ||
      debug.streetGraphsMissingGatewaySpine > 0 ||
      debug.streetGraphsWithMultiplePrimarySpines > 0 ||
      debug.filesWithMissingStreetSpur > 0 ||
      debug.filesWithDuplicateStreetSpurs > 0 ||
      debug.streetSpursMissingPorts > 0 ||
      debug.streetEdgesWithDiagonalSegments > 0 ||
      debug.streetEdgesOutsideFolderBounds > 0 ||
      debug.streetEdgesIntersectingBuildings > 0 ||
      debug.streetEdgesIntersectingLabels > 0 ||
      debug.streetEdgesIntersectingNestedFolders > 0 ||
      debug.semanticDependencyCount !== debug.exactDependencyRouteCount ||
      debug.exactRoutesWithDuplicateIds > 0 ||
      debug.exactRoutesMissingBuildingPort > 0 ||
      debug.exactRoutesMissingInfrastructure > 0 ||
      debug.sameFolderRoutesUsingExternalTrunk > 0 ||
      debug.crossTopLevelRoutesWithoutOneTrunk > 0 ||
      debug.exactRoutesWithWrongEndpointPort > 0 ||
      debug.routesBypassingGateway > 0 ||
      debug.routesBypassingSpineOrCollector > 0 ||
      debug.buildingIntersectionCount > 0 ||
      debug.labelIntersectionCount > 0
    ) {
      console.warn("Codebase Town road debug counters are non-zero.", debug);
    }
  }, [layout, renderedRoads, showAllDependencies, selection, hoveredFileId]);

  function selectSearchResult(fileId: string): void {
    setSelection({ kind: "file", id: fileId });
  }

  function resetView(): void {
    setViewport({ scale: 1, x: 0, y: 0 });
    setSelection(undefined);
    mapPanelRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  }

  function fitLayoutToPanel(nextLayout: TownLayout): void {
    const panel = mapPanelRef.current;
    if (!panel) {
      return;
    }
    const widthScale = panel.clientWidth / nextLayout.width;
    const heightScale = panel.clientHeight / nextLayout.height;
    const scale = Math.max(0.45, Math.min(1, widthScale, heightScale));
    setViewport((current) => ({ ...current, scale }));
    window.requestAnimationFrame(() => panel.scrollTo({ left: 0, top: 0, behavior: "auto" }));
  }

  return (
    <main className="app-shell">
      <section className="map-panel" ref={mapPanelRef}>
        {layout ? (
          <svg
            className="town-map"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            width={layout.width * viewport.scale}
            height={layout.height * viewport.scale}
            role="img"
            aria-label="Codebase town dependency map"
          >
            <defs>
              {assetUrl(mapAssets.backgrounds.world) && (
                <pattern id="worldTexture" patternUnits="userSpaceOnUse" width="256" height="256">
                  <image href={assetUrl(mapAssets.backgrounds.world)} width="256" height="256" preserveAspectRatio="xMidYMid slice" />
                </pattern>
              )}
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="arrow-marker" />
              </marker>
            </defs>
            <rect
              className="world-background"
              x={0}
              y={0}
              width={layout.width}
              height={layout.height}
              fill={assetUrl(mapAssets.backgrounds.world) ? "url(#worldTexture)" : undefined}
            />
            {foldersByDepth.map((folder) => (
              <FolderDistrictShape
                key={folder.id}
                node={folder}
                folder={folderMap.get(folder.id)}
                isExpanded={true}
                isSelected={selection?.kind === "folder" && selection.id === folder.id}
                isSearchMatch={searchMatches.some((match) => match.fileId.startsWith(`${folder.id}/`))}
                onClick={() => setSelection({ kind: "folder", id: folder.id })}
              />
            ))}
            {hasCompleteLayout && <DecorLayer items={decorItems} />}
            {hasCompleteLayout && renderedRoads.map((road) => {
              const connection = connectionMap.get(road.connectionId);
              const state = roadState(road, selection, connectedIds);
              return (
                <RoadShape
                  key={road.id}
                  road={road}
                  connection={connection}
                  state={state}
                  title={roadTitle(connection, road, fileMap, folderMap)}
                  onClick={() => setSelection({ kind: "road", id: road.id })}
                />
              );
            })}
            {layout.files.map((fileNode) => {
              const file = fileMap.get(fileNode.id);
              const state = nodeState(fileNode.id, selection, connectedIds, searchMatches);
              return (
                <FileBuildingShape
                  key={fileNode.id}
                  node={fileNode}
                  file={file}
                  state={state}
                  onClick={() => setSelection({ kind: "file", id: fileNode.id })}
                  onMouseEnter={() => setHoveredFileId(fileNode.id)}
                  onMouseLeave={() => setHoveredFileId((current) => (current === fileNode.id ? undefined : current))}
                />
              );
            })}
            {foldersByDepth.map((folder) => (
              <FolderLabelShape
                key={`${folder.id}:label`}
                node={folder}
                folder={folderMap.get(folder.id)}
              />
            ))}
            {layout.files.map((fileNode) => (
              <FileLabelShape
                key={`${fileNode.id}:label`}
                node={fileNode}
                file={fileMap.get(fileNode.id)}
              />
            ))}
            {showStreetDebug && <LayoutDebugOverlay layout={layout} selection={selection} />}
            {layout.files.map((fileNode) => {
              const file = fileMap.get(fileNode.id);
              const state = nodeState(fileNode.id, selection, connectedIds, searchMatches);
              return (
                <FileOverlayShape
                  key={`${fileNode.id}:overlays`}
                  node={fileNode}
                  file={file}
                  state={state}
                  overlays={
                    file
                      ? fileOverlayStates({
                          file,
                          isSelected: selection?.kind === "file" && selection.id === file.id,
                          isFocusedSearchResult: false,
                          isRecentlyEdited: agentState?.recentlyEditedFileIds.includes(file.id) ?? false,
                          isNewlyCreated: newlyCreatedFileIds.has(file.id),
                          isReadActive: agentState?.activeReadFileId === file.id,
                          isEditActive: agentState?.activeEditFileId === file.id
                        })
                      : []
                  }
                />
              );
            })}
            {ENABLE_AGENT_ACTIVITY_DEMO && agentState && <AgentMarker agent={agentState} fileNode={layout.files.find((node) => node.id === agentState.fileId)} />}
          </svg>
        ) : (
          <div className="empty-state">{status}</div>
        )}
        {layout && layout.layoutWarnings.length > 0 && <LayoutWarningOverlay warnings={layout.layoutWarnings} />}
        {layout && showStreetDebug && <RoadDebugPanel debug={layout.roadDebug} />}
      </section>

      {layout && showMiniMap && <MiniMap layout={layout} selectedId={selection?.id} onClose={() => setShowMiniMap(false)} />}
      {layout && !showMiniMap && (
        <button type="button" className="hud-reopen mini-map-reopen" onClick={() => setShowMiniMap(true)}>
          Map
        </button>
      )}

      {showProjectHud ? (
        <aside className="sidebar hud-card project-card">
          <PanelDismissButton label="Hide project summary" onClose={() => setShowProjectHud(false)} />
          <ProjectSummary graph={graph} status={status} issueCount={projectIssueCount} />
        </aside>
      ) : (
        <button type="button" className="hud-reopen project-reopen" onClick={() => setShowProjectHud(true)}>
          Project
        </button>
      )}

      <div className="map-toolbar hud-card">
        <button type="button" title="Zoom in" onClick={() => setViewport((current) => ({ ...current, scale: Math.min(1.8, current.scale + 0.12) }))}>
          +
        </button>
        <button type="button" title="Zoom out" onClick={() => setViewport((current) => ({ ...current, scale: Math.max(0.45, current.scale - 0.12) }))}>
          -
        </button>
        <button type="button" title="Reset view" onClick={resetView}>
          R
        </button>
      </div>

      {showLegend ? (
        <Legend onClose={() => setShowLegend(false)} />
      ) : (
        <button type="button" className="hud-reopen legend-reopen" onClick={() => setShowLegend(true)}>
          Legend
        </button>
      )}

      <aside className={`details-panel hud-card ${selectedFile || selectedRoad || selectedFolder ? "visible" : ""}`}>
        <DetailsPanel
          file={selectedFile}
          folder={selectedFolder}
          road={selectedRoad}
          layoutRoad={selectedLayoutRoad}
          graph={graph}
          fileMap={fileMap}
          folderMap={folderMap}
          connectionMap={connectionMap}
          onOpenFile={(fileId) => vscodeApi().postMessage({ type: "openFile", fileId })}
          onCopyPath={(fileId) => vscodeApi().postMessage({ type: "copyPath", fileId })}
        />
      </aside>

      <BottomToolbar
        query={query}
        setQuery={setQuery}
        filters={filters}
        setFilters={setFilters}
        showExternal={showExternal}
        setShowExternal={setShowExternal}
        issueCount={projectIssueCount}
        showAllDependencies={showAllDependencies}
        setShowAllDependencies={setShowAllDependencies}
        showStreetDebug={showStreetDebug}
        setShowStreetDebug={setShowStreetDebug}
        zoom={viewport.scale}
        setViewport={setViewport}
        layoutDirection={layoutDirection}
        setLayoutDirection={setLayoutDirection}
        onRefresh={() => vscodeApi().postMessage({ type: "refreshRequested" })}
        searchMatches={searchMatches}
        fileMap={fileMap}
        onSelectSearchResult={selectSearchResult}
      />
    </main>
  );
}

function ProjectSummary(props: { graph: ProjectGraph | undefined; status: string; issueCount: number }): JSX.Element {
  const rootFolders = props.graph?.folders.filter((folder) => folder.parentFolderId === ".").length ?? 0;
  return (
    <div>
      <div className="project-title">
        <span className="folder-glyph">[]</span>
        <h1>{props.graph?.project.name ?? "Codebase Town"}</h1>
      </div>
      <dl className="project-stats">
        <div>
          <dt>Files</dt>
          <dd>{props.graph?.project.fileCount ?? 0}</dd>
        </div>
        <div>
          <dt>Folders</dt>
          <dd>{props.graph?.project.folderCount ?? rootFolders}</dd>
        </div>
        <div>
          <dt>Dependencies</dt>
          <dd>{props.graph?.project.connectionCount ?? 0}</dd>
        </div>
        <div>
          <dt>Issues</dt>
          <dd className={props.issueCount > 0 ? "issue-count" : ""}>{props.issueCount}</dd>
        </div>
      </dl>
      <p className="status">{props.status}</p>
    </div>
  );
}

function PanelDismissButton(props: { label: string; onClose(): void }): JSX.Element {
  return (
    <button type="button" className="panel-dismiss" title={props.label} aria-label={props.label} onClick={props.onClose}>
      x
    </button>
  );
}

function Legend(props: { onClose(): void }): JSX.Element {
  return (
    <aside className="legend-card hud-card">
      <PanelDismissButton label="Hide legend" onClose={props.onClose} />
      <h2>Legend</h2>
      <LegendItem image={assetUrl(mapAssets.folders.sign)} label="Folder district" />
      <LegendItem image={assetUrl(mapAssets.buildings.generic)} label="File (Building)" />
      <LegendItem className="legend-road" label="A -> B means A provides code imported by B." />
      <LegendItem className="legend-selected" label="Selected File" />
      <LegendItem className="legend-created" label="New File" />
      <LegendItem className="legend-cycle" label="Circular Dependency" />
      <LegendItem className="legend-error" label="Error" />
      <LegendItem image={assetUrl(mapAssets.agents.primary)} label="AI Agent" />
      <LegendItem image={assetUrl(mapAssets.overlays.readPulse)} label="Reading" />
      <LegendItem image={assetUrl(mapAssets.overlays.editPulse)} label="Editing" />
    </aside>
  );
}

function LegendItem(props: { image?: string; className?: string; label: string }): JSX.Element {
  return (
    <div className="legend-item">
      {props.image ? <img src={props.image} alt="" /> : <span className={`legend-swatch ${props.className ?? ""}`} />}
      <span>{props.label}</span>
    </div>
  );
}

function MiniMap(props: { layout: TownLayout; selectedId: string | undefined; onClose(): void }): JSX.Element {
  const scaleX = 180 / props.layout.width;
  const scaleY = 120 / props.layout.height;
  const scale = Math.min(scaleX, scaleY);

  return (
    <aside className="mini-map hud-card" aria-label="Map overview">
      <PanelDismissButton label="Hide map overview" onClose={props.onClose} />
      <svg viewBox={`0 0 ${props.layout.width * scale} ${props.layout.height * scale}`}>
        {props.layout.folders.map((folder) => (
          <rect
            key={folder.id}
            x={folder.x * scale}
            y={folder.y * scale}
            width={folder.width * scale}
            height={folder.height * scale}
            className={props.selectedId === folder.id ? "selected-mini" : ""}
          />
        ))}
        {props.layout.files.map((file) => (
          <rect
            key={file.id}
            x={file.x * scale}
            y={file.y * scale}
            width={Math.max(2, file.width * scale)}
            height={Math.max(2, file.height * scale)}
            className={props.selectedId === file.id ? "selected-mini" : "file-mini"}
          />
        ))}
      </svg>
    </aside>
  );
}

function BottomToolbar(props: {
  query: string;
  setQuery(value: string): void;
  filters: Filters;
  setFilters(value: Filters | ((current: Filters) => Filters)): void;
  showExternal: boolean;
  setShowExternal(value: boolean): void;
  issueCount: number;
  showAllDependencies: boolean;
  setShowAllDependencies(value: boolean): void;
  showStreetDebug: boolean;
  setShowStreetDebug(value: boolean): void;
  zoom: number;
  setViewport(value: { scale: number; x: number; y: number } | ((current: { scale: number; x: number; y: number }) => { scale: number; x: number; y: number })): void;
  layoutDirection: LayoutDirection;
  setLayoutDirection(value: LayoutDirection): void;
  onRefresh(): void;
  searchMatches: { fileId: string; reason: string }[];
  fileMap: Map<string, FileNode>;
  onSelectSearchResult(fileId: string): void;
}): JSX.Element {
  return (
    <footer className="bottom-toolbar">
      <div className="bottom-search">
        <input value={props.query} onChange={(event) => props.setQuery(event.target.value)} placeholder="Search files..." />
        <span>?</span>
        {props.query.trim() && (
          <div className="results search-popover">
            {props.searchMatches.slice(0, 8).map((match) => (
              <button key={`${match.fileId}:${match.reason}`} type="button" onClick={() => props.onSelectSearchResult(match.fileId)}>
                <strong>{props.fileMap.get(match.fileId)?.name}</strong>
                <span>{match.reason}</span>
              </button>
            ))}
            {props.searchMatches.length === 0 && <p>No matches</p>}
          </div>
        )}
      </div>
      <button type="button" className="toolbar-pill active" onClick={() => props.setFilters(defaultFilters)}>
        All Files
      </button>
      <button type="button" className="toolbar-pill" onClick={props.onRefresh}>
        Refresh
      </button>
      <button type="button" className={`toolbar-pill ${props.issueCount > 0 ? "has-issues" : ""}`} onClick={() => props.setFilters((current) => ({ ...current, circular: true }))}>
        Issues <span>{props.issueCount}</span>
      </button>
      <button type="button" className="toolbar-pill" onClick={() => props.setShowExternal(!props.showExternal)}>
        Dependencies
      </button>
      <FilterToggle label="Type" value={props.filters.typeOnly} onChange={(typeOnly) => props.setFilters((current) => ({ ...current, typeOnly }))} />
      <FilterToggle label="Show all trunks" value={props.showAllDependencies} onChange={props.setShowAllDependencies} />
      <FilterToggle label="Street debug" value={props.showStreetDebug} onChange={props.setShowStreetDebug} />
      <div className="direction-control" role="group" aria-label="Layout direction">
        <button type="button" className={props.layoutDirection === "RIGHT" ? "active" : ""} title="Left-to-right layout" onClick={() => props.setLayoutDirection("RIGHT")}>
          L-R
        </button>
        <button type="button" className={props.layoutDirection === "DOWN" ? "active" : ""} title="Top-to-bottom layout" onClick={() => props.setLayoutDirection("DOWN")}>
          T-B
        </button>
      </div>
      <div className="zoom-control">
        <span>{Math.round(props.zoom * 100)}%</span>
        <button type="button" onClick={() => props.setViewport((current) => ({ ...current, scale: Math.max(0.45, current.scale - 0.12) }))}>
          -
        </button>
        <input
          type="range"
          min="45"
          max="180"
          value={Math.round(props.zoom * 100)}
          onChange={(event) => props.setViewport((current) => ({ ...current, scale: Number(event.target.value) / 100 }))}
        />
        <button type="button" onClick={() => props.setViewport((current) => ({ ...current, scale: Math.min(1.8, current.scale + 0.12) }))}>
          +
        </button>
      </div>
    </footer>
  );
}

function FilterToggle(props: { label: string; value: boolean; onChange(value: boolean): void }): JSX.Element {
  return (
    <label className="filter-toggle">
      <input type="checkbox" checked={props.value} onChange={(event) => props.onChange(event.target.checked)} />
      <span>{props.label}</span>
    </label>
  );
}

function FolderDistrictShape(props: {
  node: LayoutNode;
  folder: FolderNode | undefined;
  isExpanded: boolean;
  isSelected: boolean;
  isSearchMatch: boolean;
  onClick(): void;
}): JSX.Element {
  const districtAsset = props.folder && props.folder.depth > 1 ? mapAssets.backgrounds.subfolder : mapAssets.backgrounds.folder;
  const districtUrl = assetUrl(districtAsset);

  return (
    <g className={`folder-node ${props.isExpanded ? "expanded" : "collapsed"} ${props.isSelected ? "selected" : ""} ${props.isSearchMatch ? "search-match" : ""}`} onClick={props.onClick}>
      <rect x={props.node.x} y={props.node.y} width={props.node.width} height={props.node.height} rx="8" />
      <OptionalSvgImage href={districtUrl} x={props.node.x} y={props.node.y} width={props.node.width} height={props.node.height} className="folder-district-image" preserveAspectRatio="xMidYMid slice" />
      <FolderBorderShape node={props.node} />
    </g>
  );
}

const FOLDER_BORDER = {
  cornerSize: 58,
  railThickness: 18,
  supportWidth: 46,
  supportHeight: 18,
  supportTargetSpacing: 220
} as const;

const FOLDER_BORDER_CROPS = {
  corner: { x: 440, y: 171, width: 658, height: 587 },
  side: { x: 120, y: 460, width: 1296, height: 83 },
  support: { x: 485, y: 371, width: 567, height: 202 }
} as const;

function FolderBorderShape(props: { node: LayoutNode }): JSX.Element {
  const cornerUrl = assetUrl(mapAssets.folders.corner);
  const sideUrl = assetUrl(mapAssets.folders.side);
  const supportUrl = assetUrl(mapAssets.folders.support);
  const corner = FOLDER_BORDER.cornerSize;
  const rail = FOLDER_BORDER.railThickness;
  const supportW = FOLDER_BORDER.supportWidth;
  const supportH = FOLDER_BORDER.supportHeight;
  const x = props.node.x;
  const y = props.node.y;
  const width = props.node.width;
  const height = props.node.height;
  const horizontalRailLength = Math.max(0, width - corner * 2);
  const verticalRailLength = Math.max(0, height - corner * 2);
  const topY = y - rail / 2;
  const bottomY = y + height - rail / 2;
  const leftX = x - rail / 2;
  const rightX = x + width - rail / 2;
  const topSupportCenters = folderBorderSupportCenters(x + corner, x + width - corner, supportW);
  const verticalSupportCenters = folderBorderSupportCenters(y + corner, y + height - corner, supportW);

  return (
    <g className="folder-border" pointerEvents="none">
      {sideUrl && (
        <>
          <FolderBorderPiece href={sideUrl} crop={FOLDER_BORDER_CROPS.side} x={x + corner} y={topY} width={horizontalRailLength} height={rail} className="folder-side-image" preserveAspectRatio="none" />
          <FolderBorderPiece href={sideUrl} crop={FOLDER_BORDER_CROPS.side} x={x + corner} y={bottomY} width={horizontalRailLength} height={rail} rotation={180} className="folder-side-image" preserveAspectRatio="none" />
          <FolderBorderPiece href={sideUrl} crop={FOLDER_BORDER_CROPS.side} x={leftX} y={y + corner} width={rail} height={verticalRailLength} rotation={270} className="folder-side-image" preserveAspectRatio="none" />
          <FolderBorderPiece href={sideUrl} crop={FOLDER_BORDER_CROPS.side} x={rightX} y={y + corner} width={rail} height={verticalRailLength} rotation={90} className="folder-side-image" preserveAspectRatio="none" />
        </>
      )}
      {supportUrl && (
        <>
          {topSupportCenters.map((centerX) => (
            <FolderBorderPiece key={`top-support:${centerX}`} href={supportUrl} crop={FOLDER_BORDER_CROPS.support} x={centerX - supportW / 2} y={topY} width={supportW} height={supportH} className="folder-support-image" />
          ))}
          {topSupportCenters.map((centerX) => (
            <FolderBorderPiece key={`bottom-support:${centerX}`} href={supportUrl} crop={FOLDER_BORDER_CROPS.support} x={centerX - supportW / 2} y={bottomY} width={supportW} height={supportH} rotation={180} className="folder-support-image" />
          ))}
          {verticalSupportCenters.map((centerY) => (
            <FolderBorderPiece key={`left-support:${centerY}`} href={supportUrl} crop={FOLDER_BORDER_CROPS.support} x={leftX} y={centerY - supportW / 2} width={supportH} height={supportW} rotation={270} className="folder-support-image" />
          ))}
          {verticalSupportCenters.map((centerY) => (
            <FolderBorderPiece key={`right-support:${centerY}`} href={supportUrl} crop={FOLDER_BORDER_CROPS.support} x={rightX} y={centerY - supportW / 2} width={supportH} height={supportW} rotation={90} className="folder-support-image" />
          ))}
        </>
      )}
      {cornerUrl && (
        <>
          <FolderBorderPiece href={cornerUrl} crop={FOLDER_BORDER_CROPS.corner} x={x - rail / 2} y={y - rail / 2} width={corner} height={corner} className="folder-corner-image" />
          <FolderBorderPiece href={cornerUrl} crop={FOLDER_BORDER_CROPS.corner} x={x + width - corner + rail / 2} y={y - rail / 2} width={corner} height={corner} rotation={90} className="folder-corner-image" />
          <FolderBorderPiece href={cornerUrl} crop={FOLDER_BORDER_CROPS.corner} x={x + width - corner + rail / 2} y={y + height - corner + rail / 2} width={corner} height={corner} rotation={180} className="folder-corner-image" />
          <FolderBorderPiece href={cornerUrl} crop={FOLDER_BORDER_CROPS.corner} x={x - rail / 2} y={y + height - corner + rail / 2} width={corner} height={corner} rotation={270} className="folder-corner-image" />
        </>
      )}
    </g>
  );
}

function FolderBorderPiece(props: {
  href: string;
  crop: { x: number; y: number; width: number; height: number };
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  className: string;
  preserveAspectRatio?: string;
}): JSX.Element | null {
  if (props.width <= 0 || props.height <= 0) {
    return null;
  }

  const centerX = props.x + props.width / 2;
  const centerY = props.y + props.height / 2;
  const isQuarterTurn = props.rotation === 90 || props.rotation === 270;
  const renderWidth = isQuarterTurn ? props.height : props.width;
  const renderHeight = isQuarterTurn ? props.width : props.height;
  const renderX = centerX - renderWidth / 2;
  const renderY = centerY - renderHeight / 2;
  return (
    <svg
      x={renderX}
      y={renderY}
      width={renderWidth}
      height={renderHeight}
      viewBox={`${props.crop.x} ${props.crop.y} ${props.crop.width} ${props.crop.height}`}
      preserveAspectRatio={props.preserveAspectRatio ?? "xMidYMid meet"}
      className={props.className}
      transform={props.rotation ? `rotate(${props.rotation} ${centerX} ${centerY})` : undefined}
    >
      <image href={props.href} x={0} y={0} width={1536} height={1024} preserveAspectRatio="none" />
    </svg>
  );
}

function folderBorderSupportCenters(start: number, end: number, supportLength: number): number[] {
  const length = Math.max(0, end - start);
  const count = Math.max(0, Math.floor(length / FOLDER_BORDER.supportTargetSpacing));
  if (count === 0 || length < supportLength * 2) {
    return [];
  }
  return Array.from({ length: count }, (_, index) => Math.round(start + (length * (index + 1)) / (count + 1)));
}

function FolderLabelShape(props: {
  node: LayoutNode;
  folder: FolderNode | undefined;
}): JSX.Element {
  const signUrl = assetUrl(mapAssets.folders.sign);
  const signX = props.node.x + props.node.width / 2 - MAP_SIZES.folderSignWidth / 2;
  const signY = props.node.y + 8;

  return (
    <g className="folder-label">
      <OptionalSvgImage href={signUrl} x={signX} y={signY} width={MAP_SIZES.folderSignWidth} height={MAP_SIZES.folderSignHeight} className="folder-sign-image" preserveAspectRatio="xMidYMid meet" />
      <text x={props.node.x + props.node.width / 2} y={props.node.y + 28} className="folder-title">
        {props.node.label}
      </text>
      <text x={props.node.x + props.node.width / 2} y={props.node.y + 52} className="folder-metrics">
        {props.folder?.metrics.descendantFileCount ?? 0} files
      </text>
      {(props.folder?.metrics.cycleCount ?? 0) > 0 && (
        <text x={props.node.x + props.node.width - 28} y={props.node.y + 25} className="warning-badge">
          !
        </text>
      )}
    </g>
  );
}

function RoadShape(props: {
  road: TownLayout["roads"][number];
  connection: ImportConnection | undefined;
  state: string;
  title: string;
  onClick(): void;
}): JSX.Element {
  const dependencyTypeClass = props.road.dependencyTypes.length === 1 ? props.road.dependencyTypes[0] : "mixed-types";
  const roadClass = `${props.road.routeKind} ${props.road.infrastructureKind} ${props.road.endpointRole ?? ""} ${dependencyTypeClass} ${props.road.hasCircularDependency || props.connection?.isCircular ? "circular" : ""} ${props.road.isAggregated ? "aggregated" : ""} ${props.road.direction} ${props.state}`;
  const path = roadPathData(props.road);
  const labelPoint = props.road.showCountLabel ? roadLabelPoint(props.road.points) : undefined;
  const countText = `${props.road.dependencyCount} ${props.road.dependencyCount === 1 ? "dependency" : "dependencies"}`;
  const badgeWidth = Math.max(78, countText.length * 6.4 + 16);
  const showArrow = props.road.routeKind === "trunk" && props.road.direction === "provider-to-consumer";
  return (
    <g className={`road-group ${roadClass}`} onClick={props.onClick}>
      <path d={path} className="road road-base" />
      <path d={path} className="road road-lane" markerEnd={showArrow ? "url(#arrow)" : undefined} />
      {labelPoint && (
        <g className="road-count" transform={`translate(${labelPoint.x}, ${labelPoint.y - 14})`}>
          <rect x={-badgeWidth / 2} y={-11} width={badgeWidth} height={18} rx={7} />
          <text y={2}>{countText}</text>
        </g>
      )}
      <path d={path} className="road road-hit">
        <title>{props.title}</title>
      </path>
    </g>
  );
}

function roadLabelPoint(points: Point[]): Point | undefined {
  let best: { point: Point; length: number } | undefined;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) {
      continue;
    }
    const length = Math.abs(current.x - previous.x) + Math.abs(current.y - previous.y);
    if (!best || length > best.length) {
      best = {
        point: { x: Math.round((previous.x + current.x) / 2), y: Math.round((previous.y + current.y) / 2) },
        length
      };
    }
  }
  return best?.point;
}

function LayoutWarningOverlay(props: { warnings: string[] }): JSX.Element {
  return (
    <div className="layout-warning" role="status">
      <strong>Layout fallback active</strong>
      <span>{props.warnings.slice(0, 2).join(" ")}</span>
    </div>
  );
}

function RoadDebugPanel(props: { debug: TownLayout["roadDebug"] }): JSX.Element {
  const items: [string, number][] = [
    ["Semantic file dependencies", props.debug.semanticFileDependencyCount],
    ["Visible files", props.debug.visibleFileCount],
    ["File ports", props.debug.filePortCount],
    ["Invalid entrances", props.debug.filesWithInvalidMultipleEntrances],
    ["Files without ports", props.debug.filesWithZeroPorts],
    ["Files with multiple ports", props.debug.filesWithMultiplePorts],
    ["External folders", props.debug.externallyConnectedFolderCount],
    ["Folders needing streets", props.debug.expandedFoldersNeedingStreetCount],
    ["Participating files", props.debug.participatingFileCount],
    ["Folders without gateways", props.debug.foldersWithExternalDependenciesWithoutGateway],
    ["Folders with multiple gateways", props.debug.foldersWithMultipleGateways],
    ["Internal street graphs", props.debug.internalStreetGraphCount],
    ["Gateways without street graphs", props.debug.foldersWithGatewayWithoutStreetGraph],
    ["Street graphs wrong gateway", props.debug.streetGraphsWithWrongGateway],
    ["Street graphs without spine", props.debug.streetGraphsMissingGatewaySpine],
    ["Street graphs multiple spines", props.debug.streetGraphsWithMultiplePrimarySpines],
    ["Missing street spurs", props.debug.filesWithMissingStreetSpur],
    ["Duplicate street spurs", props.debug.filesWithDuplicateStreetSpurs],
    ["Street spurs missing ports", props.debug.streetSpursMissingPorts],
    ["Street diagonal segments", props.debug.streetEdgesWithDiagonalSegments],
    ["Street edges outside folders", props.debug.streetEdgesOutsideFolderBounds],
    ["Street/building intersections", props.debug.streetEdgesIntersectingBuildings],
    ["Street/label intersections", props.debug.streetEdgesIntersectingLabels],
    ["Street/nested folder intersections", props.debug.streetEdgesIntersectingNestedFolders],
    ["Street junctions", props.debug.streetJunctionCount],
    ["Child folders needing connectors", props.debug.childFoldersNeedingParentConnector],
    ["Parent-child connectors", props.debug.parentChildConnectorCount],
    ["Missing parent-child connectors", props.debug.childFoldersMissingParentConnector],
    ["Duplicate parent-child connectors", props.debug.childFoldersWithDuplicateParentConnectors],
    ["Connector wrong gateway", props.debug.parentChildConnectorsWrongGateway],
    ["Connector missing junction", props.debug.parentChildConnectorsMissingParentJunction],
    ["Connector bypassed child gateway", props.debug.parentChildConnectorsBypassingChildGateway],
    ["Connector bypassed parent graph", props.debug.parentChildConnectorsBypassingParentStreetGraph],
    ["Connector diagonal segments", props.debug.parentChildConnectorsWithDiagonalSegments],
    ["Connector outside parent", props.debug.parentChildConnectorsOutsideParent],
    ["Connector/building intersections", props.debug.parentChildConnectorsIntersectingBuildings],
    ["Connector/label intersections", props.debug.parentChildConnectorsIntersectingLabels],
    ["Connector/sibling intersections", props.debug.parentChildConnectorsIntersectingSiblingFolders],
    ["Connector crossing child", props.debug.parentChildConnectorsCrossingChildBoundary],
    ["Expected folder trunks", props.debug.expectedFolderTrunkCount],
    ["Folder trunks", props.debug.folderTrunkCount],
    ["External corridor edges", props.debug.externalCorridorEdgeCount],
    ["External junctions", props.debug.externalJunctionCount],
    ["Duplicate folder trunks", props.debug.duplicateFolderTrunks],
    ["Trunk wrong gateway", props.debug.folderTrunksWrongGateway],
    ["Trunk attached nested", props.debug.folderTrunksAttachedToNestedFolder],
    ["Trunk diagonal segments", props.debug.folderTrunksWithDiagonalSegments],
    ["Trunk/folder intersections", props.debug.folderTrunksIntersectingFolders],
    ["Trunk/building intersections", props.debug.folderTrunksIntersectingBuildings],
    ["Trunk/label intersections", props.debug.folderTrunksIntersectingLabels],
    ["Duplicate corridor geometry", props.debug.duplicateExternalCorridorGeometry],
    ["External junction errors", props.debug.externalJunctionsMissingCorridorEdge],
    ["Semantic dependencies", props.debug.semanticDependencyCount],
    ["Exact dependency routes", props.debug.exactDependencyRouteCount],
    ["Duplicate exact routes", props.debug.exactRoutesWithDuplicateIds],
    ["Exact routes missing ports", props.debug.exactRoutesMissingBuildingPort],
    ["Exact routes missing infrastructure", props.debug.exactRoutesMissingInfrastructure],
    ["Same-folder routes using trunks", props.debug.sameFolderRoutesUsingExternalTrunk],
    ["Cross-top routes missing trunk", props.debug.crossTopLevelRoutesWithoutOneTrunk],
    ["Exact routes wrong endpoint", props.debug.exactRoutesWithWrongEndpointPort],
    ["Generated folder bundles", props.debug.generatedFolderBundleCount],
    ["Rendered trunks", props.debug.renderedTrunkCount],
    ["Rejected trunks", props.debug.rejectedTrunkCount],
    ["Duplicate bundles", props.debug.duplicateBundleCount],
    ["Diagonal segments", props.debug.diagonalSegmentCount],
    ["Trunks crossing folders", props.debug.trunksIntersectingFolderBounds],
    ["Trunks crossing buildings", props.debug.trunksIntersectingBuildingBounds],
    ["Bypassing gateway", props.debug.routesBypassingGateway],
    ["Bypassing street levels", props.debug.routesBypassingSpineOrCollector],
    ["Building intersections", props.debug.buildingIntersectionCount],
    ["Label intersections", props.debug.labelIntersectionCount]
  ];
  return (
    <aside className="road-debug-panel hud-card">
      <h2>Road Debug</h2>
      <dl>
        {items.map(([label, value]) => (
          <div key={label} className={value > 0 && /Invalid|Duplicate|Diagonal|crossing|Bypassing|intersections/.test(label) ? "bad" : ""}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function LayoutDebugOverlay(props: { layout: TownLayout; selection: Selection | undefined }): JSX.Element {
  const gateways = props.layout.folderGateways;
  const selectedFolderId = props.selection?.kind === "folder" ? props.selection.id : undefined;
  const selectedRoadId = props.selection?.kind === "road" ? props.selection.id : undefined;
  return (
    <g className="layout-debug-layer" pointerEvents="none">
      {[...props.layout.folders, ...props.layout.files].map((node) => {
        const debug = node.layoutDebug;
        const label = debug
          ? `${node.id} parent=${debug.parentId ?? "root"} local=(${debug.localX},${debug.localY}) world=(${debug.worldX},${debug.worldY}) size=${debug.width}x${debug.height}`
          : `${node.id} size=${node.width}x${node.height}`;
        return (
          <g key={`${node.id}:layout-debug`} className={`layout-debug-node ${node.kind}`}>
            <rect x={node.x} y={node.y} width={node.width} height={node.height} />
            <text x={node.x + 6} y={node.y + 14}>
              {label}
            </text>
          </g>
        );
      })}
      {props.layout.roads.map((road) => (
        <g key={`${road.id}:route-debug`} className={`layout-debug-route ${road.routeKind}`}>
          {road.points.map((point, index) => (
            <g key={`${road.id}:route-debug:${index}`}>
              <circle cx={point.x} cy={point.y} r={3} />
              <text x={point.x + 5} y={point.y - 5}>
                {road.routeKind}:{road.level}
              </text>
            </g>
          ))}
        </g>
      ))}
      {[...props.layout.routingPlan.internalStreetGraphs.values()].flatMap((streetGraph) => streetGraph.edges).map((edge) => (
        <g key={`${edge.id}:street-debug`} className={`layout-debug-street ${edge.kind}`}>
          <line x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} />
          <circle cx={edge.from.x} cy={edge.from.y} r={3} />
          <circle cx={edge.to.x} cy={edge.to.y} r={3} />
          <text x={(edge.from.x + edge.to.x) / 2 + 5} y={(edge.from.y + edge.to.y) / 2 - 5}>
            {edge.kind}
          </text>
        </g>
      ))}
      {[...props.layout.routingPlan.parentChildConnectors.values()].flatMap((connector) => connector.edges).map((edge) => (
        <g key={`${edge.id}:connector-debug`} className="layout-debug-connector">
          <line x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} />
          <circle cx={edge.from.x} cy={edge.from.y} r={3} />
          <circle cx={edge.to.x} cy={edge.to.y} r={3} />
          <text x={(edge.from.x + edge.to.x) / 2 + 5} y={(edge.from.y + edge.to.y) / 2 - 5}>
            parent-child
          </text>
        </g>
      ))}
      {[...props.layout.routingPlan.externalCorridorEdges.values()].map((edge) => (
        <g key={`${edge.id}:external-corridor-debug`} className="layout-debug-external-corridor">
          <line x1={edge.from.x} y1={edge.from.y} x2={edge.to.x} y2={edge.to.y} />
        </g>
      ))}
      {[...props.layout.routingPlan.folderTrunks.values()].map((trunk) => {
        const path = trunk.points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
        const active = selectedRoadId === trunk.id || selectedFolderId === trunk.providerFolderId || selectedFolderId === trunk.consumerFolderId;
        const labelPoint = trunk.points[Math.floor(trunk.points.length / 2)] ?? trunk.points[0];
        return (
          <g key={`${trunk.id}:folder-trunk-debug`} className={`layout-debug-folder-trunk ${active ? "active" : ""}`}>
            <path d={path} />
            {labelPoint && (
              <text x={labelPoint.x + 8} y={labelPoint.y - 8}>
                {trunk.providerFolderId} to {trunk.consumerFolderId} ({trunk.dependencyCount})
              </text>
            )}
          </g>
        );
      })}
      {[...props.layout.routingPlan.externalJunctions.values()].map((junction) => (
        <g key={`${junction.id}:external-junction-debug`} className="layout-debug-external-junction">
          <circle cx={junction.x} cy={junction.y} r={4} />
        </g>
      ))}
      {[...props.layout.routingPlan.streetJunctions.values()].map((junction) => (
        <g key={`${junction.id}:junction-debug`} className="layout-debug-junction">
          <circle cx={junction.x} cy={junction.y} r={5} />
          <text x={junction.x + 7} y={junction.y - 7}>
            junction
          </text>
        </g>
      ))}
      {gateways.map((gateway) => (
        <g key={`${gateway.folderId}:${gateway.side}:gateway-debug`} className="layout-debug-gateway">
          <circle cx={gateway.x} cy={gateway.y} r={7} />
          <text x={gateway.x + 8} y={gateway.y - 8}>
            gateway:{gateway.side}
          </text>
        </g>
      ))}
      {props.layout.buildingPorts.map((port) => (
        <g key={`${port.fileId}:port-debug`} className="layout-debug-port">
          <circle cx={port.x} cy={port.y} r={5} />
          <text x={port.x + 6} y={port.y + 12}>
            port:{port.side}
          </text>
        </g>
      ))}
    </g>
  );
}

function positionsFromLayout(layout: TownLayout): Map<string, Point> {
  return new Map([...layout.folders, ...layout.files].map((node) => [node.id, node.position]));
}

function hasValidBounds(node: LayoutNode): boolean {
  return Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.width) && Number.isFinite(node.height) && node.width > 0 && node.height > 0;
}

function DecorLayer(props: { items: DecorScatterItem[] }): JSX.Element {
  return (
    <g className="decor-layer" pointerEvents="none">
      {props.items.map((item) => (
        <DecorItemShape key={item.id} item={item} />
      ))}
    </g>
  );
}

function DecorItemShape(props: { item: DecorScatterItem }): JSX.Element | null {
  const decorUrl = assetUrl(mapAssets.decor[props.item.kind]);
  const shadowUrl = assetUrl(mapAssets.decor.groundShadowBlob);
  const centerX = props.item.x + props.item.width / 2;
  const centerY = props.item.y + props.item.height / 2;
  const transform = props.item.rotation ? `rotate(${props.item.rotation} ${centerX} ${centerY})` : undefined;

  if (!decorUrl) {
    return null;
  }

  return (
    <g className={`decor-item ${props.item.tier}`}>
      {props.item.hasShadow && shadowUrl && (
        <image
          href={shadowUrl}
          x={props.item.x + props.item.width * 0.08}
          y={props.item.y + props.item.height * 0.72}
          width={props.item.width * 0.84}
          height={Math.max(12, props.item.height * 0.22)}
          className="decor-shadow-image"
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      <image
        href={decorUrl}
        x={props.item.x}
        y={props.item.y}
        width={props.item.width}
        height={props.item.height}
        className={`decor-image ${props.item.kind}`}
        preserveAspectRatio="xMidYMid meet"
        transform={transform}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </g>
  );
}

function isLayoutDebugModeEnabled(): boolean {
  const meta = import.meta as ImportMeta & { env?: { DEV?: boolean } };
  return Boolean(meta.env?.DEV) && typeof window !== "undefined" && new URLSearchParams(window.location.search).has("layoutDebug");
}

function FileBuildingShape(props: {
  node: LayoutNode;
  file: FileNode | undefined;
  state: string;
  onClick(): void;
  onMouseEnter(): void;
  onMouseLeave(): void;
}): JSX.Element {
  const buildingUrl = assetUrl(buildingAssetForFileKind(props.file?.kind));
  const buildingBounds = getVisibleBuildingBounds(props.node);
  const imageX = props.node.x + Math.round((props.node.width - MAP_SIZES.buildingWidth) / 2);
  const imageY = props.node.y + 4;
  const roofY = props.node.y + VISIBLE_BUILDING_GEOMETRY.y;

  return (
    <g
      className={`file-node ${props.file?.kind ?? "other"} ${props.state}`}
      onClick={props.onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      onDoubleClick={() => vscodeApi().postMessage({ type: "openFile", fileId: props.node.id })}
      role="button"
      aria-label={props.file ? `${props.file.name}, ${props.file.kind} file, ${props.file.metrics.importCount} imports, ${props.file.metrics.exportCount} exports` : props.node.label}
      tabIndex={0}
    >
      <rect x={buildingBounds.x} y={buildingBounds.y} width={buildingBounds.width} height={buildingBounds.height} rx="10" />
      <path d={`M${props.node.x + VISIBLE_BUILDING_GEOMETRY.roofInsetX},${roofY} L${props.node.x + props.node.width / 2},${props.node.y + VISIBLE_BUILDING_GEOMETRY.roofPeakY} L${props.node.x + props.node.width - VISIBLE_BUILDING_GEOMETRY.roofInsetX},${roofY}`} />
      <OptionalSvgImage href={buildingUrl} x={imageX} y={imageY} width={MAP_SIZES.buildingWidth} height={MAP_SIZES.buildingHeight} className="building-image" preserveAspectRatio="xMidYMid meet" />
    </g>
  );
}

function FileLabelShape(props: { node: LayoutNode; file: FileNode | undefined }): JSX.Element {
  return (
    <g className="file-label" pointerEvents="none">
      <text x={props.node.x + props.node.width / 2} y={props.node.y + 96} className="file-title">
        {props.node.label}
      </text>
      <text x={props.node.x + props.node.width / 2} y={props.node.y + 110} className="file-metrics">
        {props.file?.metrics.importCount ?? 0} in use | {props.file?.metrics.exportCount ?? 0} exp
      </text>
    </g>
  );
}

function FileOverlayShape(props: { node: LayoutNode; file: FileNode | undefined; state: string; overlays: OverlayAssetKind[] }): JSX.Element {
  const overlayX = props.node.x + Math.round((props.node.width - MAP_SIZES.overlayWidth) / 2);
  const overlayY = props.node.y - 2;

  return (
    <g className={`file-node-overlays ${props.file?.kind ?? "other"} ${props.state}`} pointerEvents="none">
      {props.overlays.map((overlay) => (
        <OptionalSvgImage
          key={overlay}
          href={assetUrl(mapAssets.overlays[overlay])}
          x={overlayX}
          y={overlayY}
          width={MAP_SIZES.overlayWidth}
          height={MAP_SIZES.overlayHeight}
          className={`building-overlay ${overlay}`}
          preserveAspectRatio="xMidYMid meet"
        />
      ))}
      {(props.file?.metrics.cycleCount ?? 0) > 0 && (
        <text x={props.node.x + props.node.width - 18} y={props.node.y + 29} className="warning-badge">
          !
        </text>
      )}
    </g>
  );
}

function AgentMarker(props: { agent: AgentActivityState; fileNode: LayoutNode | undefined }): JSX.Element | null {
  if (!props.fileNode || !assetUrl(mapAssets.agents.primary)) {
    return null;
  }

  const x = props.fileNode.x + props.fileNode.width - MAP_SIZES.agentWidth;
  const y = props.fileNode.y - 8;
  return (
    <g className="agent-marker">
      <OptionalSvgImage href={assetUrl(mapAssets.agents.primary)} x={x} y={y} width={MAP_SIZES.agentWidth} height={MAP_SIZES.agentHeight} className="agent-image" preserveAspectRatio="xMidYMid meet" />
      <text x={x + MAP_SIZES.agentWidth + 4} y={y + 18}>
        {props.agent.agentName}
      </text>
    </g>
  );
}

function OptionalSvgImage(props: {
  href: string | undefined;
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  preserveAspectRatio: string;
}): JSX.Element | null {
  if (!props.href) {
    return null;
  }

  return (
    <image
      href={props.href}
      x={props.x}
      y={props.y}
      width={props.width}
      height={props.height}
      className={props.className}
      preserveAspectRatio={props.preserveAspectRatio}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

function DetailsPanel(props: {
  file: FileNode | undefined;
  folder: FolderNode | undefined;
  road: ImportConnection | undefined;
  layoutRoad: TownLayout["roads"][number] | undefined;
  graph: ProjectGraph | undefined;
  fileMap: Map<string, FileNode>;
  folderMap: Map<string, FolderNode>;
  connectionMap: Map<string, ImportConnection>;
  onOpenFile(fileId: string): void;
  onCopyPath(fileId: string): void;
}): JSX.Element {
  if (props.file && props.graph) {
    const imports = props.file.importConnectionIds.map((id) => props.connectionMap.get(id)).filter((connection): connection is ImportConnection => Boolean(connection));
    const dependents = props.file.dependentConnectionIds.map((id) => props.connectionMap.get(id)).filter((connection): connection is ImportConnection => Boolean(connection));
    return (
      <div className="details">
        <h2>{props.file.name}</h2>
        <p>{props.file.path}</p>
        <div className="actions">
          <button type="button" onClick={() => props.onOpenFile(props.file!.id)}>
            Open file
          </button>
          <button type="button" onClick={() => props.onCopyPath(props.file!.id)}>
            Copy path
          </button>
        </div>
        <MetricGrid file={props.file} />
        <DetailList title="Imports" items={imports.map((connection) => `${providerLabel(connection, props.fileMap)} (${connection.type}) ${symbolLabel(connection)}`)} />
        <DetailList title="Exports" items={props.file.exports.map((symbol) => `${symbol.name} (${symbol.kind}${symbol.isDefault ? ", default" : ""})`)} />
        <DetailList title="Used By" items={dependents.map((connection) => `${props.fileMap.get(connection.sourceFileId)?.path ?? connection.sourceFileId} ${symbolLabel(connection)}`)} />
        <DetailList title="Diagnostics" items={props.file.diagnostics} />
      </div>
    );
  }

  if (props.layoutRoad) {
    const provider = entityLabel(props.layoutRoad.providerFolderId ?? props.layoutRoad.sourceId, props.fileMap, props.folderMap);
    const consumer = entityLabel(props.layoutRoad.consumerFolderId ?? props.layoutRoad.targetId, props.fileMap, props.folderMap);
    const representedDependencies = props.layoutRoad.dependencyCount;
    const dependencyItems = props.layoutRoad.connectionIds
      .map((id) => props.connectionMap.get(id))
      .filter((connection): connection is ImportConnection => Boolean(connection))
      .map((connection) => `${providerLabel(connection, props.fileMap)} -> ${consumerLabel(connection, props.fileMap)} (${connection.type}) ${symbolLabel(connection)}`);
    return (
      <div className="details">
        <h2>{props.layoutRoad.routeKind === "trunk" ? "Dependency trunk" : "Dependency route"}</h2>
        <p>{provider} -&gt; {consumer}</p>
        <MetricList
          items={[
            ["Route", props.layoutRoad.routeKind],
            ["Dependencies", String(representedDependencies)],
            ["Symbols", String(props.layoutRoad.symbolCount)],
            ["Types", props.layoutRoad.dependencyTypes.join(", ") || "runtime"]
          ]}
        />
        <DetailList title="File dependencies" items={dependencyItems} />
      </div>
    );
  }

  if (props.road) {
    const provider = providerLabel(props.road, props.fileMap);
    const consumer = consumerLabel(props.road, props.fileMap);
    return (
      <div className="details">
        <h2>Road</h2>
        <p>{provider} -&gt; {consumer}</p>
        <MetricList
          items={[
            ["Provider", provider],
            ["Consumer", consumer],
            ["Dependencies", "1"],
            ["Type", props.road.type],
            ["Specifier", props.road.moduleSpecifier],
            ["Resolved", props.road.isResolved ? "yes" : "no"],
            ["Circular", props.road.isCircular ? "yes" : "no"]
          ]}
        />
        <DetailList title="Symbols" items={props.road.symbols.map((symbol) => `${symbol.importedName} as ${symbol.localName}`)} />
      </div>
    );
  }

  if (props.folder) {
    return (
      <div className="details">
        <h2>{props.folder.name}</h2>
        <p>{props.folder.path}</p>
        <MetricList
          items={[
            ["Direct files", String(props.folder.metrics.directFileCount)],
            ["Descendant files", String(props.folder.metrics.descendantFileCount)],
            ["Incoming", String(props.folder.metrics.incomingConnectionCount)],
            ["Outgoing", String(props.folder.metrics.outgoingConnectionCount)],
            ["Cycles", String(props.folder.metrics.cycleCount)]
          ]}
        />
      </div>
    );
  }

  return (
    <div className="details empty">
      <h2>Details</h2>
      <p>Select a building, town, or road.</p>
      {props.graph && <DetailList title="Diagnostics" items={props.graph.diagnostics.slice(0, 20).map((diagnostic) => `${diagnostic.severity}: ${diagnostic.message}`)} />}
    </div>
  );
}

function MetricGrid(props: { file: FileNode }): JSX.Element {
  return (
    <MetricList
      items={[
        ["Language", props.file.language],
        ["Kind", props.file.kind],
        ["Imports", String(props.file.metrics.importCount)],
        ["Dependents", String(props.file.metrics.dependentCount)],
        ["Exports", String(props.file.metrics.exportCount)],
        ["Lines", String(props.file.metrics.lineCount ?? 0)]
      ]}
    />
  );
}

function MetricList(props: { items: [string, string][] }): JSX.Element {
  return (
    <dl className="metric-list">
      {props.items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailList(props: { title: string; items: string[] }): JSX.Element {
  return (
    <section className="detail-list">
      <h3>{props.title}</h3>
      {props.items.length > 0 ? (
        <ul>
          {props.items.map((item, index) => (
            <li key={`${item}:${index}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}
    </section>
  );
}

function isConnectionVisible(connection: ImportConnection, graph: ProjectGraph, fileMap: Map<string, FileNode>, filters: Filters, showExternal: boolean): boolean {
  if (!showExternal && connection.externalPackageId) {
    return false;
  }
  if (!filters.runtime && connection.type === "runtime") {
    return false;
  }
  if (!filters.typeOnly && connection.type === "type-only") {
    return false;
  }
  if (!filters.dynamic && connection.type === "dynamic") {
    return false;
  }
  if (!filters.reExport && connection.type === "re-export") {
    return false;
  }
  if (!filters.circular && connection.isCircular) {
    return false;
  }
  if (!filters.tests) {
    const source = fileMap.get(connection.sourceFileId);
    const target = connection.targetFileId ? fileMap.get(connection.targetFileId) : undefined;
    if (source?.kind === "test" || target?.kind === "test") {
      return false;
    }
  }
  return graph.connections.includes(connection);
}

function findSearchMatches(graph: ProjectGraph | undefined, query: string): { fileId: string; reason: string }[] {
  const normalized = query.trim().toLowerCase();
  if (!graph || !normalized) {
    return [];
  }

  const matches: { fileId: string; reason: string }[] = [];
  for (const file of graph.files) {
    if (file.name.toLowerCase().includes(normalized)) {
      matches.push({ fileId: file.id, reason: `file name: ${file.name}` });
    } else if (file.path.toLowerCase().includes(normalized)) {
      matches.push({ fileId: file.id, reason: `path: ${file.path}` });
    }

    for (const symbol of file.exports) {
      if (symbol.name.toLowerCase().includes(normalized)) {
        matches.push({ fileId: file.id, reason: `export: ${symbol.name}` });
      }
    }
  }

  for (const folder of graph.folders) {
    if (folder.name.toLowerCase().includes(normalized) || folder.path.toLowerCase().includes(normalized)) {
      for (const fileId of folder.fileIds) {
        matches.push({ fileId, reason: `folder: ${folder.path}` });
      }
    }
  }

  return matches;
}

function connectedEntityIds(selection: Selection | undefined, graph: ProjectGraph | undefined): Set<string> {
  const ids = new Set<string>();
  if (!selection || !graph) {
    return ids;
  }

  if (selection.kind === "file") {
    ids.add(selection.id);
    for (const connection of graph.connections) {
      if (connection.sourceFileId === selection.id || connection.targetFileId === selection.id) {
        ids.add(connection.id);
        ids.add(connection.sourceFileId);
        if (connection.targetFileId) {
          ids.add(connection.targetFileId);
        }
      }
    }
  } else if (selection.kind === "road") {
    const connection = graph.connections.find((candidate) => candidate.id === selection.id);
    if (connection) {
      ids.add(connection.id);
      ids.add(connection.sourceFileId);
      if (connection.targetFileId) {
        ids.add(connection.targetFileId);
      }
    }
  } else {
    ids.add(selection.id);
  }

  return ids;
}

function nodeState(id: string, selection: Selection | undefined, connectedIds: Set<string>, searchMatches: { fileId: string }[]): string {
  const selected = selection?.kind === "file" && selection.id === id;
  const matched = searchMatches.some((match) => match.fileId === id);
  if (selected) {
    return "selected";
  }
  if (matched) {
    return "search-match";
  }
  if (selection && connectedIds.size > 0) {
    return connectedIds.has(id) ? "connected" : "dimmed";
  }
  return "normal";
}

function roadState(road: TownLayout["roads"][number], selection: Selection | undefined, connectedIds: Set<string>): string {
  if (selection?.kind === "road" && (selection.id === road.id || selection.id === road.trunkId)) {
    return "selected";
  }
  if (selection?.kind === "file" && road.participantFileIds.includes(selection.id)) {
    return "connected";
  }
  if (selection?.kind === "folder" && (road.providerFolderId === selection.id || road.consumerFolderId === selection.id)) {
    return "connected";
  }
  if (selection && connectedIds.size > 0) {
    return connectedIds.has(road.connectionId) || connectedIds.has(road.sourceId) || connectedIds.has(road.targetId) ? "connected" : "dimmed";
  }
  return "normal";
}

function roadTitle(connection: ImportConnection | undefined, road: TownLayout["roads"][number], fileMap: Map<string, FileNode>, folderMap: Map<string, FolderNode>): string {
  const provider = entityLabel(road.providerFolderId ?? road.sourceId, fileMap, folderMap);
  const consumer = entityLabel(road.consumerFolderId ?? road.targetId, fileMap, folderMap);
  const count = road.dependencyCount > 1 ? ` (${road.dependencyCount} imports)` : "";
  const types = road.dependencyTypes.length > 0 ? ` ${road.dependencyTypes.join(", ")}` : "";
  const symbols = road.symbolCount > 0 ? ` ${road.symbolCount} symbols` : "";
  return `${provider} -> ${consumer}${count}${symbols}${types}${connection ? ` ${symbolLabel(connection)}` : ""}`;
}

function providerLabel(connection: ImportConnection, fileMap: Map<string, FileNode>): string {
  if (connection.targetFileId) {
    return fileMap.get(connection.targetFileId)?.path ?? connection.targetFileId;
  }
  if (connection.externalPackageId) {
    return connection.externalPackageId.replace(/^package:/, "");
  }
  return `unresolved: ${connection.moduleSpecifier}`;
}

function consumerLabel(connection: ImportConnection, fileMap: Map<string, FileNode>): string {
  return fileMap.get(connection.sourceFileId)?.path ?? connection.sourceFileId;
}

function entityLabel(id: string, fileMap: Map<string, FileNode>, folderMap: Map<string, FolderNode>): string {
  return fileMap.get(id)?.path ?? folderMap.get(id)?.path ?? id;
}

function symbolLabel(connection: ImportConnection): string {
  const symbols = connection.symbols.map((symbol) => symbol.importedName).join(", ");
  return symbols ? `[${symbols}]` : "";
}

function isTextInputTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}
