/**
 * GitHub GraphQL API client for fetching PR information
 */

import { execSync } from "child_process";
import type { PRInfo } from "../../shared/types";

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

// Cache for GitHub token (5 minutes TTL)
let cachedToken: { value: string | null; timestamp: number } | null = null;
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    const result: GitHubGraphQLResponse = await response.json();

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
