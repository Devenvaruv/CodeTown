import path from "node:path";
import type { ExportedSymbol, FileKind } from "../shared/graphTypes";

export function inferFileKind(
  relativePath: string,
  hasJsx: boolean,
  exports: Pick<ExportedSymbol, "name" | "kind" | "isDefault">[] = []
): FileKind {
  const normalizedPath = relativePath.replace(/\\/g, "/").toLowerCase();
  const baseName = path.posix.basename(relativePath).toLowerCase();
  const pathParts = normalizedPath.split("/");

  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(baseName) || pathParts.includes("__tests__") || pathParts.includes("tests")) {
    return "test";
  }
  if (
    /\.repository\.[cm]?[jt]sx?$/.test(baseName) ||
    /\.(model|schema|entity)\.[cm]?[jt]sx?$/.test(baseName) ||
    hasAnyPathPart(pathParts, ["repositories", "database", "db", "models", "schemas", "entities"])
  ) {
    return "repository";
  }
  if (/\.service\.[cm]?[jt]sx?$/.test(baseName) || pathParts.includes("services") || exportsServiceLikeSymbol(exports)) {
    return "service";
  }
  if (/\.controller\.[cm]?[jt]sx?$/.test(baseName) || pathParts.includes("controllers")) {
    return "controller";
  }
  if (/(\.route|\.routes|routes)\.[cm]?[jt]sx?$/.test(baseName) || pathParts.includes("routes")) {
    return "route";
  }
  if (/(\.config|config)\.[cm]?[jt]sx?$/.test(baseName)) {
    return "configuration";
  }
  if (
    /\.(util|utils|helper|helpers)\.[cm]?[jt]sx?$/.test(baseName) ||
    /^utils\.[cm]?[jt]sx?$/.test(baseName) ||
    /^helpers\.[cm]?[jt]sx?$/.test(baseName) ||
    hasAnyPathPart(pathParts, ["utils", "helpers"])
  ) {
    return "utility";
  }
  if (isApplicationEntry(baseName)) {
    return "entry";
  }
  if (isIndexOrBarrel(baseName, exports)) {
    return "index";
  }
  if (
    hasJsx ||
    /\.(component)\.[cm]?[jt]sx?$/.test(baseName) ||
    hasAnyPathPart(pathParts, ["components", "pages", "views"]) ||
    exportsComponentLikeSymbol(exports)
  ) {
    return "component";
  }

  return "other";
}

function hasAnyPathPart(pathParts: string[], candidates: string[]): boolean {
  return candidates.some((candidate) => pathParts.includes(candidate));
}

function exportsServiceLikeSymbol(exports: Pick<ExportedSymbol, "name" | "kind">[]): boolean {
  return exports.some((symbol) => symbol.kind === "class" && /service$/i.test(symbol.name));
}

function exportsComponentLikeSymbol(exports: Pick<ExportedSymbol, "name" | "isDefault">[]): boolean {
  return exports.some((symbol) => symbol.isDefault || /^[A-Z][A-Za-z0-9]*$/.test(symbol.name));
}

function isApplicationEntry(baseName: string): boolean {
  return /^(main|app|server|bootstrap)\.[cm]?[jt]sx?$/.test(baseName);
}

function isIndexOrBarrel(baseName: string, exports: Pick<ExportedSymbol, "kind">[]): boolean {
  return baseName.startsWith("index.") || (exports.length >= 3 && exports.every((symbol) => symbol.kind === "unknown"));
}
