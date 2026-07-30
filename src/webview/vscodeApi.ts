import type { WebviewToExtensionMessage } from "../shared/messageTypes";

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
}

declare const acquireVsCodeApi: (() => VsCodeApi) | undefined;

let api: VsCodeApi | undefined;

export function vscodeApi(): VsCodeApi {
  if (!api) {
    api = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : { postMessage: () => undefined };
  }
  return api;
}
