import { homedir } from "os";
import { join } from "path";
import { execSync } from "child_process";

// Expand ~ to home directory
export function expandTilde(path: string): string {
  if (path.startsWith("~/")) {
    return join(homedir(), path.slice(2));
  }
  if (path === "~") {
    return homedir();
  }
  return path;
}

// Get repo ID from local path using gh CLI
export function getRepoId(repoPath: string): string | null {
  try {
    const output = execSync(
      `cd "${repoPath}" && gh repo view --json nameWithOwner --jq .nameWithOwner`,
      { encoding: "utf-8" }
    );
    return output.trim() || null;
  } catch {
    return null;
  }
}
