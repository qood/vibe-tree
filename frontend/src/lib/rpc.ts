import { hc } from "hono/client";
import type { ApiType } from "../../../src/server/api";
import { ApiError } from "./api";
import type {
  BranchNamingRule,
  WorktreeSettings,
  Plan,
  ScanSnapshot,
  TreeSpec,
  TreeSpecNode,
  TreeSpecEdge,
  InstructionLog,
  RepoPin,
  AiStartResult,
  AgentSession,
  ChatSession,
  ChatMessage,
  ChatMode,
  InstructionEditStatus,
  ChatSummary,
  TerminalSession,
  RequirementsNote,
  RequirementsNoteType,
  ExternalLink,
  PlanningSession,
  TaskNode,
  TaskEdge,
  TaskInstruction,
  BranchLink,
  BranchLinkType,
} from "./api";

// Create RPC client with type inference from server
const client = hc<ApiType>("/api");

// Export typed RPC client
export const rpc = client;

// Helper to unwrap response and handle errors with ApiError
export async function unwrap<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = errorData as { error?: string; code?: string; details?: Record<string, unknown> };
    throw new ApiError(
      err.error || `HTTP error: ${response.status}`,
      response.status,
      err.code,
      err.details,
    );
  }
  return response.json() as Promise<T>;
}

// =============================================================================
// RPC-based API functions (compatible with existing api.ts interface)
// =============================================================================

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface RepoInfo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  isPrivate: boolean;
  defaultBranch: string;
}

// Health check via RPC
export async function healthRpc(): Promise<HealthResponse> {
  const res = await rpc.health.$get();
  return unwrap<HealthResponse>(res);
}

// =============================================================================
// Repos
// =============================================================================

export async function getReposRpc(): Promise<RepoInfo[]> {
  const res = await rpc.repos.$get();
  return unwrap<RepoInfo[]>(res);
}

export async function getRepoRpc(owner: string, name: string): Promise<RepoInfo> {
  // Dynamic route access requires type assertion for Hono RPC client
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.repos as any)[owner][name].$get();
  return unwrap<RepoInfo>(res);
}

// =============================================================================
// Project Rules - Branch Naming
// =============================================================================

export async function getBranchNamingRpc(
  repoId: string,
): Promise<BranchNamingRule & { id: number; repoId: string }> {
  const res = await rpc["project-rules"]["branch-naming"].$get({
    query: { repoId },
  });
  return unwrap<BranchNamingRule & { id: number; repoId: string }>(res);
}

export async function updateBranchNamingRpc(data: {
  repoId: string;
  patterns: string[];
}): Promise<BranchNamingRule> {
  const res = await rpc["project-rules"]["branch-naming"].$post({
    json: data,
  });
  return unwrap<BranchNamingRule>(res);
}

// =============================================================================
// Project Rules - Worktree Settings
// =============================================================================

export async function getWorktreeSettingsRpc(
  repoId: string,
): Promise<WorktreeSettings & { id: number | null; repoId: string }> {
  const res = await rpc["project-rules"].worktree.$get({
    query: { repoId },
  });
  return unwrap<WorktreeSettings & { id: number | null; repoId: string }>(res);
}

export async function updateWorktreeSettingsRpc(data: {
  repoId: string;
  createScript?: string;
  postCreateScript?: string;
  postDeleteScript?: string;
  checkoutPreference?: "main" | "first" | "ask";
  worktreeCreateCommand?: string;
  worktreeDeleteCommand?: string;
}): Promise<WorktreeSettings> {
  const res = await rpc["project-rules"].worktree.$post({
    json: data,
  });
  return unwrap<WorktreeSettings>(res);
}

// =============================================================================
// Plan
// =============================================================================

export async function getCurrentPlanRpc(repoId: string): Promise<Plan | null> {
  const res = await rpc.plan.current.$get({
    query: { repoId },
  });
  return unwrap<Plan | null>(res);
}

export async function startPlanRpc(repoId: string, title: string): Promise<Plan> {
  const res = await rpc.plan.start.$post({
    json: { repoId, title },
  });
  return unwrap<Plan>(res);
}

export async function updatePlanRpc(planId: number, contentMd: string): Promise<Plan> {
  const res = await rpc.plan.update.$post({
    json: { planId, contentMd },
  });
  return unwrap<Plan>(res);
}

