import fs from "node:fs";
import path from "node:path";
import {
  ExportDeclaration,
  ImportDeclaration,
  Node,
  Project,
  ScriptKind,
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind,
  ts
} from "ts-morph";
import type { AnalysisDiagnostic, ExportedSymbol, ImportedSymbol, ImportConnection } from "../shared/graphTypes";
import { DEFAULT_MAX_FILES } from "../shared/constants";
import { folderIdFromRelativeFilePath, normalizeRelativePath, relativePath } from "../shared/pathUtils";
import { discoverSourceFiles } from "./discoverFiles";
import { inferFileKind } from "./fileKind";
import { buildProjectGraph, type ParsedConnection, type ParsedFile } from "./graphBuilder";

export interface ParseProjectOptions {
  exclude?: string[];
  maxFiles?: number;
  onProgress?: (phase: string, completed?: number, total?: number) => void;
}

export async function parseProject(rootPath: string, options: ParseProjectOptions = {}) {
  const diagnostics: AnalysisDiagnostic[] = [];
  options.onProgress?.("discovering source files");
  const sourceFilePaths = await discoverSourceFiles(rootPath, {
    exclude: options.exclude,
    maxFiles: options.maxFiles ?? DEFAULT_MAX_FILES
  });

  if (sourceFilePaths.length === 0) {
    diagnostics.push({
      id: "empty-workspace",
      severity: "warning",
      message: "No supported JavaScript or TypeScript source files were found.",
      code: "EMPTY_WORKSPACE"
    });
  }

  options.onProgress?.("parsing imports and exports", 0, sourceFilePaths.length);
  const project = createTsMorphProject(rootPath);
  for (const filePath of sourceFilePaths) {
    project.addSourceFileAtPathIfExists(filePath);
  }

  const knownFileIds = new Map<string, string>();
  for (const filePath of sourceFilePaths) {
    knownFileIds.set(path.normalize(filePath), relativePath(rootPath, filePath));
  }

  const parsedFiles: ParsedFile[] = [];
  sourceFilePaths.forEach((filePath, index) => {
    const sourceFile = project.getSourceFile(filePath);
    if (!sourceFile) {
      diagnostics.push(createDiagnostic("error", filePath, "Unable to load source file for analysis.", "SOURCE_LOAD_FAILED"));
      return;
    }

    try {
      parsedFiles.push(parseSourceFile(rootPath, sourceFile, knownFileIds, project, diagnostics));
    } catch (error) {
      diagnostics.push(
        createDiagnostic(
          "error",
          filePath,
          error instanceof Error ? error.message : "Unknown parser failure.",
          "SOURCE_PARSE_FAILED"
        )
      );
    }
    options.onProgress?.("parsing imports and exports", index + 1, sourceFilePaths.length);
  });

  options.onProgress?.("building graph");
  return buildProjectGraph({
    rootPath,
    projectName: path.basename(rootPath),
    files: parsedFiles.sort((a, b) => a.id.localeCompare(b.id)),
    diagnostics
  });
}

function createTsMorphProject(rootPath: string): Project {
  const tsConfigPath = ["tsconfig.json", "jsconfig.json"]
    .map((fileName) => path.join(rootPath, fileName))
    .find((candidate) => fs.existsSync(candidate));

  if (tsConfigPath) {
    return new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: true
    });
  }

  return new Project({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      jsx: ts.JsxEmit.ReactJSX,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      target: ts.ScriptTarget.ES2022
    },
    skipAddingFilesFromTsConfig: true
  });
}

