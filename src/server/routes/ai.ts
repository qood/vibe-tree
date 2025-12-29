import { Hono } from "hono";
import { db, schema } from "../../db";
import { eq, and } from "drizzle-orm";
import { spawn, type ChildProcess, execSync } from "child_process";
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { expandTilde, getRepoId } from "../utils";
import { broadcast } from "../ws";
import {
  aiStartSchema,
  aiStopSchema,
  validateOrThrow,
} from "../../shared/validation";
import { BadRequestError, NotFoundError } from "../middleware/error-handler";
import type { BranchNamingRule, Plan } from "../../shared/types";

export const aiRouter = new Hono();

// Track running agents: pid -> { process, heartbeatInterval, repoId, localPath }
interface RunningAgent {
  process: ChildProcess;
  heartbeatInterval: ReturnType<typeof setInterval>;
  repoId: string;
  localPath: string;
  startedAt: string;
}

const runningAgents = new Map<number, RunningAgent>();

// Write heartbeat file
function writeHeartbeat(localPath: string, pid: number, agent: string = "claude") {
  const heartbeatDir = join(localPath, ".vibetree");
  const heartbeatPath = join(heartbeatDir, "heartbeat.json");

  if (!existsSync(heartbeatDir)) {
    mkdirSync(heartbeatDir, { recursive: true });
  }

  const heartbeat = {
    agent,
    pid,
    updatedAt: new Date().toISOString(),
  };

  writeFileSync(heartbeatPath, JSON.stringify(heartbeat, null, 2));
}

// Remove heartbeat file
function removeHeartbeat(localPath: string) {
  const heartbeatPath = join(localPath, ".vibetree", "heartbeat.json");
  try {
    if (existsSync(heartbeatPath)) {
      unlinkSync(heartbeatPath);
    }
  } catch {
    // Ignore errors
  }
}

// Generate prompt for Claude
async function generatePrompt(
  repoId: string,
  localPath: string,
  planId?: number,
  branch?: string
): Promise<string> {
  // Get plan if specified
  let plan: Plan | null = null;
  if (planId) {
    const plans = await db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.id, planId));
    if (plans[0]) {
      plan = {
        id: plans[0].id,
        repoId: plans[0].repoId,
        title: plans[0].title,
        contentMd: plans[0].contentMd,
        status: plans[0].status as "draft" | "committed",
        githubIssueUrl: plans[0].githubIssueUrl,
        createdAt: plans[0].createdAt,
        updatedAt: plans[0].updatedAt,
      };
    }
  }

  // Get branch naming rule
  const rules = await db
    .select()
    .from(schema.projectRules)
    .where(
      and(
        eq(schema.projectRules.repoId, repoId),
        eq(schema.projectRules.ruleType, "branch_naming"),
        eq(schema.projectRules.isActive, true)
      )
    );

  const ruleRecord = rules[0];
  const branchNaming = ruleRecord
    ? (JSON.parse(ruleRecord.ruleJson) as BranchNamingRule)
    : null;

  // Get current branch
  let currentBranch = branch ?? "";
  if (!currentBranch) {
    try {
      currentBranch = execSync(`cd "${localPath}" && git branch --show-current`, {
        encoding: "utf-8",
      }).trim();
    } catch {
      currentBranch = "unknown";
    }
  }

  // Get git status
  let gitStatus = "";
  try {
    gitStatus = execSync(`cd "${localPath}" && git status --short`, {
      encoding: "utf-8",
    }).trim();
  } catch {
    gitStatus = "";
  }

  // Build prompt
  const parts: string[] = [];

  parts.push(`# Working on ${repoId}`);
  parts.push(`\nCurrent branch: \`${currentBranch}\``);

  if (branchNaming) {
    parts.push(`\n## Branch Naming Convention`);
    parts.push(`- Pattern: \`${branchNaming.pattern}\``);
    if (branchNaming.examples?.length) {
      parts.push(`- Examples: ${branchNaming.examples.join(", ")}`);
    }
  }

  if (plan) {
    parts.push(`\n## Current Plan: ${plan.title}`);
    if (plan.contentMd) {
      parts.push(plan.contentMd);
    }
  }

  if (gitStatus) {
    parts.push(`\n## Working Directory Status`);
    parts.push("```");
    parts.push(gitStatus);
    parts.push("```");
  } else {
    parts.push(`\n## Working Directory Status`);
    parts.push("Clean working directory.");
  }

  parts.push(`\n## Instructions`);
  parts.push(`Continue working on this project. Follow the branch naming convention if creating new branches.`);

  return parts.join("\n");
}

// Log instruction to DB
async function logInstruction(
  repoId: string,
  planId: number | null,
  localPath: string,
  kind: "director_suggestion" | "user_instruction" | "system_note",
  contentMd: string
) {
  await db.insert(schema.instructionsLog).values({
    repoId,
    planId,
    worktreePath: localPath,
    kind,
    contentMd,
    createdAt: new Date().toISOString(),
  });
}