export async function commitPlanRpc(planId: number, localPath: string): Promise<Plan> {
  const res = await rpc.plan.commit.$post({
    json: { planId, localPath },
  });
  return unwrap<Plan>(res);
}

// =============================================================================
// Scan
// =============================================================================

export async function scanRpc(localPath: string): Promise<ScanSnapshot> {
  const res = await rpc.scan.$post({
    json: { localPath },
  });
  return unwrap<ScanSnapshot>(res);
}

export async function fetchRpc(localPath: string): Promise<{
  success: boolean;
  branchStatus: Record<string, { ahead: number; behind: number }>;
}> {
  const res = await rpc.scan.fetch.$post({
    json: { localPath },
  });
  return unwrap<{
    success: boolean;
    branchStatus: Record<string, { ahead: number; behind: number }>;
  }>(res);
}

export async function getRestartPromptRpc(
  repoId: string,
  localPath: string,
  planId?: number,
  worktreePath?: string,
): Promise<{ cdCommand: string; restartPromptMd: string }> {
  const query: Record<string, string> = { repoId, localPath };
  if (planId) query.planId = String(planId);
  if (worktreePath) query.worktreePath = worktreePath;
  const res = await rpc.scan["restart-prompt"].$get({
    query,
  });
  return unwrap<{ cdCommand: string; restartPromptMd: string }>(res);
}

// =============================================================================
// Tree Spec
// =============================================================================

export async function getTreeSpecRpc(repoId: string): Promise<TreeSpec | null> {
  const res = await rpc["tree-spec"].$get({
    query: { repoId },
  });
  return unwrap<TreeSpec | null>(res);
}

export async function updateTreeSpecRpc(data: {
  repoId: string;
  baseBranch?: string;
  nodes: TreeSpecNode[];
  edges: TreeSpecEdge[];
}): Promise<TreeSpec> {
  const res = await rpc["tree-spec"].$post({
    json: data,
  });
  return unwrap<TreeSpec>(res);
}

export async function confirmTreeSpecRpc(repoId: string): Promise<TreeSpec> {
  const res = await rpc["tree-spec"].confirm.$post({
    json: { repoId },
  });
  return unwrap<TreeSpec>(res);
}

export async function unconfirmTreeSpecRpc(repoId: string): Promise<TreeSpec> {
  const res = await rpc["tree-spec"].unconfirm.$post({
    json: { repoId },
  });
  return unwrap<TreeSpec>(res);
}

// =============================================================================
// Instructions
// =============================================================================

export async function logInstructionRpc(data: {
  repoId: string;
  planId?: number;
  worktreePath?: string;
  branchName?: string;
  kind: "director_suggestion" | "user_instruction" | "system_note";
  contentMd: string;
}): Promise<InstructionLog> {
  const res = await rpc.instructions.log.$post({
    json: data,
  });
  return unwrap<InstructionLog>(res);
}

export async function getInstructionLogsRpc(repoId: string): Promise<InstructionLog[]> {
  const res = await rpc.instructions.logs.$get({
    query: { repoId },
  });
  return unwrap<InstructionLog[]>(res);
}

export async function getTaskInstructionRpc(
  repoId: string,
  branchName: string,
): Promise<TaskInstruction> {
  const res = await rpc.instructions.task.$get({
    query: { repoId, branchName },
  });
  return unwrap<TaskInstruction>(res);
}

export async function updateTaskInstructionRpc(
  repoId: string,
  branchName: string,
  instructionMd: string,
): Promise<TaskInstruction> {
  const res = await rpc.instructions.task.$patch({
    json: { repoId, branchName, instructionMd },
  });
  return unwrap<TaskInstruction>(res);
}

// =============================================================================
// Repo Pins
// =============================================================================

export async function getRepoPinsRpc(): Promise<RepoPin[]> {
  const res = await rpc["repo-pins"].$get();
  return unwrap<RepoPin[]>(res);
}

export async function createRepoPinRpc(localPath: string, label?: string): Promise<RepoPin> {
  const res = await rpc["repo-pins"].$post({
    json: { localPath, label },
  });
  return unwrap<RepoPin>(res);
}

export async function useRepoPinRpc(id: number): Promise<RepoPin> {
  const res = await rpc["repo-pins"].use.$post({
    json: { id },
  });
  return unwrap<RepoPin>(res);
}

