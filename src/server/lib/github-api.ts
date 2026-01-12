/**
 * GitHub GraphQL API client for fetching PR information
 */

import { execSync } from "child_process";
import type { PRInfo } from "../../shared/types";

// ============================================
// Single Issue/PR GraphQL queries for branch-links
// ============================================

const SINGLE_ISSUE_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number
      title
      state
      labels(first: 20) {
        nodes {
          name
        }
      }
    }
  }
}
`;

const SINGLE_PR_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      state
      reviewDecision
      labels(first: 20) {
        nodes {
          name
          color
        }
      }
      reviewRequests(first: 10) {
        nodes {
          requestedReviewer {
            ... on User {
              login
            }
            ... on Team {
              name
            }
          }
        }
      }
      reviews(first: 20) {
        nodes {
          author {
            login
          }
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 50) {
                nodes {
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    detailsUrl
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

// Types for single issue/PR responses
export interface BranchLinkIssueInfo {
  number: number;
  title: string;
  status: string;
  labels: string[];
  projectStatus?: string;
}

export interface BranchLinkPRCheck {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
}

export interface BranchLinkPRLabel {
  name: string;
  color: string;
}

export interface BranchLinkPRInfo {
  number: number;
  title: string;
  status: string;
  reviewDecision: string | null;
  checksStatus: string;
  checks: BranchLinkPRCheck[];
  labels: BranchLinkPRLabel[];
  reviewers: string[];
  projectStatus?: string;
}

interface SingleIssueResponse {
  data?: {
    repository?: {
      issue?: {
        number: number;
        title: string;
        state: string;
        labels: { nodes: Array<{ name: string }> };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface SinglePRResponse {
  data?: {
    repository?: {
      pullRequest?: {
        number: number;
        title: string;
        state: string;
        reviewDecision: string | null;
        labels: { nodes: Array<{ name: string; color: string }> };
        reviewRequests: {
          nodes: Array<{
            requestedReviewer: { login?: string; name?: string } | null;
          }>;
        };
        reviews: {
          nodes: Array<{ author: { login: string } | null }>;
        };
        commits: {
          nodes: Array<{
            commit: {
              statusCheckRollup: {
                contexts: {
                  nodes: Array<{
                    name?: string;
                    context?: string;
                    status?: string;
                    state?: string;
                    conclusion?: string;
                    detailsUrl?: string;
                    targetUrl?: string;
                  }>;
                };
              } | null;
            };
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetch single issue info using GraphQL API
 */
export async function fetchIssueGraphQL(
  repoId: string,
  issueNumber: number,
): Promise<BranchLinkIssueInfo | null> {
  const token = getGitHubToken();
  if (!token) {
    console.error("GitHub token not available");
    return null;
  }

  const parsed = parseRepoId(repoId);
  if (!parsed) {
    console.error("Invalid repoId format:", repoId);
    return null;
  }

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "vibe-tree",
      },
      body: JSON.stringify({
        query: SINGLE_ISSUE_QUERY,
        variables: {
          owner: parsed.owner,
          repo: parsed.repo,
          number: issueNumber,
        },
      }),
    });

    if (!response.ok) {
      console.error("GitHub API error:", response.status, response.statusText);
      return null;
    }

    const result = (await response.json()) as SingleIssueResponse;

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    const issue = result.data?.repository?.issue;
    if (!issue) {
      return null;
    }

    return {
      number: issue.number,
      title: issue.title,
      status: issue.state.toLowerCase(),
      labels: issue.labels.nodes.map((l) => l.name),
    };
  } catch (err) {
    console.error("fetchIssueGraphQL error:", err);
    return null;
  }
}

/**
 * Fetch single PR info using GraphQL API
 */
export async function fetchPRGraphQL(
  repoId: string,
  prNumber: number,
): Promise<BranchLinkPRInfo | null> {
  const token = getGitHubToken();
  if (!token) {
    console.error("GitHub token not available");
    return null;
  }

  const parsed = parseRepoId(repoId);
  if (!parsed) {
    console.error("Invalid repoId format:", repoId);
    return null;
  }

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "vibe-tree",
      },
      body: JSON.stringify({
        query: SINGLE_PR_QUERY,
        variables: {
          owner: parsed.owner,
          repo: parsed.repo,
          number: prNumber,
        },
      }),
    });

    if (!response.ok) {
      console.error("GitHub API error:", response.status, response.statusText);
      return null;
    }

    const result = (await response.json()) as SinglePRResponse;

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    const pr = result.data?.repository?.pullRequest;
    if (!pr) {
      return null;
    }

    // Extract checks from statusCheckRollup
    const checksMap = new Map<string, BranchLinkPRCheck>();
    let checksStatus = "pending";
    const statusRollup = pr.commits.nodes[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];

    for (const c of statusRollup) {
      const name = c.name || c.context || "Unknown";
      checksMap.set(name, {
        name,
        status: c.status || "COMPLETED",
        conclusion: c.conclusion || c.state || null,
        detailsUrl: c.detailsUrl || c.targetUrl || null,
      });
    }

    const checks = Array.from(checksMap.values());
    if (checks.length > 0) {
      const hasFailure = checks.some((c) => c.conclusion === "FAILURE" || c.conclusion === "ERROR");
      const allSuccess = checks.every(
        (c) => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED",
      );
      if (hasFailure) checksStatus = "failure";
      else if (allSuccess) checksStatus = "success";
    }

    // Extract reviewers
    const reviewers: string[] = [];
    for (const r of pr.reviewRequests.nodes) {
      if (r.requestedReviewer?.login) {
        reviewers.push(r.requestedReviewer.login);
      } else if (r.requestedReviewer?.name) {
        reviewers.push(r.requestedReviewer.name);
      }
    }
    for (const r of pr.reviews.nodes) {
      if (r.author?.login && !reviewers.includes(r.author.login)) {
        reviewers.push(r.author.login);
      }
    }

    return {
      number: pr.number,
      title: pr.title,
      status: pr.state.toLowerCase(),
      reviewDecision: pr.reviewDecision,
      checksStatus,
      checks,
      labels: pr.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
      reviewers,
    };
  } catch (err) {
    console.error("fetchPRGraphQL error:", err);
    return null;
  }
}

// GraphQL query for fetching PRs
const PR_QUERY = `
query($owner: String!, $repo: String!, $first: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: $first, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        state
        url
        headRefName
        isDraft
        additions
        deletions
        changedFiles
        reviewDecision
        labels(first: 10) {
          nodes {
            name
          }
        }
        assignees(first: 10) {
          nodes {
            login
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
              }
            }
          }
        }
      }
    }
  }
}
`;

interface GitHubGraphQLResponse {
  data?: {
    repository?: {
      pullRequests?: {
        nodes: Array<{
          number: number;
          title: string;
          state: "OPEN" | "CLOSED" | "MERGED";
          url: string;
          headRefName: string;
          isDraft: boolean;
          additions: number;
          deletions: number;
          changedFiles: number;
          reviewDecision: string | null;
          labels: {
            nodes: Array<{ name: string }>;
          };
          assignees: {
            nodes: Array<{ login: string }>;
          };
          commits: {
            nodes: Array<{
              commit: {
                statusCheckRollup: {
                  state: string;
                } | null;
              };
            }>;
          };
        }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

// Cache for GitHub token
// TTL is set to 5 minutes as a balance between:
// - Reducing process spawn overhead (gh auth token)
// - Picking up token changes if user re-authenticates with gh auth login
let cachedToken: { value: string | null; timestamp: number } | null = null;
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

/**
 * Get GitHub auth token from gh CLI (cached)
 */
export function getGitHubToken(): string | null {
  const now = Date.now();

  if (cachedToken && now - cachedToken.timestamp < TOKEN_CACHE_TTL) {
    return cachedToken.value;
  }

  try {
    const token = execSync("gh auth token", { encoding: "utf-8" }).trim();
    cachedToken = { value: token, timestamp: now };
    return token;
  } catch {
    cachedToken = { value: null, timestamp: now };
    return null;
  }
}

/**
 * Parse owner and repo from repoId (e.g., "owner/repo")
 */
export function parseRepoId(repoId: string): { owner: string; repo: string } | null {
  const parts = repoId.split("/");
  if (parts.length !== 2) return null;
  return { owner: parts[0]!, repo: parts[1]! };
}

/**
 * Fetch PRs using GitHub GraphQL API
 */
export async function fetchPRsGraphQL(repoId: string): Promise<PRInfo[]> {
  const token = getGitHubToken();
  if (!token) {
    console.error("GitHub token not available");
    return [];
  }

  const parsed = parseRepoId(repoId);
  if (!parsed) {
    console.error("Invalid repoId format:", repoId);
    return [];
  }

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "vibe-tree",
      },
      body: JSON.stringify({
        query: PR_QUERY,
        variables: {
          owner: parsed.owner,
          repo: parsed.repo,
          first: 50,
        },
      }),
    });

    if (!response.ok) {
      console.error("GitHub API error:", response.status, response.statusText);
      return [];
    }

    const result = (await response.json()) as GitHubGraphQLResponse;

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return [];
    }

    const prs = result.data?.repository?.pullRequests?.nodes ?? [];

    return prs.map((pr) => {
      const prInfo: PRInfo = {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        url: pr.url,
        branch: pr.headRefName,
        isDraft: pr.isDraft,
        labels: pr.labels.nodes.map((l) => l.name),
        assignees: pr.assignees.nodes.map((a) => a.login),
        reviewDecision: pr.reviewDecision ?? "",
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
      };

      // Map status check rollup state to checks field
      const statusState = pr.commits.nodes[0]?.commit?.statusCheckRollup?.state;
      if (statusState) {
        // GraphQL returns SUCCESS, FAILURE, PENDING, etc.
        prInfo.checks = statusState;
      }

      return prInfo;
    });
  } catch (err) {
    console.error("fetchPRsGraphQL error:", err);
    return [];
  }
}

// ============================================
// Additional GraphQL queries and mutations
// ============================================

// Repository list query (for gh repo list equivalent)
const REPOS_LIST_QUERY = `
query($first: Int!, $affiliations: [RepositoryAffiliation!]) {
  viewer {
    repositories(first: $first, affiliations: $affiliations, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        name
        nameWithOwner
        url
        description
        isPrivate
        defaultBranchRef {
          name
        }
      }
    }
  }
}
`;

// Single repository query
const REPO_VIEW_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    name
    nameWithOwner
    url
    description
    isPrivate
    defaultBranchRef {
      name
    }
  }
}
`;

