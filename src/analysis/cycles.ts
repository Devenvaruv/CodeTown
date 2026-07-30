import type { ImportConnection } from "../shared/graphTypes";

export function findCircularConnectionIds(fileIds: string[], connections: ImportConnection[]): Set<string> {
  const graph = new Map<string, string[]>();
  for (const fileId of fileIds) {
    graph.set(fileId, []);
  }

  for (const connection of connections) {
    if (connection.targetFileId && connection.isResolved) {
      graph.get(connection.sourceFileId)?.push(connection.targetFileId);
    }
  }

  const components = findStronglyConnectedComponents(fileIds, graph);
  const circularFiles = new Set<string>();

  for (const component of components) {
    if (component.length > 1) {
      component.forEach((fileId) => circularFiles.add(fileId));
    }
  }

  const circularConnectionIds = new Set<string>();
  for (const connection of connections) {
    if (!connection.targetFileId) {
      continue;
    }
    const isSelfImport = connection.sourceFileId === connection.targetFileId;
    const isInsideCycle = circularFiles.has(connection.sourceFileId) && circularFiles.has(connection.targetFileId);
    if (isSelfImport || isInsideCycle) {
      circularConnectionIds.add(connection.id);
    }
  }

  return circularConnectionIds;
}

function findStronglyConnectedComponents(fileIds: string[], graph: Map<string, string[]>): string[][] {
  let nextIndex = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const components: string[][] = [];

  function visit(fileId: string): void {
    indexes.set(fileId, nextIndex);
    lowLinks.set(fileId, nextIndex);
    nextIndex += 1;
    stack.push(fileId);
    onStack.add(fileId);

    for (const targetId of graph.get(fileId) ?? []) {
      if (!indexes.has(targetId)) {
        visit(targetId);
        lowLinks.set(fileId, Math.min(lowLinks.get(fileId) ?? 0, lowLinks.get(targetId) ?? 0));
      } else if (onStack.has(targetId)) {
        lowLinks.set(fileId, Math.min(lowLinks.get(fileId) ?? 0, indexes.get(targetId) ?? 0));
      }
    }

    if (lowLinks.get(fileId) === indexes.get(fileId)) {
      const component: string[] = [];
      let current: string | undefined;
      do {
        current = stack.pop();
        if (current) {
          onStack.delete(current);
          component.push(current);
        }
      } while (current && current !== fileId);
      components.push(component);
    }
  }

  for (const fileId of fileIds) {
    if (!indexes.has(fileId)) {
      visit(fileId);
    }
  }

  return components;
}
