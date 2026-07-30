export type AgentActivityType = "read" | "edit";

export interface AgentActivityEvent {
  agentId: string;
  agentName: string;
  fileId: string;
  type: AgentActivityType;
  occurredAt: number;
}

export interface AgentActivityState {
  agentId: string;
  agentName: string;
  fileId: string;
  activeReadFileId?: string;
  activeEditFileId?: string;
  recentlyEditedFileIds: string[];
}

export const ENABLE_AGENT_ACTIVITY_DEMO = false;

export function applyAgentActivityEvent(
  current: AgentActivityState | undefined,
  event: AgentActivityEvent
): AgentActivityState {
  const recentlyEdited = new Set(current?.recentlyEditedFileIds ?? []);
  if (event.type === "edit") {
    recentlyEdited.add(event.fileId);
  }

  return {
    agentId: event.agentId,
    agentName: event.agentName,
    fileId: event.fileId,
    activeReadFileId: event.type === "read" ? event.fileId : undefined,
    activeEditFileId: event.type === "edit" ? event.fileId : undefined,
    recentlyEditedFileIds: [...recentlyEdited].sort()
  };
}