// Repository info query (for nameWithOwner and defaultBranch)
const REPO_INFO_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    nameWithOwner
    defaultBranchRef {
      name
    }
  }
}
`;

// Issue detail query (with body)
const ISSUE_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      number
      title
      body
      state
      author {
        login
      }
    }
  }
}
`;

// PR detail query (with body, checks, reviews)
const PR_DETAIL_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      number
      title
      body
      state
      url
      author {
        login
      }
      labels(first: 20) {
        nodes {
          name
          color
        }
      }
      reviewRequests(first: 10) {
        nodes {
          requestedReviewer {
            ... on User {
              login
            }
            ... on Team {
              name
            }
          }
        }
      }
      reviews(first: 20) {
        nodes {
          author {
            login
          }
        }
      }
      projectItems(first: 5) {
        nodes {
          fieldValueByName(name: "Status") {
            ... on ProjectV2ItemFieldSingleSelectValue {
              name
            }
          }
        }
      }
      commits(last: 1) {
        nodes {
          commit {
            statusCheckRollup {
              contexts(first: 50) {
                nodes {
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    detailsUrl
                  }
                  ... on StatusContext {
                    context
                    state
                    targetUrl
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

// PR by branch query
const PR_BY_BRANCH_QUERY = `
query($owner: String!, $repo: String!, $headRefName: String!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: 1, headRefName: $headRefName, states: [OPEN, MERGED, CLOSED]) {
      nodes {
        number
        url
      }
    }
  }
}
`;

// Tracked issues query
const TRACKED_ISSUES_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      trackedIssues(first: 50) {
        nodes {
          number
          title
          state
          body
        }
      }
    }
  }
}
`;

// Issues tracking this query (reverse lookup)
const ISSUES_TRACKING_THIS_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    issues(first: 50, states: OPEN) {
      nodes {
        number
        title
        state
        body
        trackedInIssues(first: 10) {
          nodes {
            number
          }
        }
      }
    }
  }
}
`;

// Issue create mutation
const CREATE_ISSUE_MUTATION = `
mutation($repositoryId: ID!, $title: String!, $body: String!) {
  createIssue(input: {repositoryId: $repositoryId, title: $title, body: $body}) {
    issue {
      number
      url
    }
  }
}
`;

// Get repository ID query (for mutations)
const REPO_ID_QUERY = `
query($owner: String!, $repo: String!) {
  repository(owner: $owner, name: $repo) {
    id
  }
}
`;

// PR create mutation
const CREATE_PR_MUTATION = `
mutation($repositoryId: ID!, $baseRefName: String!, $headRefName: String!, $title: String!, $body: String!) {
  createPullRequest(input: {repositoryId: $repositoryId, baseRefName: $baseRefName, headRefName: $headRefName, title: $title, body: $body}) {
    pullRequest {
      number
      url
    }
  }
}
`;

// ============================================
// Response types
// ============================================

export interface RepoInfo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  description: string;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface IssueDetail {
  number: number;
  title: string;
  body: string;
  state: string;
  author: string;
}

export interface PRCheck {
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
}

export interface PRLabel {
  name: string;
  color: string;
}

export interface PRDetail {
  number: number;
  title: string;
  body: string;
  state: string;
  url: string;
  author: string;
  checksStatus: string;
  checks: PRCheck[];
  labels: PRLabel[];
  reviewers: string[];
  projectStatus?: string;
}

export interface TrackedIssue {
  number: number;
  title: string;
  state: string;
  body: string;
}

// ============================================
// GraphQL helper functions
// ============================================

/**
 * Execute a GraphQL query/mutation
 */
async function executeGraphQL<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T | null> {
  const token = getGitHubToken();
  if (!token) {
    console.error("GitHub token not available");
    return null;
  }

  try {
    const response = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "vibe-tree",
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      console.error("GitHub API error:", response.status, response.statusText);
      return null;
    }

    const result = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (result.errors) {
      console.error("GraphQL errors:", result.errors);
      return null;
    }

    return result.data ?? null;
  } catch (err) {
    console.error("GraphQL execution error:", err);
    return null;
  }
}

/**
 * Fetch repository list (equivalent to gh repo list)
 */
export async function fetchReposListGraphQL(limit: number = 30): Promise<RepoInfo[]> {
  interface Response {
    viewer: {
      repositories: {
        nodes: Array<{
          name: string;
          nameWithOwner: string;
          url: string;
          description: string | null;
          isPrivate: boolean;
          defaultBranchRef: { name: string } | null;
        }>;
      };
    };
  }

  const data = await executeGraphQL<Response>(REPOS_LIST_QUERY, {
    first: limit,
    affiliations: ["OWNER", "COLLABORATOR", "ORGANIZATION_MEMBER"],
  });

  if (!data) return [];

  return data.viewer.repositories.nodes.map((r) => ({
    id: r.nameWithOwner,
    name: r.name,
    fullName: r.nameWithOwner,
    url: r.url,
    description: r.description ?? "",
    isPrivate: r.isPrivate,
    defaultBranch: r.defaultBranchRef?.name ?? "main",
  }));
}

/**
 * Fetch single repository info (equivalent to gh repo view)
 */
export async function fetchRepoViewGraphQL(repoId: string): Promise<RepoInfo | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      name: string;
      nameWithOwner: string;
      url: string;
      description: string | null;
      isPrivate: boolean;
      defaultBranchRef: { name: string } | null;
    } | null;
  }

  const data = await executeGraphQL<Response>(REPO_VIEW_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
  });

  if (!data?.repository) return null;

  const r = data.repository;
  return {
    id: r.nameWithOwner,
    name: r.name,
    fullName: r.nameWithOwner,
    url: r.url,
    description: r.description ?? "",
    isPrivate: r.isPrivate,
    defaultBranch: r.defaultBranchRef?.name ?? "main",
  };
}

