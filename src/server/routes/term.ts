import { Hono } from "hono";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "../../db";
import { ptyManager } from "../pty-manager";
import { BadRequestError, NotFoundError } from "../middleware/error-handler";
import { existsSync } from "fs";

export const termRouter = new Hono();

interface TerminalSession {
  id: string;
  repoId: string;
  worktreePath: string;
  pid: number | null;
  status: "running" | "stopped";
  lastOutput: string | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string;
}

// POST /api/term/sessions - Create or get existing session
termRouter.post("/sessions", async (c) => {
  const body = await c.req.json();
  const { repoId, worktreePath } = body;

  if (!repoId || !worktreePath) {
    throw new BadRequestError("repoId and worktreePath are required");
  }

  if (!existsSync(worktreePath)) {
    throw new BadRequestError(`Path does not exist: ${worktreePath}`);
  }

  // Check for existing session
  const existing = await db
    .select()
    .from(schema.terminalSessions)
    .where(eq(schema.terminalSessions.worktreePath, worktreePath))
    .limit(1);

  const now = new Date().toISOString();

  if (existing[0]) {
    // Update lastUsedAt
    await db
      .update(schema.terminalSessions)
      .set({ lastUsedAt: now, updatedAt: now })
      .where(eq(schema.terminalSessions.id, existing[0].id));

    // Check if PTY is still running
    const isRunning = ptyManager.isRunning(existing[0].id);

    const session: TerminalSession = {
      id: existing[0].id,
      repoId: existing[0].repoId,
      worktreePath: existing[0].worktreePath,
      pid: isRunning ? (ptyManager.getPid(existing[0].id) ?? null) : null,
      status: isRunning ? "running" : "stopped",
      lastOutput: existing[0].lastOutput,
      createdAt: existing[0].createdAt,
      updatedAt: now,
      lastUsedAt: now,
    };

    return c.json(session);
  }

  // Create new session
  const id = randomUUID();
  await db.insert(schema.terminalSessions).values({
    id,
    repoId,
    worktreePath,
    status: "stopped",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  });

  const session: TerminalSession = {
    id,
    repoId,
    worktreePath,
    pid: null,
    status: "stopped",
    lastOutput: null,
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  };

  return c.json(session, 201);
});

// POST /api/term/sessions/:id/start - Start PTY
termRouter.post("/sessions/:id/start", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const cols = body.cols || 80;
  const rows = body.rows || 24;

  const existing = await db
    .select()
    .from(schema.terminalSessions)
    .where(eq(schema.terminalSessions.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new NotFoundError(`Session not found: ${id}`);
  }

  const session = existing[0];

  // Check if already running
  if (ptyManager.isRunning(id)) {
    return c.json({
      id,
      status: "running",
      pid: ptyManager.getPid(id),
      message: "Already running",
    });
  }

  // Start PTY
  const ptySession = await ptyManager.createSession(id, session.worktreePath, cols, rows);

  const now = new Date().toISOString();
  await db
    .update(schema.terminalSessions)
    .set({
      status: "running",
      pid: ptySession.pty.pid,
      updatedAt: now,
      lastUsedAt: now,
    })
    .where(eq(schema.terminalSessions.id, id));

  // Handle exit
  ptyManager.onExit(id, async () => {
    const output = ptyManager.getOutputBuffer(id);
    await db
      .update(schema.terminalSessions)
      .set({
        status: "stopped",
        pid: null,
        lastOutput: output.slice(-MAX_OUTPUT_SIZE),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.terminalSessions.id, id));
  });

  return c.json({
    id,
    status: "running",
    pid: ptySession.pty.pid,
  });
});

const MAX_OUTPUT_SIZE = 64 * 1024; // 64KB

// POST /api/term/sessions/:id/stop - Stop PTY
termRouter.post("/sessions/:id/stop", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schema.terminalSessions)
    .where(eq(schema.terminalSessions.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new NotFoundError(`Session not found: ${id}`);
  }

  // Save output buffer before killing
  const output = ptyManager.getOutputBuffer(id);

  // Kill PTY
  ptyManager.kill(id);

  const now = new Date().toISOString();
  await db
    .update(schema.terminalSessions)
    .set({
      status: "stopped",
      pid: null,
      lastOutput: output.slice(-MAX_OUTPUT_SIZE),
      updatedAt: now,
    })
    .where(eq(schema.terminalSessions.id, id));

  return c.json({
    id,
    status: "stopped",
  });
});

// GET /api/term/sessions/:id - Get session status
termRouter.get("/sessions/:id", async (c) => {
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(schema.terminalSessions)
    .where(eq(schema.terminalSessions.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new NotFoundError(`Session not found: ${id}`);
  }

  const isRunning = ptyManager.isRunning(id);

  const session: TerminalSession = {
    id: existing[0].id,
    repoId: existing[0].repoId,
    worktreePath: existing[0].worktreePath,
    pid: isRunning ? (ptyManager.getPid(id) ?? null) : null,
    status: isRunning ? "running" : "stopped",
    lastOutput: existing[0].lastOutput,
    createdAt: existing[0].createdAt,
    updatedAt: existing[0].updatedAt,
    lastUsedAt: existing[0].lastUsedAt,
  };

  return c.json(session);
});

// POST /api/term/sessions/:id/write - Write to terminal
termRouter.post("/sessions/:id/write", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { data } = body;

  if (!data) {
    throw new BadRequestError("data is required");
  }

  if (!ptyManager.isRunning(id)) {
    throw new BadRequestError("Session is not running");
  }

  ptyManager.write(id, data);

  return c.json({ success: true });
});

// POST /api/term/sessions/:id/resize - Resize terminal
termRouter.post("/sessions/:id/resize", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const { cols, rows } = body;

  if (!cols || !rows) {
    throw new BadRequestError("cols and rows are required");
  }

  if (!ptyManager.isRunning(id)) {
    throw new BadRequestError("Session is not running");
  }

  ptyManager.resize(id, cols, rows);

  return c.json({ success: true });
});