function parseSourceFile(
  rootPath: string,
  sourceFile: SourceFile,
  knownFileIds: Map<string, string>,
  project: Project,
  diagnostics: AnalysisDiagnostic[]
): ParsedFile {
  const absolutePath = path.normalize(sourceFile.getFilePath());
  const id = relativePath(rootPath, absolutePath);
  const extension = path.extname(id);
  const text = sourceFile.getFullText();
  const fileDiagnostics: string[] = [];
  const syntaxDiagnostics = sourceFile.getPreEmitDiagnostics().filter((diagnostic) => diagnostic.getCategory() === ts.DiagnosticCategory.Error);

  for (const diagnostic of syntaxDiagnostics.slice(0, 5)) {
    const message = diagnostic.getMessageText().toString();
    fileDiagnostics.push(message);
    diagnostics.push(createDiagnostic("warning", absolutePath, message, "TS_DIAGNOSTIC"));
  }

  const connections = [
    ...extractImportDeclarations(sourceFile, rootPath, knownFileIds, project, diagnostics),
    ...extractReExports(sourceFile, rootPath, knownFileIds, project, diagnostics),
    ...extractDynamicImportsAndRequires(sourceFile, rootPath, knownFileIds, project, diagnostics)
  ];
  const exportedSymbols = extractExports(sourceFile);

  return {
    id,
    absolutePath,
    path: id,
    extension,
    language: extension.includes("ts") ? "typescript" : "javascript",
    folderId: folderIdFromRelativeFilePath(id),
    kind: inferFileKind(id, sourceFile.getScriptKind() === ScriptKind.TSX || sourceFile.getScriptKind() === ScriptKind.JSX, exportedSymbols),
    lineCount: text.length === 0 ? 0 : text.split(/\r?\n/).length,
    exports: exportedSymbols,
    connections,
    diagnostics: fileDiagnostics
  };
}

function extractImportDeclarations(
  sourceFile: SourceFile,
  rootPath: string,
  knownFileIds: Map<string, string>,
  project: Project,
  diagnostics: AnalysisDiagnostic[]
): ParsedConnection[] {
  return sourceFile.getImportDeclarations().map((declaration) => {
    const symbols = importedSymbolsFromDeclaration(declaration);
    const isTypeOnly = declaration.isTypeOnly() || (symbols.length > 0 && symbols.every((symbol) => symbol.isTypeOnly));
    return resolveConnection({
      sourceFile,
      moduleSpecifier: declaration.getModuleSpecifierValue(),
      symbols,
      type: isTypeOnly ? "type-only" : "runtime",
      sourceLine: declaration.getStartLineNumber(),
      rootPath,
      knownFileIds,
      project,
      diagnostics,
      tsMorphResolvedSourceFile: declaration.getModuleSpecifierSourceFile()
    });
  });
}

function importedSymbolsFromDeclaration(declaration: ImportDeclaration): ImportedSymbol[] {
  const symbols: ImportedSymbol[] = [];
  const isDeclarationTypeOnly = declaration.isTypeOnly();
  const defaultImport = declaration.getDefaultImport();
  const namespaceImport = declaration.getNamespaceImport();

  if (defaultImport) {
    symbols.push({
      importedName: "default",
      localName: defaultImport.getText(),
      isDefault: true,
      isNamespace: false,
      isTypeOnly: isDeclarationTypeOnly
    });
  }

  if (namespaceImport) {
    symbols.push({
      importedName: "*",
      localName: namespaceImport.getText(),
      isDefault: false,
      isNamespace: true,
      isTypeOnly: isDeclarationTypeOnly
    });
  }

  for (const namedImport of declaration.getNamedImports()) {
    const importedName = namedImport.getNameNode().getText();
    symbols.push({
      importedName,
      localName: namedImport.getAliasNode()?.getText() ?? importedName,
      isDefault: false,
      isNamespace: false,
      isTypeOnly: isDeclarationTypeOnly || namedImport.isTypeOnly()
    });
  }

  if (symbols.length === 0) {
    symbols.push({
      importedName: "*side-effect*",
      localName: "*side-effect*",
      isDefault: false,
      isNamespace: false,
      isTypeOnly: false
    });
  }

  return symbols;
}

function extractReExports(
  sourceFile: SourceFile,
  rootPath: string,
  knownFileIds: Map<string, string>,
  project: Project,
  diagnostics: AnalysisDiagnostic[]
): ParsedConnection[] {
  return sourceFile
    .getExportDeclarations()
    .filter((declaration) => declaration.getModuleSpecifierValue() !== undefined)
    .map((declaration) =>
      resolveConnection({
        sourceFile,
        moduleSpecifier: declaration.getModuleSpecifierValue() ?? "",
        symbols: exportedSymbolsFromDeclaration(declaration),
        type: "re-export",
        sourceLine: declaration.getStartLineNumber(),
        rootPath,
        knownFileIds,
        project,
        diagnostics,
        tsMorphResolvedSourceFile: declaration.getModuleSpecifierSourceFile()
      })
    );
}