/**
 * Fetch repository nameWithOwner (for getRepoId)
 */
export async function fetchRepoNameWithOwnerGraphQL(
  owner: string,
  repo: string,
): Promise<string | null> {
  interface Response {
    repository: {
      nameWithOwner: string;
    } | null;
  }

  const data = await executeGraphQL<Response>(REPO_INFO_QUERY, { owner, repo });
  return data?.repository?.nameWithOwner ?? null;
}

/**
 * Fetch default branch name
 */
export async function fetchDefaultBranchGraphQL(repoId: string): Promise<string | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      defaultBranchRef: { name: string } | null;
    } | null;
  }

  const data = await executeGraphQL<Response>(REPO_INFO_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
  });

  return data?.repository?.defaultBranchRef?.name ?? null;
}

/**
 * Fetch issue detail (equivalent to gh issue view)
 */
export async function fetchIssueDetailGraphQL(
  repoId: string,
  issueNumber: number,
): Promise<IssueDetail | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      issue: {
        number: number;
        title: string;
        body: string;
        state: string;
        author: { login: string } | null;
      } | null;
    } | null;
  }

  const data = await executeGraphQL<Response>(ISSUE_DETAIL_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    number: issueNumber,
  });

  const issue = data?.repository?.issue;
  if (!issue) return null;

  return {
    number: issue.number,
    title: issue.title,
    body: issue.body ?? "",
    state: issue.state.toLowerCase(),
    author: issue.author?.login ?? "unknown",
  };
}

