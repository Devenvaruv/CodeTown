export const SUPPORTED_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"] as const;

export const DEFAULT_EXCLUDED_DIRS = [
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "out",
  ".turbo"
];

export const GENERATED_FILE_PATTERNS = [".d.ts", ".min.js", ".min.css"];

export const DEFAULT_MAX_FILES = 1500;