export async function deleteRepoPinRpc(id: number): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["repo-pins"] as any)[`:id`].$delete({
    param: { id: String(id) },
  });
  return unwrap<{ success: boolean }>(res);
}

export async function updateRepoPinRpc(
  id: number,
  updates: { label?: string; baseBranch?: string | null },
): Promise<RepoPin> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["repo-pins"] as any)[`:id`].$patch({
    param: { id: String(id) },
    json: updates,
  });
  return unwrap<RepoPin>(res);
}

// =============================================================================
// AI Agent
// =============================================================================

export async function aiStartRpc(
  localPath: string,
  planId?: number,
  branch?: string,
): Promise<AiStartResult> {
  const res = await rpc.ai.start.$post({
    json: { localPath, planId, branch },
  });
  return unwrap<AiStartResult>(res);
}

export async function aiStopRpc(pid: number): Promise<{ status: string; pid: number }> {
  const res = await rpc.ai.stop.$post({
    json: { pid },
  });
  return unwrap<{ status: string; pid: number }>(res);
}

export async function aiStatusRpc(): Promise<{ agents: AgentSession[] }> {
  const res = await rpc.ai.status.$get();
  return unwrap<{ agents: AgentSession[] }>(res);
}

export async function aiSessionsRpc(repoId?: string): Promise<{ sessions: AgentSession[] }> {
  const res = await rpc.ai.sessions.$get({
    query: repoId ? { repoId } : {},
  });
  return unwrap<{ sessions: AgentSession[] }>(res);
}

// =============================================================================
// Branch
// =============================================================================

export async function createBranchRpc(
  localPath: string,
  branchName: string,
  baseBranch: string,
): Promise<{ success: boolean; branchName: string; baseBranch: string }> {
  const res = await rpc.branch.create.$post({
    json: { localPath, branchName, baseBranch },
  });
  return unwrap<{ success: boolean; branchName: string; baseBranch: string }>(res);
}

export async function createTreeRpc(
  repoId: string,
  localPath: string,
  tasks: Array<{
    id: string;
    branchName: string;
    parentBranch: string;
    worktreeName: string;
    title?: string;
    description?: string;
  }>,
  options?: { createPrs?: boolean; baseBranch?: string },
): Promise<{
  success: boolean;
  worktreesDir: string;
  results: Array<{
    taskId: string;
    branchName: string;
    worktreePath: string;
    chatSessionId: string;
    prUrl?: string;
    prNumber?: number;
    success: boolean;
    error?: string;
  }>;
  summary: { total: number; success: number; failed: number };
}> {
  const res = await rpc.branch["create-tree"].$post({
    json: {
      repoId,
      localPath,
      tasks,
      createPrs: options?.createPrs ?? false,
      baseBranch: options?.baseBranch,
    },
  });
  return unwrap(res);
}

export async function createWorktreeRpc(
  localPath: string,
  branchName: string,
): Promise<{ worktreePath: string; branchName: string }> {
  const res = await rpc.branch["create-worktree"].$post({
    json: { localPath, branchName },
  });
  return unwrap<{ worktreePath: string; branchName: string }>(res);
}

export async function checkoutRpc(
  localPath: string,
  branchName: string,
): Promise<{ success: boolean; branchName: string }> {
  const res = await rpc.branch.checkout.$post({
    json: { localPath, branchName },
  });
  return unwrap<{ success: boolean; branchName: string }>(res);
}

export async function pullRpc(
  localPath: string,
  branchName: string,
  worktreePath?: string,
): Promise<{ success: boolean; branchName: string; output: string }> {
  const res = await rpc.branch.pull.$post({
    json: { localPath, branchName, worktreePath },
  });
  return unwrap<{ success: boolean; branchName: string; output: string }>(res);
}

export async function checkBranchDeletableRpc(
  localPath: string,
  branchName: string,
  parentBranch?: string,
): Promise<{ deletable: boolean; reason: string | null }> {
  const res = await rpc.branch["check-deletable"].$post({
    json: { localPath, branchName, parentBranch },
  });
  return unwrap<{ deletable: boolean; reason: string | null }>(res);
}

export async function deleteBranchRpc(
  localPath: string,
  branchName: string,
  force?: boolean,
): Promise<{ success: boolean; branchName: string }> {
  const res = await rpc.branch.delete.$post({
    json: { localPath, branchName, force },
  });
  return unwrap<{ success: boolean; branchName: string }>(res);
}

