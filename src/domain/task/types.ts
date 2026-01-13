/**
 * Task Domain Types - タスク管理のドメインモデル
 *
 * Discriminated Unions を使って、タスクの状態ごとに
 * 異なるプロパティを型で強制する。
 */

import type {
  TaskId,
  BranchName,
  WorktreePath,
  ChatSessionId,
  PlanningSessionId,
} from "../common/branded";

// ============================================
// Task Status (Discriminated Union)
// ============================================

/**
 * タスクの状態を表す Discriminated Union
 *
 * 各状態で必要なプロパティが異なる:
 * - todo: 基本情報のみ
 * - doing: 作業中情報（ワークツリー、開始時刻）
 * - done: 完了情報（完了時刻）
 * - blocked: ブロック情報（理由、依存タスク）
 */
export type TaskStatus = TodoStatus | DoingStatus | DoneStatus | BlockedStatus;

export interface TodoStatus {
  readonly type: "todo";
}

export interface DoingStatus {
  readonly type: "doing";
  readonly startedAt: Date;
  readonly worktreePath?: WorktreePath;
}

export interface DoneStatus {
  readonly type: "done";
  readonly completedAt: Date;
  readonly worktreePath?: WorktreePath;
}

export interface BlockedStatus {
  readonly type: "blocked";
  readonly reason: string;
  readonly blockedBy?: TaskId[]; // 依存しているタスクID
}

// ============================================
// Task Node (プランニングツリーのノード)
// ============================================

/**
 * タスクノードの基本情報
 */
export interface TaskNodeBase {
  readonly id: TaskId;
  readonly title: string;
  readonly description?: string;
  readonly branchName?: BranchName;
  readonly chatSessionId?: ChatSessionId;
}

/**
 * タスクノード (状態付き)
 */
export type TaskNode = TaskNodeBase & {
  readonly status: TaskStatus;
};

// ============================================
// Task Node Constructors
// ============================================

export const createTodoTask = (base: TaskNodeBase): TaskNode => ({
  ...base,
  status: { type: "todo" },
});

export const createDoingTask = (
  base: TaskNodeBase,
  startedAt: Date,
  worktreePath?: WorktreePath,
): TaskNode => ({
  ...base,
  status: worktreePath ? { type: "doing", startedAt, worktreePath } : { type: "doing", startedAt },
});

export const createDoneTask = (
  base: TaskNodeBase,
  completedAt: Date,
  worktreePath?: WorktreePath,
): TaskNode => ({
  ...base,
  status: worktreePath
    ? { type: "done", completedAt, worktreePath }
    : { type: "done", completedAt },
});

export const createBlockedTask = (
  base: TaskNodeBase,
  reason: string,
  blockedBy?: TaskId[],
): TaskNode => ({
  ...base,
  status: blockedBy ? { type: "blocked", reason, blockedBy } : { type: "blocked", reason },
});

// ============================================
// Task Edge (タスク間の依存関係)
// ============================================

export interface TaskEdge {
  readonly parent: TaskId;
  readonly child: TaskId;
}

// ============================================
// Task Graph (DAG)
// ============================================

export interface TaskGraph {
  readonly nodes: ReadonlyMap<TaskId, TaskNode>;
  readonly edges: readonly TaskEdge[];
}

// ============================================
// Planning Session
// ============================================

export type PlanningSessionStatus = "draft" | "confirmed" | "discarded";

export interface PlanningSession {
  readonly id: PlanningSessionId;
  readonly title: string;
  readonly baseBranch: BranchName;
  readonly status: PlanningSessionStatus;
  readonly graph: TaskGraph;
  readonly chatSessionId?: ChatSessionId;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// ============================================
// Type Guards
// ============================================

export const isTodo = (status: TaskStatus): status is TodoStatus => status.type === "todo";

export const isDoing = (status: TaskStatus): status is DoingStatus => status.type === "doing";

export const isDone = (status: TaskStatus): status is DoneStatus => status.type === "done";

export const isBlocked = (status: TaskStatus): status is BlockedStatus => status.type === "blocked";

// ============================================
// Task Status Helpers
// ============================================

export const getStatusType = (status: TaskStatus): string => status.type;

export const isCompleted = (node: TaskNode): boolean => node.status.type === "done";

export const isInProgress = (node: TaskNode): boolean => node.status.type === "doing";

export const isPending = (node: TaskNode): boolean =>
  node.status.type === "todo" || node.status.type === "blocked";

// ============================================
// Task Transitions (状態遷移)
// ============================================

export type TaskTransitionError =
  | { type: "INVALID_TRANSITION"; from: string; to: string }
  | { type: "MISSING_WORKTREE"; message: string }
  | { type: "BLOCKED_DEPENDENCIES"; blockedBy: TaskId[] };

/**
 * 有効な状態遷移:
 * - todo → doing (作業開始)
 * - todo → blocked (ブロック発生)
 * - doing → done (作業完了)
 * - doing → blocked (ブロック発生)
 * - blocked → todo (ブロック解除)
 * - blocked → doing (ブロック解除して作業開始)
 */
export const canTransition = (from: TaskStatus["type"], to: TaskStatus["type"]): boolean => {
  const validTransitions: Record<string, string[]> = {
    todo: ["doing", "blocked"],
    doing: ["done", "blocked"],
    blocked: ["todo", "doing"],
    done: [], // done からは遷移不可
  };
  return validTransitions[from]?.includes(to) ?? false;
};
