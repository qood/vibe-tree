/**
 * Branch Domain Types - ブランチ・ワークツリーのドメインモデル
 */

import type { RepoId, BranchName, WorktreePath, CommitHash, LocalPath } from "../common/branded";

// ============================================
// Worktree State (Discriminated Union)
// ============================================

/**
 * ワークツリーの状態
 * - active: アクティブ（エージェントが作業中）
 * - idle: 存在するが作業中ではない
 * - none: ワークツリーなし
 */
export type WorktreeState = ActiveWorktree | IdleWorktree | NoWorktree;

export interface ActiveWorktree {
  readonly type: "active";
  readonly path: WorktreePath;
  readonly agent: AgentType;
  readonly lastSeenAt: Date;
}

export interface IdleWorktree {
  readonly type: "idle";
  readonly path: WorktreePath;
}

export interface NoWorktree {
  readonly type: "none";
}

export type AgentType = "claude" | "cursor" | "other";

// ============================================
// Branch Info
// ============================================

export interface BranchInfo {
  readonly name: BranchName;
  readonly commit: CommitHash;
  readonly lastCommitAt: Date;
  readonly isDirty: boolean;
  readonly worktree: WorktreeState;
  readonly aheadBehind?: AheadBehind;
  readonly remoteAheadBehind?: AheadBehind;
}

export interface AheadBehind {
  readonly ahead: number;
  readonly behind: number;
}

// ============================================
// Branch Edge (親子関係)
// ============================================

export type EdgeConfidence = "high" | "medium" | "low";

export interface BranchEdge {
  readonly parent: BranchName;
  readonly child: BranchName;
  readonly confidence: EdgeConfidence;
  readonly isDesigned: boolean; // 設計ツリーからの関係かどうか
}

// ============================================
// Branch Tree (リポジトリ全体のブランチ構造)
// ============================================

export interface BranchTree {
  readonly repoId: RepoId;
  readonly defaultBranch: BranchName;
  readonly branches: ReadonlyMap<BranchName, BranchInfo>;
  readonly edges: readonly BranchEdge[];
}

// ============================================
// Warning System (Discriminated Union)
// ============================================

export type Warning =
  | BehindParentWarning
  | DirtyWarning
  | CIFailWarning
  | OrderBrokenWarning
  | NamingViolationWarning
  | TreeDivergenceWarning;

export interface BehindParentWarning {
  readonly type: "BEHIND_PARENT";
  readonly severity: "warn";
  readonly branch: BranchName;
  readonly parent: BranchName;
  readonly behind: number;
}

export interface DirtyWarning {
  readonly type: "DIRTY";
  readonly severity: "warn";
  readonly branch: BranchName;
}

export interface CIFailWarning {
  readonly type: "CI_FAIL";
  readonly severity: "error";
  readonly branch: BranchName;
  readonly checkName?: string;
}

export interface OrderBrokenWarning {
  readonly type: "ORDER_BROKEN";
  readonly severity: "warn";
  readonly message: string;
}

export interface NamingViolationWarning {
  readonly type: "BRANCH_NAMING_VIOLATION";
  readonly severity: "warn";
  readonly branch: BranchName;
  readonly expectedPattern: string;
}

export interface TreeDivergenceWarning {
  readonly type: "TREE_DIVERGENCE";
  readonly severity: "warn";
  readonly message: string;
}

// ============================================
// Type Guards for Warnings
// ============================================

export const isBehindParent = (w: Warning): w is BehindParentWarning => w.type === "BEHIND_PARENT";

export const isDirty = (w: Warning): w is DirtyWarning => w.type === "DIRTY";

export const isCIFail = (w: Warning): w is CIFailWarning => w.type === "CI_FAIL";

export const isErrorSeverity = (w: Warning): boolean => w.severity === "error";

// ============================================
// Repository Settings
// ============================================

export interface BranchNamingRule {
  readonly patterns: readonly string[];
}

export interface WorktreeSettings {
  readonly createScript?: string;
  readonly postCreateScript?: string;
  readonly postDeleteScript?: string;
  readonly checkoutPreference: "main" | "first" | "ask";
  readonly worktreeCreateCommand?: string;
  readonly worktreeDeleteCommand?: string;
}

export interface RepositorySettings {
  readonly repoId: RepoId;
  readonly localPath: LocalPath;
  readonly baseBranch: BranchName;
  readonly branchNaming?: BranchNamingRule;
  readonly worktree: WorktreeSettings;
}

// ============================================
// Worktree Helpers
// ============================================

export const hasWorktree = (state: WorktreeState): state is ActiveWorktree | IdleWorktree =>
  state.type !== "none";

export const isActiveWorktree = (state: WorktreeState): state is ActiveWorktree =>
  state.type === "active";

export const getWorktreePath = (state: WorktreeState): WorktreePath | undefined =>
  hasWorktree(state) ? state.path : undefined;