/**
 * Fetch PR detail (equivalent to gh pr view)
 */
export async function fetchPRDetailGraphQL(
  repoId: string,
  prNumber: number,
): Promise<PRDetail | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      pullRequest: {
        number: number;
        title: string;
        body: string;
        state: string;
        url: string;
        author: { login: string } | null;
        labels: { nodes: Array<{ name: string; color: string }> };
        reviewRequests: {
          nodes: Array<{
            requestedReviewer: { login?: string; name?: string } | null;
          }>;
        };
        reviews: {
          nodes: Array<{ author: { login: string } | null }>;
        };
        projectItems: {
          nodes: Array<{
            fieldValueByName: { name: string } | null;
          }>;
        };
        commits: {
          nodes: Array<{
            commit: {
              statusCheckRollup: {
                contexts: {
                  nodes: Array<{
                    name?: string;
                    context?: string;
                    status?: string;
                    state?: string;
                    conclusion?: string;
                    detailsUrl?: string;
                    targetUrl?: string;
                  }>;
                };
              } | null;
            };
          }>;
        };
      } | null;
    } | null;
  }

  const data = await executeGraphQL<Response>(PR_DETAIL_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    number: prNumber,
  });

  const pr = data?.repository?.pullRequest;
  if (!pr) return null;

  // Extract checks
  const checksMap = new Map<string, PRCheck>();
  let checksStatus = "pending";
  const statusRollup = pr.commits.nodes[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];

  for (const c of statusRollup) {
    const name = c.name || c.context || "Unknown";
    checksMap.set(name, {
      name,
      status: c.status || "COMPLETED",
      conclusion: c.conclusion || c.state || null,
      detailsUrl: c.detailsUrl || c.targetUrl || null,
    });
  }

  const checks = Array.from(checksMap.values());
  if (checks.length > 0) {
    const hasFailure = checks.some((c) => c.conclusion === "FAILURE" || c.conclusion === "ERROR");
    const allSuccess = checks.every(
      (c) => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED",
    );
    if (hasFailure) checksStatus = "failure";
    else if (allSuccess) checksStatus = "success";
  }

  // Extract reviewers
  const reviewers: string[] = [];
  for (const r of pr.reviewRequests.nodes) {
    if (r.requestedReviewer?.login) {
      reviewers.push(r.requestedReviewer.login);
    } else if (r.requestedReviewer?.name) {
      reviewers.push(r.requestedReviewer.name);
    }
  }
  for (const r of pr.reviews.nodes) {
    if (r.author?.login && !reviewers.includes(r.author.login)) {
      reviewers.push(r.author.login);
    }
  }

  // Extract project status
  let projectStatus: string | undefined;
  const projectItem = pr.projectItems.nodes[0];
  if (projectItem?.fieldValueByName?.name) {
    projectStatus = projectItem.fieldValueByName.name;
  }

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body ?? "",
    state: pr.state.toLowerCase(),
    url: pr.url,
    author: pr.author?.login ?? "unknown",
    checksStatus,
    checks,
    labels: pr.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
    reviewers,
    ...(projectStatus !== undefined && { projectStatus }),
  };
}