export async function cleanupOrphanedBranchDataRpc(localPath: string): Promise<{
  success: boolean;
  cleaned: {
    chatSessions: number;
    chatMessages: number;
    taskInstructions: number;
    branchLinks: number;
    instructionsLog: number;
  };
  existingBranches: number;
}> {
  const res = await rpc.branch["cleanup-orphaned"].$post({
    json: { localPath },
  });
  return unwrap(res);
}

export async function deleteWorktreeRpc(
  localPath: string,
  worktreePath: string,
): Promise<{ success: boolean; worktreePath: string; branchName: string | null }> {
  const res = await rpc.branch["delete-worktree"].$post({
    json: { localPath, worktreePath },
  });
  return unwrap<{ success: boolean; worktreePath: string; branchName: string | null }>(res);
}

export async function rebaseRpc(
  localPath: string,
  branchName: string,
  parentBranch: string,
  worktreePath?: string,
): Promise<{ success: boolean; branchName: string; parentBranch: string; output: string }> {
  const res = await rpc.branch.rebase.$post({
    json: { localPath, branchName, parentBranch, worktreePath },
  });
  return unwrap<{ success: boolean; branchName: string; parentBranch: string; output: string }>(
    res,
  );
}

export async function mergeParentRpc(
  localPath: string,
  branchName: string,
  parentBranch: string,
  worktreePath?: string,
): Promise<{ success: boolean; branchName: string; parentBranch: string; output: string }> {
  const res = await rpc.branch["merge-parent"].$post({
    json: { localPath, branchName, parentBranch, worktreePath },
  });
  return unwrap<{ success: boolean; branchName: string; parentBranch: string; output: string }>(
    res,
  );
}

export async function pushRpc(
  localPath: string,
  branchName: string,
  worktreePath?: string,
  force?: boolean,
): Promise<{ success: boolean; branchName: string; output: string }> {
  const res = await rpc.branch.push.$post({
    json: { localPath, branchName, worktreePath, force },
  });
  return unwrap<{ success: boolean; branchName: string; output: string }>(res);
}

// =============================================================================
// Chat
// =============================================================================

export async function getChatSessionsRpc(repoId: string): Promise<ChatSession[]> {
  const res = await rpc.chat.sessions.$get({
    query: { repoId },
  });
  return unwrap<ChatSession[]>(res);
}

export async function createChatSessionRpc(
  repoId: string,
  worktreePath: string,
  branchName: string,
  planId?: number,
): Promise<ChatSession> {
  const res = await rpc.chat.sessions.$post({
    json: { repoId, worktreePath, branchName, planId },
  });
  return unwrap<ChatSession>(res);
}

export async function createChatPlanningSessionRpc(
  repoId: string,
  localPath: string,
): Promise<ChatSession> {
  const res = await rpc.chat.sessions.planning.$post({
    json: { repoId, localPath },
  });
  return unwrap<ChatSession>(res);
}

export async function archiveChatSessionRpc(sessionId: string): Promise<{ success: boolean }> {
  const res = await rpc.chat.sessions.archive.$post({
    json: { sessionId },
  });
  return unwrap<{ success: boolean }>(res);
}

export async function getChatMessagesRpc(sessionId: string): Promise<ChatMessage[]> {
  const res = await rpc.chat.messages.$get({
    query: { sessionId },
  });
  return unwrap<ChatMessage[]>(res);
}

export async function checkChatRunningRpc(sessionId: string): Promise<{ isRunning: boolean }> {
  const res = await rpc.chat.running.$get({
    query: { sessionId },
  });
  return unwrap<{ isRunning: boolean }>(res);
}

export async function cancelChatRpc(sessionId: string): Promise<{ success: boolean }> {
  const res = await rpc.chat.cancel.$post({
    json: { sessionId },
  });
  return unwrap<{ success: boolean }>(res);
}

export async function sendChatMessageRpc(
  sessionId: string,
  userMessage: string,
  context?: string,
  chatMode?: ChatMode,
): Promise<{ userMessage: ChatMessage; runId: number; status: string }> {
  const res = await rpc.chat.send.$post({
    json: { sessionId, userMessage, context, chatMode },
  });
  return unwrap<{ userMessage: ChatMessage; runId: number; status: string }>(res);
}

