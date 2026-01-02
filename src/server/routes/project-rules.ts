import { Hono } from "hono";
import { db, schema } from "../../db";
import { eq, and } from "drizzle-orm";
import { broadcast } from "../ws";
import {
  repoIdQuerySchema,
  updateBranchNamingSchema,
  validateOrThrow,
} from "../../shared/validation";
import { NotFoundError } from "../middleware/error-handler";
import type { BranchNamingRule } from "../../shared/types";

export const projectRulesRouter = new Hono();

// GET /api/project-rules/branch-naming?repoId=...
projectRulesRouter.get("/branch-naming", async (c) => {
  const query = validateOrThrow(repoIdQuerySchema, {
    repoId: c.req.query("repoId"),
  });

  const rules = await db
    .select()
    .from(schema.projectRules)
    .where(
      and(
        eq(schema.projectRules.repoId, query.repoId),
        eq(schema.projectRules.ruleType, "branch_naming"),
        eq(schema.projectRules.isActive, true)
      )
    );

  const rule = rules[0];
  if (!rule) {
    // Return default rule if none exists
    return c.json({
      id: null,
      repoId: query.repoId,
      pattern: "vt/{issueId}/{taskSlug}",
      description: "",
      examples: [],
    });
  }

  const ruleData = JSON.parse(rule.ruleJson) as BranchNamingRule;
  return c.json({
    id: rule.id,
    repoId: rule.repoId,
    ...ruleData,
  });
});

// POST /api/project-rules/branch-naming
projectRulesRouter.post("/branch-naming", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(updateBranchNamingSchema, body);

  const now = new Date().toISOString();
  const ruleJson = JSON.stringify({
    pattern: input.pattern,
    description: input.description,
    examples: input.examples,
  });

  // Update existing branch_naming rule
  const result = await db
    .update(schema.projectRules)
    .set({
      ruleJson,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.projectRules.repoId, input.repoId),
        eq(schema.projectRules.ruleType, "branch_naming"),
        eq(schema.projectRules.isActive, true)
      )
    )
    .returning();

  const updated = result[0];
  if (!updated) {
    throw new NotFoundError("Branch naming rule");
  }

  const response = {
    id: updated.id,
    repoId: input.repoId,
    pattern: input.pattern,
    description: input.description,
    examples: input.examples,
  };

  // Broadcast update
  broadcast({
    type: "projectRules.updated",
    repoId: input.repoId,
    data: response,
  });

  return c.json(response);
});
