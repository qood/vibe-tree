/**
 * Branded Types - 型安全なプリミティブ型
 *
 * Branded Types を使うことで、同じ基底型（string, number）でも
 * 異なるドメイン概念を型レベルで区別できる。
 *
 * @example
 * const repoId = "owner/repo" as RepoId;
 * const branchName = "feature/foo" as BranchName;
 *
 * // コンパイルエラー: RepoId と BranchName は互換性がない
 * function doSomething(id: RepoId) { ... }
 * doSomething(branchName); // Error!
 */

// Brand symbol for nominal typing
declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

// ============================================
// Repository Domain
// ============================================

/** リポジトリID (owner/name 形式) */
export type RepoId = Brand<string, "RepoId">;

/** ローカルリポジトリパス */
export type LocalPath = Brand<string, "LocalPath">;

// ============================================
// Branch Domain
// ============================================

/** ブランチ名 */
export type BranchName = Brand<string, "BranchName">;

/** ワークツリーパス */
export type WorktreePath = Brand<string, "WorktreePath">;

/** Git コミットハッシュ */
export type CommitHash = Brand<string, "CommitHash">;

// ============================================
// Task/Planning Domain
// ============================================

/** タスクID (UUID) */
export type TaskId = Brand<string, "TaskId">;

/** プランニングセッションID (UUID) */
export type PlanningSessionId = Brand<string, "PlanningSessionId">;

/** チャットセッションID (UUID) */
export type ChatSessionId = Brand<string, "ChatSessionId">;

// ============================================
// GitHub Domain
// ============================================

/** GitHub Issue/PR 番号 */
export type IssueNumber = Brand<number, "IssueNumber">;

/** GitHub PR 番号 */
export type PRNumber = Brand<number, "PRNumber">;

// ============================================
// Database Domain
// ============================================

/** データベース自動生成ID */
export type DbId = Brand<number, "DbId">;

// ============================================
// Constructor Functions (型安全なファクトリ)
// ============================================

/**
 * 値をBranded Typeに変換するユーティリティ
 * 実行時のオーバーヘッドなし（型のみ）
 */
export const RepoId = (value: string): RepoId => value as RepoId;
export const LocalPath = (value: string): LocalPath => value as LocalPath;
export const BranchName = (value: string): BranchName => value as BranchName;
export const WorktreePath = (value: string): WorktreePath => value as WorktreePath;
export const CommitHash = (value: string): CommitHash => value as CommitHash;
export const TaskId = (value: string): TaskId => value as TaskId;
export const PlanningSessionId = (value: string): PlanningSessionId => value as PlanningSessionId;
export const ChatSessionId = (value: string): ChatSessionId => value as ChatSessionId;
export const IssueNumber = (value: number): IssueNumber => value as IssueNumber;
export const PRNumber = (value: number): PRNumber => value as PRNumber;
export const DbId = (value: number): DbId => value as DbId;

// ============================================
// Type Guards
// ============================================

/** RepoId の形式チェック (owner/name) */
export const isValidRepoId = (value: string): value is RepoId =>
  /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(value);

/** BranchName の形式チェック */
export const isValidBranchName = (value: string): value is BranchName =>
  value.length > 0 && !value.includes("..") && !value.startsWith("/");

/** UUID形式チェック */
export const isValidUUID = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** CommitHash の形式チェック (短縮/フル両対応) */
export const isValidCommitHash = (value: string): value is CommitHash =>
  /^[0-9a-f]{7,40}$/i.test(value);