/**
 * Get PR by branch name
 */
export async function getPRByBranchGraphQL(
  repoId: string,
  branchName: string,
): Promise<{ number: number; url: string } | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      pullRequests: {
        nodes: Array<{
          number: number;
          url: string;
        }>;
      };
    } | null;
  }

  const data = await executeGraphQL<Response>(PR_BY_BRANCH_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    headRefName: branchName,
  });

  const pr = data?.repository?.pullRequests.nodes[0];
  return pr ?? null;
}

/**
 * Fetch tracked issues (sub-issues)
 */
export async function fetchTrackedIssuesGraphQL(
  repoId: string,
  issueNumber: number,
): Promise<TrackedIssue[]> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return [];

  interface Response {
    repository: {
      issue: {
        trackedIssues: {
          nodes: Array<{
            number: number;
            title: string;
            state: string;
            body: string;
          }>;
        };
      } | null;
    } | null;
  }

  const data = await executeGraphQL<Response>(TRACKED_ISSUES_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
    number: issueNumber,
  });

  return (
    data?.repository?.issue?.trackedIssues?.nodes?.map((n) => ({
      number: n.number,
      title: n.title ?? "",
      state: n.state ?? "OPEN",
      body: n.body ?? "",
    })) ?? []
  );
}

/**
 * Fetch issues that are tracking the given issue (reverse lookup)
 */
