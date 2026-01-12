/**
 * Domain Layer - 関数型ドメインモデリング
 *
 * このモジュールは以下のドメイン型を提供する:
 *
 * ## Common
 * - Branded Types: 型安全なプリミティブ型 (RepoId, BranchName, etc.)
 * - Result/Option: 関数型エラーハンドリング
 *
 * ## Task
 * - TaskNode: Discriminated Union でタスク状態を表現
 * - TaskGraph: タスクのDAG構造
 * - PlanningSession: プランニングセッション
 *
 * ## Branch
 * - BranchInfo: ブランチ情報
 * - WorktreeState: ワークツリー状態 (Discriminated Union)
 * - Warning: 警告システム
 *
 * ## GitHub
 * - PullRequest: PR状態 (Discriminated Union)
 * - Issue: Issue状態
 * - BranchLink: ブランチとPR/Issueの関連
 *
 * @example
 * import { RepoId, TaskNode, ok, err } from "@/domain";
 *
 * const repoId = RepoId("owner/repo");
 * const task: TaskNode = createTodoTask({ id: TaskId("..."), title: "..." });
 */

// Common utilities
export * from "./common";

// Domain types
export * from "./task";
export * from "./branch";
export * from "./github";
