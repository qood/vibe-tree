import type {
  ScanSnapshot,
  ChatMessage,
  Plan,
  AgentOutputData,
  PlanningSession,
  BranchLink,
  ExternalLink,
  TaskInstruction,
} from "./api";

// Discriminated union for WebSocket messages
// This provides type safety when handling different message types

// Scan messages
type ScanUpdatedMessage = { type: "scan.updated"; repoId: string; data: ScanSnapshot };

// Chat messages
type ChatStreamingStartMessage = {
  type: "chat.streaming.start";
  repoId: string;
  data: { sessionId: string; runId: number };
};
type ChatStreamingChunkMessage = {
  type: "chat.streaming.chunk";
  repoId: string;
  data: { sessionId: string; runId: number; chunk: ChatStreamingChunk };
};
type ChatStreamingEndMessage = {
  type: "chat.streaming.end";
  repoId: string;
  data: { sessionId: string; runId: number; success: boolean; error?: string };
};
type ChatMessageMessage = { type: "chat.message"; repoId: string; data: ChatMessage };

// Agent messages
type AgentStartedMessage = {
  type: "agent.started";
  repoId: string;
  data: { sessionId: string; pid: number };
};
type AgentOutputMessage = { type: "agent.output"; repoId: string; data: AgentOutputData };
type AgentFinishedMessage = {
  type: "agent.finished";
  repoId: string;
  data: { sessionId: string; exitCode: number };
};
type AgentStoppedMessage = { type: "agent.stopped"; repoId: string; data: { sessionId: string } };

// Plan messages
type PlanUpdatedMessage = { type: "plan.updated"; repoId: string; data: Plan };

// Planning session messages
type PlanningCreatedMessage = {
  type: "planning.created";
  repoId: string;
  planningSessionId: string;
  data: PlanningSession;
};
type PlanningUpdatedMessage = {
  type: "planning.updated";
  repoId: string;
  planningSessionId: string;
  data: PlanningSession;
};
type PlanningConfirmedMessage = {
  type: "planning.confirmed";
  repoId: string;
  planningSessionId: string;
  data: PlanningSession;
};
type PlanningDiscardedMessage = {
  type: "planning.discarded";
  repoId: string;
  planningSessionId: string;
  data: PlanningSession;
};
type BranchesChangedMessage = { type: "branches.changed"; repoId: string; data?: undefined };

// Branch link messages
type BranchLinkCreatedMessage = { type: "branchLink.created"; repoId: string; data: BranchLink };
type BranchLinkUpdatedMessage = { type: "branchLink.updated"; repoId: string; data: BranchLink };
type BranchLinkDeletedMessage = {
  type: "branchLink.deleted";
  repoId: string;
  data: { id: number; branchName: string };
};

// External link messages
type ExternalLinkCreatedMessage = {
  type: "external-link.created";
  planningSessionId: string;
  data: ExternalLink;
};
type ExternalLinkUpdatedMessage = {
  type: "external-link.updated";
  planningSessionId: string;
  data: ExternalLink;
};
type ExternalLinkDeletedMessage = {
  type: "external-link.deleted";
  planningSessionId: string;
  data: { id: number };
};

// Task instruction messages
type TaskInstructionUpdatedMessage = {
  type: "taskInstruction.updated";
  repoId: string;
  data: TaskInstruction;
};
type TaskInstructionCreatedMessage = {
  type: "taskInstruction.created";
  repoId: string;
  data: TaskInstruction;
};

// Project rules messages
type ProjectRulesUpdatedMessage = {
  type: "projectRules.updated";
  repoId: string;
  data: { ruleType: string };
};

// Instructions messages
type InstructionsLoggedMessage = {
  type: "instructions.logged";
  repoId: string;
  data: { id: number };
};

// Fallback for unknown message types
type UnknownMessage = { type: string; repoId?: string; planningSessionId?: string; data?: unknown };

// Union of all message types
export type WSMessage =
  | ScanUpdatedMessage
  | ChatStreamingStartMessage
  | ChatStreamingChunkMessage
  | ChatStreamingEndMessage
  | ChatMessageMessage
  | AgentStartedMessage
  | AgentOutputMessage
  | AgentFinishedMessage
  | AgentStoppedMessage
  | PlanUpdatedMessage
  | PlanningCreatedMessage
  | PlanningUpdatedMessage
  | PlanningConfirmedMessage
  | PlanningDiscardedMessage
  | BranchesChangedMessage
  | BranchLinkCreatedMessage
  | BranchLinkUpdatedMessage
  | BranchLinkDeletedMessage
  | ExternalLinkCreatedMessage
  | ExternalLinkUpdatedMessage
  | ExternalLinkDeletedMessage
  | TaskInstructionUpdatedMessage
  | TaskInstructionCreatedMessage
  | ProjectRulesUpdatedMessage
  | InstructionsLoggedMessage
  | UnknownMessage;

// Chat streaming chunk type
export interface ChatStreamingChunk {
  type: "thinking" | "text" | "tool_use" | "tool_result";
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

type MessageHandler = (message: WSMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private repoId: string | null = null;
  private reconnectTimeout: number | null = null;

  connect(repoId?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (repoId && repoId !== this.repoId) {
        this.subscribe(repoId);
      }
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    this.ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

    this.ws.onopen = () => {
      console.log("WebSocket connected");
      if (repoId) {
        this.subscribe(repoId);
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        this.emit(message.type, message);
      } catch (e) {
        console.error("Failed to parse WS message:", e);
      }
    };

    this.ws.onclose = () => {
      console.log("WebSocket disconnected");
      this.scheduleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect(this.repoId || undefined);
    }, 3000);
  }

  subscribe(repoId: string) {
    this.repoId = repoId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", repoId }));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  private emit(type: string, message: WSMessage) {
    this.handlers.get(type)?.forEach((handler) => handler(message));
    // Also emit to wildcard handlers
    this.handlers.get("*")?.forEach((handler) => handler(message));
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const wsClient = new WebSocketClient();
