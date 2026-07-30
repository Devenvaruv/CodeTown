export interface ProjectGraph {
  project: ProjectMetadata;
  folders: FolderNode[];
  files: FileNode[];
  connections: ImportConnection[];
  externalPackages: ExternalPackageNode[];
  diagnostics: AnalysisDiagnostic[];
}

export interface ProjectMetadata {
  id: string;
  name: string;
  rootPath: string;
  analyzedAt: string;
  fileCount: number;
  folderCount: number;
  connectionCount: number;
}

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parentFolderId?: string;
  childFolderIds: string[];
  fileIds: string[];
  depth: number;
  metrics: FolderMetrics;
}

export interface FolderMetrics {
  directFileCount: number;
  descendantFileCount: number;
  internalConnectionCount: number;
  incomingConnectionCount: number;
  outgoingConnectionCount: number;
  cycleCount: number;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  absolutePath?: string;
  extension: string;
  language: "typescript" | "javascript";
  folderId: string;
  kind: FileKind;
  exports: ExportedSymbol[];
  importConnectionIds: string[];
  dependentConnectionIds: string[];
  metrics: FileMetrics;
  diagnostics: string[];
}

export type FileKind =
  | "component"
  | "service"
  | "controller"
  | "route"
  | "repository"
  | "utility"
  | "configuration"
  | "test"
  | "entry"
  | "index"
  | "other";

export interface FileMetrics {
  lineCount?: number;
  importCount: number;
  dependentCount: number;
  exportCount: number;
  cycleCount: number;
}

export interface ExportedSymbol {
  id: string;
  name: string;
  kind:
    | "function"
    | "class"
    | "type"
    | "interface"
    | "enum"
    | "constant"
    | "variable"
    | "namespace"
    | "default"
    | "unknown";
  isDefault: boolean;
  isTypeOnly: boolean;
  sourceFileId: string;
  line?: number;
}

export interface ImportConnection {
  id: string;
  sourceFileId: string;
  targetFileId?: string;
  externalPackageId?: string;
  moduleSpecifier: string;
  symbols: ImportedSymbol[];
  type: "runtime" | "type-only" | "dynamic" | "re-export";
  isResolved: boolean;
  isCircular: boolean;
  sourceLine?: number;
}

export interface ImportedSymbol {
  importedName: string;
  localName: string;
  isDefault: boolean;
  isNamespace: boolean;
  isTypeOnly: boolean;
}

export interface ExternalPackageNode {
  id: string;
  packageName: string;
  incomingConnectionIds: string[];
}

export interface AnalysisDiagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  filePath?: string;
  message: string;
  code?: string;
}
