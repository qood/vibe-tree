export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code?: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code?: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /**
   * Check if error is a specific HTTP status
   */
  isStatus(status: number): boolean {
    return this.statusCode === status;
  }

  /**
   * Check if error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.statusCode >= 400 && this.statusCode < 500;
  }

  /**
   * Check if error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }
}

// Repo from GitHub (fetched via gh CLI)
export interface Repo {
  id: string; // owner/name format
  name: string;
  fullName: string;
  url: string;
  description: string;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface BranchNamingRule {
  patterns: string[];
}

export interface WorktreeSettings {
  createScript?: string;
  postCreateScript?: string;
  postDeleteScript?: string;
  checkoutPreference?: "main" | "first" | "ask";
  worktreeCreateCommand?: string;
  worktreeDeleteCommand?: string;
}

export interface Plan {
  id: number;
  repoId: string;
  title: string;
  contentMd: string;
  status: "draft" | "committed";
  githubIssueUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Warning {
  severity: "warn" | "error";
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface PRInfo {
  number: number;
  title: string;
  state: string;
  url: string;
  branch: string;
  isDraft?: boolean;
  labels?: string[];
  assignees?: string[];
  reviewDecision?: string;
  checks?: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
}

export interface IssueInfo {
  number: number;
  title: string;
  state: string;
  url: string;
  labels?: string[];
  assignees?: string[];
  parentIssue?: number;
  childIssues?: number[];
}

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  dirty: boolean;
  isActive?: boolean;
  activeAgent?: string;
}

export interface TreeNode {
  branchName: string;
  badges: string[];
  pr?: PRInfo;
  issue?: IssueInfo;
  worktree?: WorktreeInfo;
  lastCommitAt: string;
  aheadBehind?: { ahead: number; behind: number };
  remoteAheadBehind?: { ahead: number; behind: number };
}

export interface TreeEdge {
  parent: string;
  child: string;
  confidence: "high" | "medium" | "low";
  isDesigned?: boolean;
}

export type TaskStatus = "todo" | "doing" | "done";
export type TreeSpecStatus = "draft" | "confirmed" | "generated";

export interface TreeSpecNode {
  id: string; // UUID for task identification
  title: string; // タスク名
  description?: string; // 完了条件/メモ
  status: TaskStatus;
  branchName?: string; // 未確定ならundefined
  worktreePath?: string; // Path to worktree (set after creation)
  chatSessionId?: string; // Linked chat session ID
  prUrl?: string; // PR URL (set after creation)
  prNumber?: number; // PR number (set after creation)
}

export interface TreeSpecEdge {
  parent: string; // node id
  child: string; // node id
}

export interface TreeSpec {
  id: number;
  repoId: string;
  baseBranch: string; // default branch (develop, main, master, etc.)
  status: TreeSpecStatus;
  specJson: {
    nodes: TreeSpecNode[];
    edges: TreeSpecEdge[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ScanSnapshot {
  repoId: string;
  defaultBranch: string; // detected default branch (develop, main, master, etc.)
  branches: string[]; // all branch names for UI selection
  nodes: TreeNode[];
  edges: TreeEdge[];
  warnings: Warning[];
  worktrees: WorktreeInfo[];
  rules: { branchNaming: BranchNamingRule | null };
  restart: {
    worktreePath: string;
    cdCommand: string;
    restartPromptMd: string;
  } | null;
  treeSpec?: TreeSpec;
}

export interface InstructionLog {
  id: number;
  repoId: string;
  planId: number | null;
  worktreePath: string | null;
  branchName: string | null;
  kind: "director_suggestion" | "user_instruction" | "system_note";
  contentMd: string;
  createdAt: string;
}

export interface RepoPin {
  id: number;
  repoId: string;
  localPath: string;
  label: string | null;
  baseBranch: string | null;
  lastUsedAt: string;
  createdAt: string;
}

export interface AgentStatus {
  pid: number;
  repoId: string;
  localPath: string;
  startedAt: string;
}

export interface AiStartResult {
  status: "started" | "already_running";
  sessionId: string;
  pid: number;
  repoId: string;
  startedAt: string;
  localPath: string;
  branch?: string | null;
}

export type AgentSessionStatus = "running" | "stopped" | "exited";

export interface AgentSession {
  id: string;
  repoId: string;
  worktreePath: string;
  branch: string | null;
  status: AgentSessionStatus;
  pid: number | null;
  startedAt: string;
  lastSeenAt: string;
  endedAt: string | null;
  exitCode: number | null;
}

export interface AgentOutputData {
  sessionId: string;
  stream: "stdout" | "stderr";
  data: string;
  timestamp: string;
}

// Chat types
export type ChatSessionStatus = "active" | "archived";

export interface ChatSession {
  id: string;
  repoId: string;
  worktreePath: string;
  branchName: string | null;
  planId: number | null;
  status: ChatSessionStatus;
  lastUsedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMode = "planning" | "execution";
export type InstructionEditStatus = "committed" | "rejected";

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  chatMode?: ChatMode | null;
  instructionEditStatus?: InstructionEditStatus | null;
  createdAt: string;
}

export interface ChatSummary {
  id: number;
  sessionId: string;
  summaryMarkdown: string;
  coveredUntilMessageId: number;
  createdAt: string;
}

// Terminal types
export type TerminalSessionStatus = "running" | "stopped";

export interface TerminalSession {
  id: string;
  repoId: string;
  worktreePath: string;
  pid: number | null;
  status: TerminalSessionStatus;
  lastOutput: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

// Requirements types
export type RequirementsNoteType = "prd" | "notion" | "memo" | "task_breakdown";

export interface RequirementsNote {
  id: number;
  repoId: string;
  planId: number | null;
  noteType: RequirementsNoteType;
  title: string | null;
  content: string;
  notionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// External Links types
export type ExternalLinkType = "notion" | "figma" | "github_issue" | "github_pr" | "url";

export interface ExternalLink {
  id: number;
  planningSessionId: string;
  linkType: ExternalLinkType;
  url: string;
  title: string | null;
  contentCache: string | null;
  lastFetchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Planning Session types
export type PlanningSessionStatus = "draft" | "confirmed" | "discarded";

export interface TaskNode {
  id: string;
  title: string;
  description?: string;
  branchName?: string;
  issueUrl?: string; // GitHub issue URL
}

export interface TaskEdge {
  parent: string;
  child: string;
}

export interface PlanningSession {
  id: string;
  repoId: string;
  title: string;
  baseBranch: string;
  status: PlanningSessionStatus;
  nodes: TaskNode[];
  edges: TaskEdge[];
  chatSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Task Instruction types
export interface TaskInstruction {
  id: number | null;
  repoId: string;
  taskId: string | null;
  branchName: string | null;
  instructionMd: string;
  abstractedRules?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Branch Link types
export type BranchLinkType = "issue" | "pr";

export interface GitHubCheck {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
}

export interface GitHubLabel {
  name: string;
  color: string;
}

export interface BranchLink {
  id: number;
  repoId: string;
  branchName: string;
  linkType: BranchLinkType;
  url: string;
  number: number | null;
  title: string | null;
  status: string | null;
  checksStatus: string | null;
  reviewDecision: string | null; // 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null
  checks: string | null; // JSON array of GitHubCheck
  labels: string | null; // JSON array
  reviewers: string | null; // JSON array
  projectStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

// API Performance Metrics
interface ApiMetrics {
  totalCalls: number;
  callsByEndpoint: Map<string, number>;
  callTimestamps: Array<{ endpoint: string; timestamp: number; duration?: number }>;
}

const apiMetrics: ApiMetrics = {
  totalCalls: 0,
  callsByEndpoint: new Map(),
  callTimestamps: [],
};

// Global flag to enable/disable metrics collection
let metricsEnabled = false;

export function enableApiMetrics() {
  metricsEnabled = true;
  apiMetrics.totalCalls = 0;
  apiMetrics.callsByEndpoint.clear();
  apiMetrics.callTimestamps = [];
  console.log("📊 API metrics collection enabled");
}

export function disableApiMetrics() {
  metricsEnabled = false;
}

export function getApiMetrics() {
  return {
    enabled: metricsEnabled,
    totalCalls: apiMetrics.totalCalls,
    callsByEndpoint: Object.fromEntries(apiMetrics.callsByEndpoint),
    recentCalls: apiMetrics.callTimestamps.slice(-20),
  };
}

export function logApiMetrics() {
  console.log("📊 API Performance Metrics:");
  console.log(`Total API calls: ${apiMetrics.totalCalls}`);
  console.log("Calls by endpoint:");
  Array.from(apiMetrics.callsByEndpoint.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([endpoint, count]) => {
      console.log(`  ${endpoint}: ${count} calls`);
    });
}

// Import all RPC functions
import {
  healthRpc,
  getReposRpc,
  getRepoRpc,
  getBranchNamingRpc,
  updateBranchNamingRpc,
  getWorktreeSettingsRpc,
  updateWorktreeSettingsRpc,
  getCurrentPlanRpc,
  startPlanRpc,
  updatePlanRpc,
  commitPlanRpc,
  scanRpc,
  fetchRpc,
  getRestartPromptRpc,
  getTreeSpecRpc,
  updateTreeSpecRpc,
  confirmTreeSpecRpc,
  unconfirmTreeSpecRpc,
  logInstructionRpc,
  getInstructionLogsRpc,
  getTaskInstructionRpc,
  updateTaskInstructionRpc,
  getRepoPinsRpc,
  createRepoPinRpc,
  useRepoPinRpc,
  deleteRepoPinRpc,
  updateRepoPinRpc,
  aiStartRpc,
  aiStopRpc,
  aiStatusRpc,
  aiSessionsRpc,
  createBranchRpc,
  createTreeRpc,
  createWorktreeRpc,
  checkoutRpc,
  pullRpc,
  checkBranchDeletableRpc,
  deleteBranchRpc,
  cleanupOrphanedBranchDataRpc,
  deleteWorktreeRpc,
  rebaseRpc,
  mergeParentRpc,
  pushRpc,
  getChatSessionsRpc,
  createChatSessionRpc,
  createChatPlanningSessionRpc,
  archiveChatSessionRpc,
  getChatMessagesRpc,
  checkChatRunningRpc,
  cancelChatRpc,
  sendChatMessageRpc,
  updateInstructionEditStatusRpc,
  summarizeChatRpc,
  purgeChatRpc,
  createTerminalSessionRpc,
  getTerminalSessionRpc,
  startTerminalSessionRpc,
  stopTerminalSessionRpc,
  getRequirementsRpc,
  createRequirementRpc,
  updateRequirementRpc,
  deleteRequirementRpc,
  parseTasksRpc,
  getExternalLinksRpc,
  addExternalLinkRpc,
  refreshExternalLinkRpc,
  updateExternalLinkRpc,
  deleteExternalLinkRpc,
  getPlanningSessionsRpc,
  getPlanningSessionRpc,
  createPlanningSessionRpc,
  updatePlanningSessionRpc,
  confirmPlanningSessionRpc,
  discardPlanningSessionRpc,
  deletePlanningSessionRpc,
  getBranchLinksRpc,
  createBranchLinkRpc,
  updateBranchLinkRpc,
  deleteBranchLinkRpc,
  refreshBranchLinkRpc,
  selectDirectoryRpc,
} from "./rpc";

export const api = {
  // Health
  health: healthRpc,

  // Repos
  getRepos: getReposRpc,
  getRepo: getRepoRpc,

  // Branch Naming
  getBranchNaming: getBranchNamingRpc,
  updateBranchNaming: updateBranchNamingRpc,

  // Worktree Settings
  getWorktreeSettings: getWorktreeSettingsRpc,
  updateWorktreeSettings: updateWorktreeSettingsRpc,

  // Plan
  getCurrentPlan: getCurrentPlanRpc,
  startPlan: startPlanRpc,
  updatePlan: updatePlanRpc,
  commitPlan: commitPlanRpc,

  // Scan
  scan: scanRpc,
  fetch: fetchRpc,
  getRestartPrompt: getRestartPromptRpc,

  // Tree Spec
  getTreeSpec: getTreeSpecRpc,
  updateTreeSpec: updateTreeSpecRpc,
  confirmTreeSpec: confirmTreeSpecRpc,
  unconfirmTreeSpec: unconfirmTreeSpecRpc,

  // Instructions
  logInstruction: logInstructionRpc,
  getInstructionLogs: getInstructionLogsRpc,
  getTaskInstruction: getTaskInstructionRpc,
  updateTaskInstruction: updateTaskInstructionRpc,

  // Repo Pins
  getRepoPins: getRepoPinsRpc,
  createRepoPin: createRepoPinRpc,
  useRepoPin: useRepoPinRpc,
  deleteRepoPin: deleteRepoPinRpc,
  updateRepoPin: updateRepoPinRpc,

  // AI Agent
  aiStart: aiStartRpc,
  aiStop: aiStopRpc,
  aiStatus: aiStatusRpc,
  aiSessions: aiSessionsRpc,

  // Branch
  createBranch: createBranchRpc,
  createTree: createTreeRpc,
  createWorktree: createWorktreeRpc,
  checkout: checkoutRpc,
  pull: pullRpc,
  checkBranchDeletable: checkBranchDeletableRpc,
  deleteBranch: deleteBranchRpc,
  cleanupOrphanedBranchData: cleanupOrphanedBranchDataRpc,
  deleteWorktree: deleteWorktreeRpc,
  rebase: rebaseRpc,
  mergeParent: mergeParentRpc,
  push: pushRpc,

  // Chat
  getChatSessions: getChatSessionsRpc,
  createChatSession: createChatSessionRpc,
  createChatPlanningSession: createChatPlanningSessionRpc,
  archiveChatSession: archiveChatSessionRpc,
  getChatMessages: getChatMessagesRpc,
  checkChatRunning: checkChatRunningRpc,
  cancelChat: cancelChatRpc,
  sendChatMessage: sendChatMessageRpc,
  updateInstructionEditStatus: updateInstructionEditStatusRpc,
  summarizeChat: summarizeChatRpc,
  purgeChat: purgeChatRpc,

  // Terminal
  createTerminalSession: createTerminalSessionRpc,
  getTerminalSession: getTerminalSessionRpc,
  startTerminalSession: startTerminalSessionRpc,
  stopTerminalSession: stopTerminalSessionRpc,

  // Requirements
  getRequirements: getRequirementsRpc,
  createRequirement: createRequirementRpc,
  updateRequirement: updateRequirementRpc,
  deleteRequirement: deleteRequirementRpc,
  parseTasks: parseTasksRpc,

  // External Links
  getExternalLinks: getExternalLinksRpc,
  addExternalLink: addExternalLinkRpc,
  refreshExternalLink: refreshExternalLinkRpc,
  updateExternalLink: updateExternalLinkRpc,
  deleteExternalLink: deleteExternalLinkRpc,

  // Planning Sessions
  getPlanningSessions: getPlanningSessionsRpc,
  getPlanningSession: getPlanningSessionRpc,
  createPlanningSession: createPlanningSessionRpc,
  updatePlanningSession: updatePlanningSessionRpc,
  confirmPlanningSession: confirmPlanningSessionRpc,
  discardPlanningSession: discardPlanningSessionRpc,
  deletePlanningSession: deletePlanningSessionRpc,

  // Branch Links
  getBranchLinks: getBranchLinksRpc,
  createBranchLink: createBranchLinkRpc,
  updateBranchLink: updateBranchLinkRpc,
  deleteBranchLink: deleteBranchLinkRpc,
  refreshBranchLink: refreshBranchLinkRpc,

  // System
  selectDirectory: selectDirectoryRpc,
};
