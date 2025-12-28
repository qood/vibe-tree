const API_BASE = "/api";

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
  pattern: string;
  description: string;
  examples: string[];
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
}

export interface TreeEdge {
  parent: string;
  child: string;
  confidence: "high" | "medium" | "low";
  isDesigned?: boolean;
}

export interface TreeSpecNode {
  branchName: string;
  intendedIssue?: number;
  intendedPr?: number;
  description?: string;
}

export interface TreeSpecEdge {
  parent: string;
  child: string;
}

export interface TreeSpec {
  id: number;
  repoId: string;
  specJson: {
    nodes: TreeSpecNode[];
    edges: TreeSpecEdge[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ScanSnapshot {
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

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || `HTTP error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Health
  health: () => fetchJson<{ status: string }>(`${API_BASE}/health`),

  // Repos (fetched from gh CLI)
  getRepos: () => fetchJson<Repo[]>(`${API_BASE}/repos`),
  getRepo: (owner: string, name: string) =>
    fetchJson<Repo>(`${API_BASE}/repos/${owner}/${name}`),

  // Branch Naming
  getBranchNaming: (repoId: string) =>
    fetchJson<BranchNamingRule & { id: number; repoId: string }>(
      `${API_BASE}/project-rules/branch-naming?repoId=${encodeURIComponent(repoId)}`
    ),
  updateBranchNaming: (data: {
    repoId: string;
    pattern: string;
    description: string;
    examples: string[];
  }) =>
    fetchJson<BranchNamingRule>(`${API_BASE}/project-rules/branch-naming`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Plan
  getCurrentPlan: (repoId: string) =>
    fetchJson<Plan | null>(`${API_BASE}/plan/current?repoId=${encodeURIComponent(repoId)}`),
  startPlan: (repoId: string, title: string) =>
    fetchJson<Plan>(`${API_BASE}/plan/start`, {
      method: "POST",
      body: JSON.stringify({ repoId, title }),
    }),
  updatePlan: (planId: number, contentMd: string) =>
    fetchJson<Plan>(`${API_BASE}/plan/update`, {
      method: "POST",
      body: JSON.stringify({ planId, contentMd }),
    }),
  commitPlan: (planId: number, localPath: string) =>
    fetchJson<Plan>(`${API_BASE}/plan/commit`, {
      method: "POST",
      body: JSON.stringify({ planId, localPath }),
    }),

  // Scan
  scan: (repoId: string, localPath: string) =>
    fetchJson<ScanSnapshot>(`${API_BASE}/scan`, {
      method: "POST",
      body: JSON.stringify({ repoId, localPath }),
    }),
  getRestartPrompt: (
    repoId: string,
    localPath: string,
    planId?: number,
    worktreePath?: string
  ) => {
    const params = new URLSearchParams({
      repoId,
      localPath,
    });
    if (planId) params.set("planId", String(planId));
    if (worktreePath) params.set("worktreePath", worktreePath);
    return fetchJson<{ cdCommand: string; restartPromptMd: string }>(
      `${API_BASE}/scan/restart-prompt?${params}`
    );
  },

  // Tree Spec
  getTreeSpec: (repoId: string) =>
    fetchJson<TreeSpec | null>(`${API_BASE}/tree-spec?repoId=${encodeURIComponent(repoId)}`),
  updateTreeSpec: (data: {
    repoId: string;
    nodes: TreeSpecNode[];
    edges: TreeSpecEdge[];
  }) =>
    fetchJson<TreeSpec>(`${API_BASE}/tree-spec`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Instructions
  logInstruction: (data: {
    repoId: string;
    planId?: number;
    worktreePath?: string;
    branchName?: string;
    kind: "director_suggestion" | "user_instruction" | "system_note";
    contentMd: string;
  }) =>
    fetchJson<InstructionLog>(`${API_BASE}/instructions/log`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  getInstructionLogs: (repoId: string) =>
    fetchJson<InstructionLog[]>(
      `${API_BASE}/instructions/logs?repoId=${encodeURIComponent(repoId)}`
    ),
};
