import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function copyCodebaseTownAssets() {
  return {
    name: "copy-codebase-town-assets",
    closeBundle() {
      const source = path.resolve(__dirname, "assets");
      const target = path.resolve(__dirname, "dist", "webview", "codebase-town-assets");
      if (!existsSync(source)) {
        return;
      }
      rmSync(target, { recursive: true, force: true });
      cpSync(source, target, { recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [react(), copyCodebaseTownAssets()],
  root: "src/webview",
  base: "",
  build: {
    outDir: "../../dist/webview",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: "src/webview/main.tsx",
      output: {
        entryFileNames: "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