function exportedSymbolsFromDeclaration(declaration: ExportDeclaration): ImportedSymbol[] {
  const namedExports = declaration.getNamedExports();
  if (namedExports.length === 0) {
    return [
      {
        importedName: "*",
        localName: "*",
        isDefault: false,
        isNamespace: true,
        isTypeOnly: false
      }
    ];
  }

  return namedExports.map((exportSpecifier) => {
    const importedName = exportSpecifier.getNameNode().getText();
    return {
      importedName,
      localName: exportSpecifier.getAliasNode()?.getText() ?? importedName,
      isDefault: false,
      isNamespace: false,
      isTypeOnly: exportSpecifier.isTypeOnly()
    };
  });
}

function extractDynamicImportsAndRequires(
  sourceFile: SourceFile,
  rootPath: string,
  knownFileIds: Map<string, string>,
  project: Project,
  diagnostics: AnalysisDiagnostic[]
): ParsedConnection[] {
  const connections: ParsedConnection[] = [];

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) {
      return;
    }

    const expression = node.getExpression();
    const firstArgument = node.getArguments()[0];
    if (!firstArgument || !Node.isStringLiteral(firstArgument)) {
      return;
    }

    if (expression.getKind() === SyntaxKind.ImportKeyword) {
      connections.push(
        resolveConnection({
          sourceFile,
          moduleSpecifier: firstArgument.getLiteralValue(),
          symbols: [anonymousImportSymbol("dynamic")],
          type: "dynamic",
          sourceLine: node.getStartLineNumber(),
          rootPath,
          knownFileIds,
          project,
          diagnostics
        })
      );
      return;
    }

    if (Node.isIdentifier(expression) && expression.getText() === "require") {
      connections.push(
        resolveConnection({
          sourceFile,
          moduleSpecifier: firstArgument.getLiteralValue(),
          symbols: [anonymousImportSymbol("require")],
          type: "runtime",
          sourceLine: node.getStartLineNumber(),
          rootPath,
          knownFileIds,
          project,
          diagnostics
        })
      );
    }
  });

  return connections;
}

function anonymousImportSymbol(name: string): ImportedSymbol {
  return {
    importedName: name,
    localName: name,
    isDefault: false,
    isNamespace: false,
    isTypeOnly: false
  };
}

interface ResolveConnectionInput {
  sourceFile: SourceFile;
  moduleSpecifier: string;
  symbols: ImportedSymbol[];
  type: ImportConnection["type"];
  sourceLine?: number;
  rootPath: string;
  knownFileIds: Map<string, string>;
  project: Project;
  diagnostics: AnalysisDiagnostic[];
  tsMorphResolvedSourceFile?: SourceFile;
}

function resolveConnection(input: ResolveConnectionInput): ParsedConnection {
  const resolvedPath =
    input.tsMorphResolvedSourceFile?.getFilePath() ??
    ts.resolveModuleName(
      input.moduleSpecifier,
      input.sourceFile.getFilePath(),
      input.project.getCompilerOptions(),
      ts.sys
    ).resolvedModule?.resolvedFileName;

  if (resolvedPath) {
    const targetFileId = input.knownFileIds.get(path.normalize(resolvedPath));
    if (targetFileId) {
      return {
        targetFileId,
        moduleSpecifier: input.moduleSpecifier,
        symbols: input.symbols,
        type: input.type,
        isResolved: true,
        sourceLine: input.sourceLine
      };
    }
  }

  if (isExternalPackage(input.moduleSpecifier)) {
    return {
      externalPackageName: packageNameFromSpecifier(input.moduleSpecifier),
      moduleSpecifier: input.moduleSpecifier,
      symbols: input.symbols,
      type: input.type,
      isResolved: true,
      sourceLine: input.sourceLine
    };
  }

  input.diagnostics.push(
    createDiagnostic(
      "warning",
      input.sourceFile.getFilePath(),
      `Unable to resolve local module "${input.moduleSpecifier}".`,
      "UNRESOLVED_IMPORT"
    )
  );

  return {
    moduleSpecifier: input.moduleSpecifier,
    symbols: input.symbols,
    type: input.type,
    isResolved: false,
    sourceLine: input.sourceLine
  };
}