// POST /api/ai/start - Start Claude agent
aiRouter.post("/start", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(aiStartSchema, body);
  const localPath = expandTilde(input.localPath);

  // Verify path exists
  if (!existsSync(localPath)) {
    throw new BadRequestError(`Local path does not exist: ${localPath}`);
  }

  // Get repo ID
  const repoId = getRepoId(localPath);
  if (!repoId) {
    throw new BadRequestError(`Could not detect GitHub repo at: ${localPath}`);
  }

  // Check if already running for this path
  for (const [pid, agent] of runningAgents) {
    if (agent.localPath === localPath) {
      return c.json({
        status: "already_running",
        pid,
        repoId: agent.repoId,
        startedAt: agent.startedAt,
      });
    }
  }

  // Generate prompt
  const prompt = await generatePrompt(repoId, localPath, input.planId, input.branch);

  // Start Claude process
  const startedAt = new Date().toISOString();

  const claudeProcess = spawn("claude", ["-p", prompt], {
    cwd: localPath,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  if (!claudeProcess.pid) {
    throw new BadRequestError("Failed to start Claude process");
  }

  const pid = claudeProcess.pid;

  // Write initial heartbeat
  writeHeartbeat(localPath, pid);

  // Start heartbeat updater (every 5 seconds)
  const heartbeatInterval = setInterval(() => {
    writeHeartbeat(localPath, pid);
  }, 5000);

  // Track the running agent
  runningAgents.set(pid, {
    process: claudeProcess,
    heartbeatInterval,
    repoId,
    localPath,
    startedAt,
  });

  // Log start instruction
  await logInstruction(
    repoId,
    input.planId ?? null,
    localPath,
    "system_note",
    `Claude agent started from UI at ${localPath}`
  );

  // Broadcast start event
  broadcast({
    type: "agent.started",
    repoId,
    data: { pid, startedAt, localPath },
  });

  // Handle process exit
  claudeProcess.on("exit", async (code) => {
    const agent = runningAgents.get(pid);
    if (agent) {
      clearInterval(agent.heartbeatInterval);
      removeHeartbeat(localPath);
      runningAgents.delete(pid);

      // Log finish instruction
      await logInstruction(
        repoId,
        input.planId ?? null,
        localPath,
        "system_note",
        `Claude agent finished with exit code ${code}`
      );

      // Broadcast finish event
      broadcast({
        type: "agent.finished",
        repoId,
        data: { pid, exitCode: code, finishedAt: new Date().toISOString() },
      });
    }
  });

  // Capture stderr for errors
  let stderrOutput = "";
  claudeProcess.stderr?.on("data", (data) => {
    stderrOutput += data.toString();
  });

  claudeProcess.on("error", async (err) => {
    const agent = runningAgents.get(pid);
    if (agent) {
      clearInterval(agent.heartbeatInterval);
      removeHeartbeat(localPath);
      runningAgents.delete(pid);

      // Log error
      await logInstruction(
        repoId,
        input.planId ?? null,
        localPath,
        "system_note",
        `Claude agent error: ${err.message}\n${stderrOutput}`
      );

      broadcast({
        type: "agent.finished",
        repoId,
        data: { pid, exitCode: -1, error: err.message, finishedAt: new Date().toISOString() },
      });
    }
  });

  return c.json({
    status: "started",
    pid,
    repoId,
    startedAt,
    localPath,
  });
});

// POST /api/ai/stop - Stop a running Claude agent
aiRouter.post("/stop", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(aiStopSchema, body);

  const agent = runningAgents.get(input.pid);
  if (!agent) {
    throw new NotFoundError(`No running agent with pid: ${input.pid}`);
  }

  // Clean up
  clearInterval(agent.heartbeatInterval);
  removeHeartbeat(agent.localPath);

  // Kill the process
  try {
    agent.process.kill("SIGTERM");
  } catch {
    // Try SIGKILL if SIGTERM fails
    try {
      agent.process.kill("SIGKILL");
    } catch {
      // Ignore
    }
  }

  runningAgents.delete(input.pid);

  // Log stop instruction
  await logInstruction(
    agent.repoId,
    null,
    agent.localPath,
    "system_note",
    `Claude agent stopped from UI`
  );

  // Broadcast stop event
  broadcast({
    type: "agent.stopped",
    repoId: agent.repoId,
    data: { pid: input.pid, stoppedAt: new Date().toISOString() },
  });

  return c.json({ status: "stopped", pid: input.pid });
});

// GET /api/ai/status - Get status of running agents
aiRouter.get("/status", (c) => {
  const agents: Array<{
    pid: number;
    repoId: string;
    localPath: string;
    startedAt: string;
  }> = [];

  for (const [pid, agent] of runningAgents) {
    agents.push({
      pid,
      repoId: agent.repoId,
      localPath: agent.localPath,
      startedAt: agent.startedAt,
    });
  }

  return c.json({ agents });
});