export async function fetchIssuesTrackingThisGraphQL(
  repoId: string,
  parentIssueNumber: number,
): Promise<TrackedIssue[]> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return [];

  interface Response {
    repository: {
      issues: {
        nodes: Array<{
          number: number;
          title: string;
          state: string;
          body: string;
          trackedInIssues: {
            nodes: Array<{ number: number }>;
          };
        }>;
      };
    } | null;
  }

  const data = await executeGraphQL<Response>(ISSUES_TRACKING_THIS_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
  });

  if (!data?.repository?.issues?.nodes) return [];

  return data.repository.issues.nodes
    .filter((issue) => {
      if (issue.number === parentIssueNumber) return false;
      return issue.trackedInIssues?.nodes?.some((t) => t.number === parentIssueNumber);
    })
    .map((n) => ({
      number: n.number,
      title: n.title ?? "",
      state: n.state ?? "OPEN",
      body: n.body ?? "",
    }));
}

/**
 * Get repository node ID (needed for mutations)
 */
async function getRepositoryNodeId(repoId: string): Promise<string | null> {
  const parsed = parseRepoId(repoId);
  if (!parsed) return null;

  interface Response {
    repository: {
      id: string;
    } | null;
  }

  const data = await executeGraphQL<Response>(REPO_ID_QUERY, {
    owner: parsed.owner,
    repo: parsed.repo,
  });

  return data?.repository?.id ?? null;
}

/**
 * Create a GitHub issue
 */
export async function createIssueGraphQL(
  repoId: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string } | null> {
  const repositoryId = await getRepositoryNodeId(repoId);
  if (!repositoryId) {
    console.error("Failed to get repository ID");
    return null;
  }

  interface Response {
    createIssue: {
      issue: {
        number: number;
        url: string;
      };
    };
  }

  const data = await executeGraphQL<Response>(CREATE_ISSUE_MUTATION, {
    repositoryId,
    title,
    body,
  });

  return data?.createIssue?.issue ?? null;
}

/**
 * Create a GitHub pull request
 */
export async function createPRGraphQL(
  repoId: string,
  baseBranch: string,
  headBranch: string,
  title: string,
  body: string,
): Promise<{ number: number; url: string } | null> {
  const repositoryId = await getRepositoryNodeId(repoId);
  if (!repositoryId) {
    console.error("Failed to get repository ID");
    return null;
  }

  interface Response {
    createPullRequest: {
      pullRequest: {
        number: number;
        url: string;
      };
    };
  }

  const data = await executeGraphQL<Response>(CREATE_PR_MUTATION, {
    repositoryId,
    baseRefName: baseBranch,
    headRefName: headBranch,
    title,
    body,
  });

  return data?.createPullRequest?.pullRequest ?? null;
}
