import fs from "node:fs/promises";
import path from "node:path";
import { DEFAULT_EXCLUDED_DIRS, GENERATED_FILE_PATTERNS, SUPPORTED_EXTENSIONS } from "../shared/constants";
import { relativePath, toPosixPath } from "../shared/pathUtils";

export interface DiscoverFilesOptions {
  exclude?: string[];
  maxFiles?: number;
}

export async function discoverSourceFiles(rootPath: string, options: DiscoverFilesOptions = {}): Promise<string[]> {
  const excluded = new Set([...DEFAULT_EXCLUDED_DIRS, ...(options.exclude ?? [])].map((item) => normalizeFragment(item)));
  const found: string[] = [];

  await walk(rootPath, rootPath, excluded, found);

  const sorted = found.sort((a, b) => relativePath(rootPath, a).localeCompare(relativePath(rootPath, b)));
  if (options.maxFiles !== undefined && sorted.length > options.maxFiles) {
    throw new Error(`Workspace has ${sorted.length} supported source files, above the configured limit of ${options.maxFiles}.`);
  }

  return sorted;
}

async function walk(rootPath: string, currentPath: string, excluded: Set<string>, found: string[]): Promise<void> {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentPath, entry.name);
    const normalizedRelative = relativePath(rootPath, absolutePath);

    if (entry.isDirectory()) {
      if (isExcluded(entry.name, normalizedRelative, excluded)) {
        continue;
      }
      await walk(rootPath, absolutePath, excluded, found);
      continue;
    }

    if (entry.isFile() && isSupportedSourceFile(entry.name)) {
      found.push(absolutePath);
    }
  }
}

export function isSupportedSourceFile(fileName: string): boolean {
  if (GENERATED_FILE_PATTERNS.some((pattern) => fileName.endsWith(pattern))) {
    return false;
  }
  return SUPPORTED_EXTENSIONS.some((extension) => fileName.endsWith(extension));
}

function isExcluded(name: string, relative: string, excluded: Set<string>): boolean {
  const normalizedName = normalizeFragment(name);
  const normalizedRelative = normalizeFragment(relative);
  return excluded.has(normalizedName) || excluded.has(normalizedRelative) || [...excluded].some((item) => normalizedRelative.includes(`/${item}/`));
}

function normalizeFragment(value: string): string {
  return toPosixPath(value).replace(/^\/+|\/+$/g, "");
}