export async function updateInstructionEditStatusRpc(
  messageId: number,
  status: InstructionEditStatus,
): Promise<{ success: boolean; status: InstructionEditStatus }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.chat.messages as any)[`:id`]["instruction-status"].$patch({
    param: { id: String(messageId) },
    json: { status },
  });
  return unwrap<{ success: boolean; status: InstructionEditStatus }>(res);
}

export async function summarizeChatRpc(
  sessionId: string,
): Promise<ChatSummary | { message: string }> {
  const res = await rpc.chat.summarize.$post({
    json: { sessionId },
  });
  return unwrap<ChatSummary | { message: string }>(res);
}

export async function purgeChatRpc(
  sessionId: string,
  keepLastN?: number,
): Promise<{ deleted: number; remaining: number }> {
  const res = await rpc.chat.purge.$post({
    json: { sessionId, keepLastN: keepLastN ?? 50 },
  });
  return unwrap<{ deleted: number; remaining: number }>(res);
}

// =============================================================================
// Terminal
// =============================================================================

export async function createTerminalSessionRpc(
  repoId: string,
  worktreePath: string,
): Promise<TerminalSession> {
  const res = await rpc.term.sessions.$post({
    json: { repoId, worktreePath },
  });
  return unwrap<TerminalSession>(res);
}

export async function getTerminalSessionRpc(sessionId: string): Promise<TerminalSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.term.sessions as any)[`:id`].$get({
    param: { id: sessionId },
  });
  return unwrap<TerminalSession>(res);
}

export async function startTerminalSessionRpc(
  sessionId: string,
  cols?: number,
  rows?: number,
): Promise<{ id: string; status: string; pid: number; message?: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.term.sessions as any)[`:id`].start.$post({
    param: { id: sessionId },
    json: { cols, rows },
  });
  return unwrap<{ id: string; status: string; pid: number; message?: string }>(res);
}

export async function stopTerminalSessionRpc(
  sessionId: string,
): Promise<{ id: string; status: string }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.term.sessions as any)[`:id`].stop.$post({
    param: { id: sessionId },
    json: {},
  });
  return unwrap<{ id: string; status: string }>(res);
}

// =============================================================================
// Requirements
// =============================================================================

export async function getRequirementsRpc(repoId: string): Promise<RequirementsNote[]> {
  const res = await rpc.requirements.$get({
    query: { repoId },
  });
  return unwrap<RequirementsNote[]>(res);
}

export async function createRequirementRpc(data: {
  repoId: string;
  planId?: number;
  noteType: RequirementsNoteType;
  title?: string;
  content?: string;
  notionUrl?: string;
}): Promise<RequirementsNote> {
  const res = await rpc.requirements.$post({
    json: data,
  });
  return unwrap<RequirementsNote>(res);
}

export async function updateRequirementRpc(
  id: number,
  data: {
    noteType?: RequirementsNoteType;
    title?: string;
    content?: string;
    notionUrl?: string;
  },
): Promise<RequirementsNote> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.requirements as any)[`:id`].$put({
    param: { id: String(id) },
    json: data,
  });
  return unwrap<RequirementsNote>(res);
}

export async function deleteRequirementRpc(id: number): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc.requirements as any)[`:id`].$delete({
    param: { id: String(id) },
  });
  return unwrap<{ success: boolean }>(res);
}

export async function parseTasksRpc(
  content: string,
): Promise<{ tasks: { title: string; description?: string }[] }> {
  const res = await rpc.requirements["parse-tasks"].$post({
    json: { content },
  });
  return unwrap<{ tasks: { title: string; description?: string }[] }>(res);
}

// =============================================================================
// External Links
// =============================================================================

export async function getExternalLinksRpc(planningSessionId: string): Promise<ExternalLink[]> {
  const res = await rpc["external-links"].$get({
    query: { planningSessionId },
  });
  return unwrap<ExternalLink[]>(res);
}

export async function addExternalLinkRpc(
  planningSessionId: string,
  url: string,
  title?: string,
): Promise<ExternalLink> {
  const res = await rpc["external-links"].$post({
    json: { planningSessionId, url, title },
  });
  return unwrap<ExternalLink>(res);
}

export async function refreshExternalLinkRpc(id: number): Promise<ExternalLink> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["external-links"] as any)[`:id`].refresh.$post({
    param: { id: String(id) },
  });
  return unwrap<ExternalLink>(res);
}

export async function updateExternalLinkRpc(id: number, title: string): Promise<ExternalLink> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["external-links"] as any)[`:id`].$patch({
    param: { id: String(id) },
    json: { title },
  });
  return unwrap<ExternalLink>(res);
}

