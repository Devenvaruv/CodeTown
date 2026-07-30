import * as vscode from "vscode";
import { CodebaseTownPanel } from "./panel";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("codebaseTown.openMap", () => CodebaseTownPanel.createOrShow(context)),
    vscode.commands.registerCommand("codebaseTown.refreshMap", () => CodebaseTownPanel.refreshActive()),
    vscode.commands.registerCommand("codebaseTown.focusCurrentFile", () => CodebaseTownPanel.focusCurrentFile(context)),
    vscode.commands.registerCommand("codebaseTown.clearCache", () => {
      CodebaseTownPanel.clearCache();
      void vscode.window.showInformationMessage("Codebase Town cache cleared.");
    })
  );
}

export function deactivate(): void {
  CodebaseTownPanel.disposeActive();
}
