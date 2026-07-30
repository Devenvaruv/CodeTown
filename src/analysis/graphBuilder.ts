import path from "node:path";
import type {
  AnalysisDiagnostic,
  ExportedSymbol,
  ExternalPackageNode,
  FileNode,
  FolderNode,
  ImportConnection,
  ImportedSymbol,
  ProjectGraph
} from "../shared/graphTypes";
import { fileNameFromPath, normalizeRelativePath, parentFolderId } from "../shared/pathUtils";
import { findCircularConnectionIds } from "./cycles";

export interface ParsedFile {
  id: string;
  absolutePath: string;
  path: string;
  extension: string;
  language: "typescript" | "javascript";
  folderId: string;
  kind: FileNode["kind"];
  lineCount: number;
  exports: Omit<ExportedSymbol, "id" | "sourceFileId">[];
  connections: ParsedConnection[];
  diagnostics: string[];
}

export interface ParsedConnection {
  targetFileId?: string;
  externalPackageName?: string;
  moduleSpecifier: string;
  symbols: ImportedSymbol[];
  type: ImportConnection["type"];
  isResolved: boolean;
  sourceLine?: number;
}

export interface BuildGraphInput {
  rootPath: string;
  projectName: string;
  files: ParsedFile[];
  diagnostics: AnalysisDiagnostic[];
}

export function buildProjectGraph(input: BuildGraphInput): ProjectGraph {
  const folders = buildFolders(input.projectName, input.files);
  const files = input.files.map((parsedFile) => createFileNode(parsedFile));
  const externalPackageMap = new Map<string, ExternalPackageNode>();
  const connections = createConnections(input.files, externalPackageMap);
  markCircularConnections(files, connections);
  populateReverseDependencies(files, connections);
  calculateFileMetrics(files, connections);
  calculateFolderMetrics(folders, files, connections);

  return {
    project: {
      id: normalizeRelativePath(input.rootPath),
      name: input.projectName,
      rootPath: input.rootPath,
      analyzedAt: new Date().toISOString(),
      fileCount: files.length,
      folderCount: folders.length,
      connectionCount: connections.length
    },
    folders,
    files,
    connections,
    externalPackages: [...externalPackageMap.values()].sort((a, b) => a.packageName.localeCompare(b.packageName)),
    diagnostics: input.diagnostics
  };
}