export async function deleteExternalLinkRpc(id: number): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["external-links"] as any)[`:id`].$delete({
    param: { id: String(id) },
  });
  return unwrap<{ success: boolean }>(res);
}

// =============================================================================
// Planning Sessions
// =============================================================================

export async function getPlanningSessionsRpc(repoId: string): Promise<PlanningSession[]> {
  const res = await rpc["planning-sessions"].$get({
    query: { repoId },
  });
  return unwrap<PlanningSession[]>(res);
}

export async function getPlanningSessionRpc(id: string): Promise<PlanningSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)[`:id`].$get({
    param: { id },
  });
  return unwrap<PlanningSession>(res);
}

export async function createPlanningSessionRpc(
  repoId: string,
  baseBranch: string,
  title?: string,
): Promise<PlanningSession> {
  const res = await rpc["planning-sessions"].$post({
    json: { repoId, baseBranch, title },
  });
  return unwrap<PlanningSession>(res);
}

export async function createPlanningSessionFromIssueRpc(
  repoId: string,
  issueInput: string,
  baseBranch: string,
): Promise<PlanningSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)["from-issue"].$post({
    json: { repoId, issueInput, baseBranch },
  });
  return unwrap<PlanningSession>(res);
}

export async function updatePlanningSessionRpc(
  id: string,
  data: {
    title?: string;
    baseBranch?: string;
    nodes?: TaskNode[];
    edges?: TaskEdge[];
  },
): Promise<PlanningSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)[`:id`].$patch({
    param: { id },
    json: data,
  });
  return unwrap<PlanningSession>(res);
}

export interface ConfirmPlanningSessionResult extends PlanningSession {
  worktreePath?: string;
  branchName?: string;
  branchResults?: Array<{
    taskId: string;
    branchName: string;
    parentBranch: string;
    success: boolean;
    error?: string;
  }>;
  summary?: {
    total: number;
    success: number;
    failed: number;
  };
}

export async function confirmPlanningSessionRpc(
  id: string,
  options?: { singleBranch?: boolean },
): Promise<ConfirmPlanningSessionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)[`:id`].confirm.$post({
    param: { id },
    json: options || {},
  });
  return unwrap<ConfirmPlanningSessionResult>(res);
}

export async function discardPlanningSessionRpc(id: string): Promise<PlanningSession> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)[`:id`].discard.$post({
    param: { id },
  });
  return unwrap<PlanningSession>(res);
}

export async function deletePlanningSessionRpc(id: string): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["planning-sessions"] as any)[`:id`].$delete({
    param: { id },
  });
  return unwrap<{ success: boolean }>(res);
}

// =============================================================================
// Branch Links
// =============================================================================

export async function getBranchLinksRpc(repoId: string, branchName: string): Promise<BranchLink[]> {
  const res = await rpc["branch-links"].$get({
    query: { repoId, branchName },
  });
  return unwrap<BranchLink[]>(res);
}

export async function createBranchLinkRpc(data: {
  repoId: string;
  branchName: string;
  linkType: BranchLinkType;
  url: string;
  number?: number;
  title?: string;
  status?: string;
}): Promise<BranchLink> {
  const res = await rpc["branch-links"].$post({
    json: data,
  });
  return unwrap<BranchLink>(res);
}

export async function updateBranchLinkRpc(
  id: number,
  data: { title?: string; status?: string },
): Promise<BranchLink> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["branch-links"] as any)[`:id`].$patch({
    param: { id: String(id) },
    json: data,
  });
  return unwrap<BranchLink>(res);
}

export async function deleteBranchLinkRpc(id: number): Promise<{ success: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["branch-links"] as any)[`:id`].$delete({
    param: { id: String(id) },
  });
  return unwrap<{ success: boolean }>(res);
}

export async function refreshBranchLinkRpc(id: number): Promise<BranchLink> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (rpc["branch-links"] as any)[`:id`].refresh.$post({
    param: { id: String(id) },
  });
  return unwrap<BranchLink>(res);
}

// =============================================================================
// System
// =============================================================================

export async function selectDirectoryRpc(): Promise<{ cancelled: boolean; path: string | null }> {
  const res = await rpc.system["select-directory"].$post();
  return unwrap<{ cancelled: boolean; path: string | null }>(res);
}
