# Data Model

## Graph root

```ts
export interface ProjectGraph {
  project: ProjectMetadata;
  folders: FolderNode[];
  files: FileNode[];
  connections: ImportConnection[];
  externalPackages: ExternalPackageNode[];
  diagnostics: AnalysisDiagnostic[];
}
```

## Project metadata

```ts
export interface ProjectMetadata {
  id: string;
  name: string;
  rootPath: string;
  analyzedAt: string;
  fileCount: number;
  folderCount: number;
  connectionCount: number;
}
```

## Folder node

```ts
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
```

## File node

```ts
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
```

## Exported symbol

```ts
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
```

## Import connection

```ts
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
```

## External package

```ts
export interface ExternalPackageNode {
  id: string;
  packageName: string;
  incomingConnectionIds: string[];
}
```

## Diagnostic

```ts
export interface AnalysisDiagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  filePath?: string;
  message: string;
  code?: string;
}
```

## Stable IDs

IDs must be deterministic.

Recommended format:

- folder: normalized project-relative path
- file: normalized project-relative path
- connection: source file ID + target/module specifier + dependency type + source line
- symbol: file ID + symbol name + kind + line

Do not use random UUIDs for graph entities because positions and selections must survive refreshes.
