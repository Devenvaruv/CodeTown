import path from "node:path";

export function toPosixPath(value: string): string {
  return value.replace(/\\/g, "/");
}

export function normalizeRelativePath(value: string): string {
  return trimDotPrefix(toPosixPath(value)).replace(/\/+/g, "/");
}

export function relativePath(rootPath: string, absolutePath: string): string {
  const relative = path.relative(rootPath, absolutePath);
  return normalizeRelativePath(relative || ".");
}

export function folderIdFromRelativeFilePath(filePath: string): string {
  const folder = normalizeRelativePath(path.posix.dirname(normalizeRelativePath(filePath)));
  return folder === "." ? "." : folder;
}

export function parentFolderId(folderId: string): string | undefined {
  if (folderId === ".") {
    return undefined;
  }
  const parent = path.posix.dirname(folderId);
  return parent === "." ? "." : parent;
}

export function fileNameFromPath(value: string): string {
  return path.posix.basename(normalizeRelativePath(value));
}

function trimDotPrefix(value: string): string {
  if (value === ".") {
    return value;
  }
  return value.replace(/^\.\//, "");
}
