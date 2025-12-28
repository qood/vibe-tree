// Shared types between backend and frontend

export interface Repo {
  id: number;
  path: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BranchNamingRule {
  pattern: string;
  description: string;
  examples: string[];
}

export interface ProjectRule {
  id: number;
  repoId: number;
  ruleType: "branch_naming";
  ruleJson: BranchNamingRule;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PlanStatus = "draft" | "committed";

export interface Plan {
  id: number;
  repoId: number;
  title: string;
  contentMd: string;
  status: PlanStatus;
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlanTaskStatus = "todo" | "doing" | "done" | "blocked";

export interface PlanTask {
  id: number;
  planId: number;
  title: string;
  description: string;
  status: PlanTaskStatus;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export type InstructionKind =
  | "director_suggestion"
  | "user_instruction"
  | "system_note";

export interface InstructionLog {
  id: number;
  repoId: number;
  planId: number | null;
  worktreePath: string | null;
  branchName: string | null;
  kind: InstructionKind;
  contentMd: string;
  createdAt: string;
}

// Scan types
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  dirty: boolean;
}

export interface PRInfo {
  number: number;
  title: string;
  state: string;
  url: string;
  branch: string;
  checks?: string;
}

export type WarningSeverity = "warn" | "error";
export type WarningCode =
  | "BEHIND_PARENT"
  | "DIRTY"
  | "CI_FAIL"
  | "ORDER_BROKEN"
  | "BRANCH_NAMING_VIOLATION";

export interface Warning {
  severity: WarningSeverity;
  code: WarningCode;
  message: string;
  meta?: Record<string, unknown>;
}

export interface TreeNode {
  branchName: string;
  badges: string[];
  pr?: PRInfo;
  worktree?: WorktreeInfo;
  lastCommitAt: string;
  aheadBehind?: { ahead: number; behind: number };
}

export type EdgeConfidence = "high" | "medium" | "low";

export interface TreeEdge {
  parent: string;
  child: string;
  confidence: EdgeConfidence;
}

export interface RestartInfo {
  worktreePath: string;
  cdCommand: string;
  restartPromptMd: string;
}

export interface ScanSnapshot {
  nodes: TreeNode[];
  edges: TreeEdge[];
  warnings: Warning[];
  worktrees: WorktreeInfo[];
  rules: { branchNaming: BranchNamingRule | null };
  restart: RestartInfo | null;
}

// WebSocket message types
export type WSMessageType =
  | "projectRules.updated"
  | "plan.updated"
  | "scan.updated"
  | "instructions.logged";

export interface WSMessage<T = unknown> {
  type: WSMessageType;
  repoId?: number;
  data?: T;
}