function extractExports(sourceFile: SourceFile): Omit<ExportedSymbol, "id" | "sourceFileId">[] {
  const symbols = new Map<string, Omit<ExportedSymbol, "id" | "sourceFileId">>();
  const exportedDeclarations = sourceFile.getExportedDeclarations();

  for (const [name, declarations] of exportedDeclarations) {
    for (const declaration of declarations) {
      const symbol = {
        name,
        kind: name === "default" ? "default" : kindFromDeclaration(declaration),
        isDefault: name === "default",
        isTypeOnly: isTypeDeclaration(declaration),
        line: declaration.getStartLineNumber()
      } satisfies Omit<ExportedSymbol, "id" | "sourceFileId">;
      symbols.set(`${symbol.name}:${symbol.kind}:${symbol.line ?? 0}`, symbol);
    }
  }

  for (const exportAssignment of sourceFile.getExportAssignments()) {
    const line = exportAssignment.getStartLineNumber();
    symbols.set(`default:default:${line}`, {
      name: "default",
      kind: "default",
      isDefault: true,
      isTypeOnly: false,
      line
    });
  }

  for (const exportDeclaration of sourceFile.getExportDeclarations()) {
    if (!exportDeclaration.getModuleSpecifierValue()) {
      for (const namedExport of exportDeclaration.getNamedExports()) {
        const name = namedExport.getAliasNode()?.getText() ?? namedExport.getNameNode().getText();
        symbols.set(`${name}:unknown:${exportDeclaration.getStartLineNumber()}`, {
          name,
          kind: "unknown",
          isDefault: false,
          isTypeOnly: namedExport.isTypeOnly(),
          line: exportDeclaration.getStartLineNumber()
        });
      }
    }
  }

  return [...symbols.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function kindFromDeclaration(declaration: Node): ExportedSymbol["kind"] {
  if (Node.isFunctionDeclaration(declaration) || Node.isFunctionExpression(declaration) || Node.isArrowFunction(declaration)) {
    return "function";
  }
  if (Node.isClassDeclaration(declaration) || Node.isClassExpression(declaration)) {
    return "class";
  }
  if (Node.isInterfaceDeclaration(declaration)) {
    return "interface";
  }
  if (Node.isTypeAliasDeclaration(declaration)) {
    return "type";
  }
  if (Node.isEnumDeclaration(declaration)) {
    return "enum";
  }
  if (Node.isVariableDeclaration(declaration)) {
    return declaration.getVariableStatementOrThrow().getDeclarationKind() === VariableDeclarationKind.Const ? "constant" : "variable";
  }
  if (Node.isModuleDeclaration(declaration)) {
    return "namespace";
  }
  return "unknown";
}

function isTypeDeclaration(declaration: Node): boolean {
  return Node.isInterfaceDeclaration(declaration) || Node.isTypeAliasDeclaration(declaration);
}

function isExternalPackage(moduleSpecifier: string): boolean {
  return !moduleSpecifier.startsWith(".") && !path.isAbsolute(moduleSpecifier);
}

function packageNameFromSpecifier(moduleSpecifier: string): string {
  const normalized = normalizeRelativePath(moduleSpecifier);
  if (normalized.startsWith("@")) {
    return normalized.split("/").slice(0, 2).join("/");
  }
  return normalized.split("/")[0] ?? normalized;
}

function createDiagnostic(
  severity: AnalysisDiagnostic["severity"],
  absolutePath: string | undefined,
  message: string,
  code: string
): AnalysisDiagnostic {
  return {
    id: `${code}:${absolutePath ?? "project"}:${message}`,
    severity,
    filePath: absolutePath,
    message,
    code
  };
}
