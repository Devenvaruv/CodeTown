import fs from "node:fs";
import path from "node:path";
import * as vscode from "vscode";
import { parseProject } from "../analysis/parseProject";
import type { ProjectGraph } from "../shared/graphTypes";
import type { ExtensionToWebviewMessage } from "../shared/messageTypes";
import { isWebviewToExtensionMessage } from "../shared/messageTypes";

export class CodebaseTownPanel {
  private static activePanel: CodebaseTownPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private currentGraph: ProjectGraph | undefined;
  private watcher: vscode.FileSystemWatcher | undefined;
  private refreshTimer: NodeJS.Timeout | undefined;

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly panel: vscode.WebviewPanel
  ) {
    this.panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "dist", "webview")]
    };
    this.panel.webview.html = this.getWebviewHtml();
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
    this.panel.webview.onDidReceiveMessage((message) => void this.handleMessage(message), undefined, this.disposables);
  }

  static async createOrShow(context: vscode.ExtensionContext): Promise<void> {
    if (CodebaseTownPanel.activePanel) {
      CodebaseTownPanel.activePanel.panel.reveal(vscode.ViewColumn.One);
      await CodebaseTownPanel.activePanel.analyzeWorkspace();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "codebaseTownMap",
      "Codebase Town",
      vscode.ViewColumn.One,
      { retainContextWhenHidden: true }
    );
    CodebaseTownPanel.activePanel = new CodebaseTownPanel(context, panel);
    await CodebaseTownPanel.activePanel.analyzeWorkspace();
  }

  static async refreshActive(): Promise<void> {
    if (!CodebaseTownPanel.activePanel) {
      return;
    }
    await CodebaseTownPanel.activePanel.analyzeWorkspace(true);
  }

  static async focusCurrentFile(context: vscode.ExtensionContext): Promise<void> {
    if (!CodebaseTownPanel.activePanel) {
      await CodebaseTownPanel.createOrShow(context);
    }

    const activePanel = CodebaseTownPanel.activePanel;
    const activeEditor = vscode.window.activeTextEditor;
    if (!activePanel || !activeEditor || !activePanel.currentGraph) {
      return;
    }

    const currentPath = path.normalize(activeEditor.document.uri.fsPath);
    const file = activePanel.currentGraph.files.find((candidate) => candidate.absolutePath && path.normalize(candidate.absolutePath) === currentPath);
    if (file) {
      activePanel.postMessage({ type: "fileFocused", fileId: file.id });
    }
  }

  static clearCache(): void {
    if (CodebaseTownPanel.activePanel) {
      CodebaseTownPanel.activePanel.currentGraph = undefined;
    }
  }

  static disposeActive(): void {
    CodebaseTownPanel.activePanel?.dispose();
  }

  private async handleMessage(message: unknown): Promise<void> {
    if (!isWebviewToExtensionMessage(message)) {
      return;
    }

    switch (message.type) {
      case "ready":
        if (this.currentGraph) {
          this.postMessage({ type: "graphLoaded", graph: this.currentGraph });
        }
        return;
      case "refreshRequested":
        await this.analyzeWorkspace(true);
        return;
      case "openFile":
        await this.openFile(message.fileId, message.line);
        return;
      case "copyPath":
        await this.copyPath(message.fileId);
        return;
      case "savePreferences":
        await this.context.workspaceState.update("codebaseTown.preferences", message.preferences);
        return;
    }
  }

  private async analyzeWorkspace(isRefresh = false): Promise<void> {
    const workspaceFolder = await this.selectWorkspaceFolder();
    if (!workspaceFolder) {
      this.postMessage({ type: "analysisFailed", message: "Open a JavaScript or TypeScript workspace folder before launching Codebase Town." });
      return;
    }

    this.ensureWatcher(workspaceFolder);
    this.postMessage({ type: "analysisStarted" });

    try {
      const configuration = vscode.workspace.getConfiguration("codebaseTown", workspaceFolder.uri);
      const graph = await parseProject(workspaceFolder.uri.fsPath, {
        exclude: configuration.get<string[]>("exclude", []),
        maxFiles: configuration.get<number>("maxFiles", 1500),
        onProgress: (phase, completed, total) => this.postMessage({ type: "analysisProgress", phase, completed, total })
      });
      this.currentGraph = graph;
      this.postMessage({ type: isRefresh ? "graphUpdated" : "graphLoaded", graph });
    } catch (error) {
      this.postMessage({
        type: "analysisFailed",
        message: error instanceof Error ? error.message : "Unknown analysis failure."
      });
    }
  }

  private async selectWorkspaceFolder(): Promise<vscode.WorkspaceFolder | undefined> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return undefined;
    }
    if (folders.length === 1) {
      return folders[0];
    }

    const selected = await vscode.window.showQuickPick(
      folders.map((folder) => ({ label: folder.name, folder })),
      { title: "Select workspace folder to analyze" }
    );
    return selected?.folder;
  }

  private ensureWatcher(workspaceFolder: vscode.WorkspaceFolder): void {
    const autoRefresh = vscode.workspace.getConfiguration("codebaseTown", workspaceFolder.uri).get<boolean>("autoRefresh", true);
    if (!autoRefresh || this.watcher) {
      return;
    }

    const sourcePattern = new vscode.RelativePattern(workspaceFolder, "**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs,json}");
    this.watcher = vscode.workspace.createFileSystemWatcher(sourcePattern);
    const schedule = () => this.scheduleRefresh();
    this.disposables.push(
      this.watcher,
      this.watcher.onDidCreate(schedule),
      this.watcher.onDidChange(schedule),
      this.watcher.onDidDelete(schedule)
    );
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    this.refreshTimer = setTimeout(() => {
      void this.analyzeWorkspace(true);
    }, 600);
  }

  private async openFile(fileId: string, line?: number): Promise<void> {
    const file = this.currentGraph?.files.find((candidate) => candidate.id === fileId);
    if (!file?.absolutePath) {
      return;
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file.absolutePath));
    const editor = await vscode.window.showTextDocument(document, { preview: false });
    if (line && line > 0) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
    }
  }

  private async copyPath(fileId: string): Promise<void> {
    const file = this.currentGraph?.files.find((candidate) => candidate.id === fileId);
    if (file) {
      await vscode.env.clipboard.writeText(file.path);
    }
  }

  private postMessage(message: ExtensionToWebviewMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private getWebviewHtml(): string {
    const nonce = createNonce();
    const assetDirectory = path.join(this.context.extensionPath, "dist", "webview", "assets");
    const mapAssetDirectory = vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview", "codebase-town-assets");
    const scriptFile = findAsset(assetDirectory, ".js");
    const styleFile = findAsset(assetDirectory, ".css");
    const scriptUri = scriptFile
      ? this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(assetDirectory, scriptFile)))
      : undefined;
    const styleUri = styleFile
      ? this.panel.webview.asWebviewUri(vscode.Uri.file(path.join(assetDirectory, styleFile)))
      : undefined;
    const mapAssetBaseUri = this.panel.webview.asWebviewUri(mapAssetDirectory).toString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${this.panel.webview.cspSource} data:; style-src ${this.panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  ${styleUri ? `<link rel="stylesheet" href="${styleUri}">` : ""}
  <title>Codebase Town</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">window.__CODEBASE_TOWN_ASSET_BASE_URI__ = ${JSON.stringify(mapAssetBaseUri)};</script>
  ${scriptUri ? `<script nonce="${nonce}" type="module" src="${scriptUri}"></script>` : `<p>Webview bundle not found. Run npm run compile.</p>`}
</body>
</html>`;
  }

  private dispose(): void {
    CodebaseTownPanel.activePanel = undefined;
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }
}

function findAsset(assetDirectory: string, extension: string): string | undefined {
  if (!fs.existsSync(assetDirectory)) {
    return undefined;
  }
  return fs.readdirSync(assetDirectory).find((fileName) => fileName.endsWith(extension));
}

function createNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => possible[Math.floor(Math.random() * possible.length)]).join("");
}
