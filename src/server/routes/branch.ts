import { Hono } from "hono";
import { execSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { dirname, basename, join } from "path";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { expandTilde } from "../utils";
import { createBranchSchema, createTreeSchema, validateOrThrow } from "../../shared/validation";
import { BadRequestError } from "../middleware/error-handler";
import { db, schema } from "../../db";

export const branchRouter = new Hono();

// POST /api/branch/create
branchRouter.post("/create", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(createBranchSchema, body);
  const localPath = expandTilde(input.localPath);

  // Verify local path exists
  if (!existsSync(localPath)) {
    throw new BadRequestError(`Local path does not exist: ${localPath}`);
  }

  // Validate branch name (no spaces, special chars)
  const branchNameRegex = /^[a-zA-Z0-9/_-]+$/;
  if (!branchNameRegex.test(input.branchName)) {
    throw new BadRequestError(
      `Invalid branch name: ${input.branchName}. Use only alphanumeric, /, _, -`
    );
  }

  // Check if branch already exists
  try {
    const existingBranches = execSync(
      `cd "${localPath}" && git branch --list "${input.branchName}"`,
      { encoding: "utf-8" }
    ).trim();
    if (existingBranches) {
      throw new BadRequestError(`Branch already exists: ${input.branchName}`);
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err;
    // Ignore other errors (git command issues)
  }

  // Create the branch
  try {
    execSync(
      `cd "${localPath}" && git branch "${input.branchName}" "${input.baseBranch}"`,
      { encoding: "utf-8" }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new BadRequestError(`Failed to create branch: ${message}`);
  }

  return c.json({
    success: true,
    branchName: input.branchName,
    baseBranch: input.baseBranch,
  });
});

interface TaskResult {
  taskId: string;
  branchName: string;
  worktreePath: string;
  chatSessionId: string;
  success: boolean;
  error?: string;
}

// POST /api/branch/create-tree - Batch create branches + worktrees + chat sessions
branchRouter.post("/create-tree", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(createTreeSchema, body);
  const localPath = expandTilde(input.localPath);

  // Verify local path exists
  if (!existsSync(localPath)) {
    throw new BadRequestError(`Local path does not exist: ${localPath}`);
  }

  // Determine worktrees parent directory: {repo}-worktrees
  const repoName = basename(localPath);
  const parentDir = dirname(localPath);
  const worktreesDir = join(parentDir, `${repoName}-worktrees`);

  // Create worktrees directory if it doesn't exist
  if (!existsSync(worktreesDir)) {
    mkdirSync(worktreesDir, { recursive: true });
  }

  const results: TaskResult[] = [];
  const now = new Date().toISOString();

  for (const task of input.tasks) {
    const result: TaskResult = {
      taskId: task.id,
      branchName: task.branchName,
      worktreePath: join(worktreesDir, task.worktreeName),
      chatSessionId: "",
      success: false,
    };

    try {
      // Validate branch name
      const branchNameRegex = /^[a-zA-Z0-9/_-]+$/;
      if (!branchNameRegex.test(task.branchName)) {
        throw new Error(`Invalid branch name: ${task.branchName}`);
      }

      // Check if branch already exists
      const existingBranches = execSync(
        `cd "${localPath}" && git branch --list "${task.branchName}"`,
        { encoding: "utf-8" }
      ).trim();

      // Create branch if it doesn't exist
      if (!existingBranches) {
        execSync(
          `cd "${localPath}" && git branch "${task.branchName}" "${task.parentBranch}"`,
          { encoding: "utf-8" }
        );
      }

      // Check if worktree already exists
      if (existsSync(result.worktreePath)) {
        // Worktree already exists, just use it
        console.log(`Worktree already exists: ${result.worktreePath}`);
      } else {
        // Create worktree
        execSync(
          `cd "${localPath}" && git worktree add "${result.worktreePath}" "${task.branchName}"`,
          { encoding: "utf-8" }
        );
      }

      // Create chat session for this worktree
      const sessionId = randomUUID();
      await db.insert(schema.chatSessions).values({
        id: sessionId,
        repoId: input.repoId,
        worktreePath: result.worktreePath,
        branchName: task.branchName,
        planId: null,
        status: "active",
        lastUsedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      result.chatSessionId = sessionId;
      result.success = true;
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.error(`Failed to create tree for task ${task.id}:`, result.error);
    }

    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // Update tree spec status to "generated" if all succeeded
  if (successCount > 0) {
    const updateNow = new Date().toISOString();
    await db
      .update(schema.treeSpecs)
      .set({ status: "generated", updatedAt: updateNow })
      .where(eq(schema.treeSpecs.repoId, input.repoId));
  }

  return c.json({
    success: failCount === 0,
    worktreesDir,
    results,
    summary: {
      total: results.length,
      success: successCount,
      failed: failCount,
    },
  });
});
