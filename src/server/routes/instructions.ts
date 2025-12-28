import { Hono } from "hono";
import { db, schema } from "../../db";
import { eq, desc } from "drizzle-orm";
import { broadcast } from "../ws";
import {
  repoIdQuerySchema,
  logInstructionSchema,
  validateOrThrow,
} from "../../shared/validation";

export const instructionsRouter = new Hono();

// POST /api/instructions/log
instructionsRouter.post("/log", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(logInstructionSchema, body);

  const now = new Date().toISOString();

  const result = await db
    .insert(schema.instructionsLog)
    .values({
      repoId: input.repoId,
      planId: input.planId ?? null,
      worktreePath: input.worktreePath ?? null,
      branchName: input.branchName ?? null,
      kind: input.kind,
      contentMd: input.contentMd,
      createdAt: now,
    })
    .returning();

  const log = result[0];
  if (!log) {
    throw new Error("Failed to create instruction log");
  }

  broadcast({
    type: "instructions.logged",
    repoId: input.repoId,
    data: log,
  });

  return c.json(log, 201);
});

// GET /api/instructions/logs?repoId=...
instructionsRouter.get("/logs", async (c) => {
  const query = validateOrThrow(repoIdQuerySchema, {
    repoId: c.req.query("repoId"),
  });

  const logs = await db
    .select()
    .from(schema.instructionsLog)
    .where(eq(schema.instructionsLog.repoId, query.repoId))
    .orderBy(desc(schema.instructionsLog.createdAt))
    .limit(100);

  return c.json(logs);
});
