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
  issueNumber: number
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
  prNumber: number
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
    const statusRollup =
      pr.commits.nodes[0]?.commit?.statusCheckRollup?.contexts?.nodes ?? [];

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
      const hasFailure = checks.some(
        (c) => c.conclusion === "FAILURE" || c.conclusion === "ERROR"
      );
      const allSuccess = checks.every(
        (c) => c.conclusion === "SUCCESS" || c.conclusion === "SKIPPED"
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
function getGitHubToken(): string | null {
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
function parseRepoId(repoId: string): { owner: string; repo: string } | null {
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
