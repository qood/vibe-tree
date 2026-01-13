/**
 * GitHub Domain Types - GitHub連携のドメインモデル
 */

import type { RepoId, BranchName, PRNumber, IssueNumber } from "../common/branded";

// ============================================
// PR State (Discriminated Union)
// ============================================

export type PRState = OpenPR | MergedPR | ClosedPR;

export interface OpenPR {
  readonly state: "open";
  readonly isDraft: boolean;
  readonly reviewDecision: ReviewDecision;
  readonly checksStatus: ChecksStatus;
}

export interface MergedPR {
  readonly state: "merged";
  readonly mergedAt: Date;
  readonly mergedBy?: string;
}

export interface ClosedPR {
  readonly state: "closed";
  readonly closedAt: Date;
}

// ============================================
// Review & Checks
// ============================================

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | "NONE";

export type ChecksStatus = "SUCCESS" | "FAILURE" | "PENDING" | "NONE";

export interface CheckRun {
  readonly name: string;
  readonly status: "queued" | "in_progress" | "completed";
  readonly conclusion?: "success" | "failure" | "neutral" | "cancelled" | "skipped" | "timed_out";
}

// ============================================
// Pull Request
// ============================================

export interface PullRequest {
  readonly number: PRNumber;
  readonly title: string;
  readonly url: string;
  readonly branch: BranchName;
  readonly baseBranch: BranchName;
  readonly prState: PRState;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly reviewers: readonly string[];
  readonly checks: readonly CheckRun[];
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
}

// ============================================
// Issue State (Discriminated Union)
// ============================================

export type IssueState = OpenIssue | ClosedIssue;

export interface OpenIssue {
  readonly state: "open";
}

export interface ClosedIssue {
  readonly state: "closed";
  readonly closedAt: Date;
  readonly stateReason?: "completed" | "not_planned";
}

// ============================================
// Issue
// ============================================

export interface Issue {
  readonly number: IssueNumber;
  readonly title: string;
  readonly url: string;
  readonly issueState: IssueState;
  readonly labels: readonly string[];
  readonly assignees: readonly string[];
  readonly parentIssue?: IssueNumber;
  readonly childIssues: readonly IssueNumber[];
}

// ============================================
// Branch Link (ブランチとPR/Issueの関連)
// ============================================

export type BranchLink = PRLink | IssueLink;

export interface PRLink {
  readonly type: "pr";
  readonly repoId: RepoId;
  readonly branchName: BranchName;
  readonly pr: PullRequest;
}

export interface IssueLink {
  readonly type: "issue";
  readonly repoId: RepoId;
  readonly branchName: BranchName;
  readonly issue: Issue;
}

// ============================================
// Type Guards
// ============================================

export const isOpenPR = (state: PRState): state is OpenPR => state.state === "open";

export const isMergedPR = (state: PRState): state is MergedPR => state.state === "merged";

export const isClosedPR = (state: PRState): state is ClosedPR => state.state === "closed";

export const isOpenIssue = (state: IssueState): state is OpenIssue => state.state === "open";

export const isClosedIssue = (state: IssueState): state is ClosedIssue => state.state === "closed";

export const isPRLink = (link: BranchLink): link is PRLink => link.type === "pr";

export const isIssueLink = (link: BranchLink): link is IssueLink => link.type === "issue";

// ============================================
// Helpers
// ============================================

export const isPRApproved = (pr: PullRequest): boolean =>
  isOpenPR(pr.prState) && pr.prState.reviewDecision === "APPROVED";

export const isPRPassingChecks = (pr: PullRequest): boolean =>
  isOpenPR(pr.prState) && pr.prState.checksStatus === "SUCCESS";

export const isPRReadyToMerge = (pr: PullRequest): boolean =>
  isOpenPR(pr.prState) &&
  !pr.prState.isDraft &&
  pr.prState.reviewDecision === "APPROVED" &&
  pr.prState.checksStatus === "SUCCESS";