function buildFolders(projectName: string, files: ParsedFile[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>();

  function ensureFolder(id: string): FolderNode {
    const normalizedId = normalizeRelativePath(id);
    const existing = folderMap.get(normalizedId);
    if (existing) {
      return existing;
    }

    const parentId = parentFolderId(normalizedId);
    const folder: FolderNode = {
      id: normalizedId,
      name: normalizedId === "." ? projectName : path.posix.basename(normalizedId),
      path: normalizedId,
      parentFolderId: parentId,
      childFolderIds: [],
      fileIds: [],
      depth: normalizedId === "." ? 0 : normalizedId.split("/").length,
      metrics: emptyFolderMetrics()
    };
    folderMap.set(normalizedId, folder);

    if (parentId) {
      const parent = ensureFolder(parentId);
      if (!parent.childFolderIds.includes(normalizedId)) {
        parent.childFolderIds.push(normalizedId);
      }
    }

    return folder;
  }

  ensureFolder(".");
  for (const file of files) {
    const folder = ensureFolder(file.folderId);
    folder.fileIds.push(file.id);
  }

  return [...folderMap.values()]
    .map((folder) => ({
      ...folder,
      childFolderIds: folder.childFolderIds.sort(),
      fileIds: folder.fileIds.sort()
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function createFileNode(parsedFile: ParsedFile): FileNode {
  return {
    id: parsedFile.id,
    name: fileNameFromPath(parsedFile.path),
    path: parsedFile.path,
    absolutePath: parsedFile.absolutePath,
    extension: parsedFile.extension,
    language: parsedFile.language,
    folderId: parsedFile.folderId,
    kind: parsedFile.kind,
    exports: parsedFile.exports.map((symbol) => ({
      ...symbol,
      id: `${parsedFile.id}::${symbol.name}::${symbol.kind}::${symbol.line ?? 0}`,
      sourceFileId: parsedFile.id
    })),
    importConnectionIds: [],
    dependentConnectionIds: [],
    metrics: {
      lineCount: parsedFile.lineCount,
      importCount: 0,
      dependentCount: 0,
      exportCount: parsedFile.exports.length,
      cycleCount: 0
    },
    diagnostics: parsedFile.diagnostics
  };
}

function createConnections(files: ParsedFile[], externalPackageMap: Map<string, ExternalPackageNode>): ImportConnection[] {
  const connections: ImportConnection[] = [];

  for (const file of files) {
    file.connections.forEach((parsedConnection, index) => {
      const externalPackageId = parsedConnection.externalPackageName ? `package:${parsedConnection.externalPackageName}` : undefined;
      const connection: ImportConnection = {
        id: createConnectionId(file.id, parsedConnection, index),
        sourceFileId: file.id,
        targetFileId: parsedConnection.targetFileId,
        externalPackageId,
        moduleSpecifier: parsedConnection.moduleSpecifier,
        symbols: parsedConnection.symbols,
        type: parsedConnection.type,
        isResolved: parsedConnection.isResolved,
        isCircular: false,
        sourceLine: parsedConnection.sourceLine
      };
      connections.push(connection);

      if (externalPackageId && parsedConnection.externalPackageName) {
        const existing = externalPackageMap.get(externalPackageId);
        if (existing) {
          existing.incomingConnectionIds.push(connection.id);
        } else {
          externalPackageMap.set(externalPackageId, {
            id: externalPackageId,
            packageName: parsedConnection.externalPackageName,
            incomingConnectionIds: [connection.id]
          });
        }
      }
    });
  }

  return connections.sort((a, b) => a.id.localeCompare(b.id));
}

function createConnectionId(sourceFileId: string, connection: ParsedConnection, index: number): string {
  const target = connection.targetFileId ?? connection.externalPackageName ?? "unresolved";
  const line = connection.sourceLine ?? 0;
  const symbols = connection.symbols.map((symbol) => `${symbol.importedName}:${symbol.localName}`).join(",");
  return `${sourceFileId}::${target}::${connection.type}::${line}::${index}::${symbols}`;
}

function markCircularConnections(files: FileNode[], connections: ImportConnection[]): void {
  const circularIds = findCircularConnectionIds(
    files.map((file) => file.id),
    connections
  );
  for (const connection of connections) {
    connection.isCircular = circularIds.has(connection.id);
  }
}

function populateReverseDependencies(files: FileNode[], connections: ImportConnection[]): void {
  const fileMap = new Map(files.map((file) => [file.id, file]));
  for (const connection of connections) {
    fileMap.get(connection.sourceFileId)?.importConnectionIds.push(connection.id);
    if (connection.targetFileId) {
      fileMap.get(connection.targetFileId)?.dependentConnectionIds.push(connection.id);
    }
  }

  for (const file of files) {
    file.importConnectionIds.sort();
    file.dependentConnectionIds.sort();
  }
}

function calculateFileMetrics(files: FileNode[], connections: ImportConnection[]): void {
  const connectionMap = new Map(connections.map((connection) => [connection.id, connection]));
  for (const file of files) {
    file.metrics.importCount = file.importConnectionIds.length;
    file.metrics.dependentCount = file.dependentConnectionIds.length;
    file.metrics.exportCount = file.exports.length;
    file.metrics.cycleCount = [...file.importConnectionIds, ...file.dependentConnectionIds].filter(
      (connectionId) => connectionMap.get(connectionId)?.isCircular
    ).length;
  }
}

function calculateFolderMetrics(folders: FolderNode[], files: FileNode[], connections: ImportConnection[]): void {
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const fileMap = new Map(files.map((file) => [file.id, file]));

  for (const folder of folders) {
    const descendants = files.filter((file) => file.folderId === folder.id || file.folderId.startsWith(`${folder.id}/`) || folder.id === ".");
    folder.metrics.directFileCount = folder.fileIds.length;
    folder.metrics.descendantFileCount = descendants.length;
  }

  for (const connection of connections) {
    const sourceFolder = fileMap.get(connection.sourceFileId)?.folderId;
    const targetFolder = connection.targetFileId ? fileMap.get(connection.targetFileId)?.folderId : undefined;
    if (!sourceFolder || !targetFolder) {
      continue;
    }

    for (const folder of foldersContaining(sourceFolder, folderMap)) {
      if (targetFolder === folder.id || targetFolder.startsWith(`${folder.id}/`)) {
        folder.metrics.internalConnectionCount += 1;
      } else {
        folder.metrics.outgoingConnectionCount += 1;
      }
      if (connection.isCircular) {
        folder.metrics.cycleCount += 1;
      }
    }

    for (const folder of foldersContaining(targetFolder, folderMap)) {
      if (!(sourceFolder === folder.id || sourceFolder.startsWith(`${folder.id}/`))) {
        folder.metrics.incomingConnectionCount += 1;
      }
    }
  }
}

function foldersContaining(folderId: string, folderMap: Map<string, FolderNode>): FolderNode[] {
  const result: FolderNode[] = [];
  let currentId: string | undefined = folderId;
  while (currentId) {
    const folder = folderMap.get(currentId);
    if (folder) {
      result.push(folder);
    }
    currentId = parentFolderId(currentId);
  }
  return result;
}

function emptyFolderMetrics() {
  return {
    directFileCount: 0,
    descendantFileCount: 0,
    internalConnectionCount: 0,
    incomingConnectionCount: 0,
    outgoingConnectionCount: 0,
    cycleCount: 0
  };
}
