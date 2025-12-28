import { Hono } from "hono";
import { db, schema } from "../../db";
import { eq } from "drizzle-orm";
import {
  createRepoSchema,
  validateOrThrow,
} from "../../shared/validation";
import { NotFoundError } from "../middleware/error-handler";

export const reposRouter = new Hono();

// GET /api/repos
reposRouter.get("/", async (c) => {
  const repos = await db.select().from(schema.repos);
  return c.json(repos);
});

// POST /api/repos - Register a new repo
reposRouter.post("/", async (c) => {
  const body = await c.req.json();
  const input = validateOrThrow(createRepoSchema, body);

  const repoName = input.name ?? input.path.split("/").pop() ?? "unknown";
  const now = new Date().toISOString();

  // Check if repo already exists
  const existing = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.path, input.path));

  if (existing.length > 0) {
    return c.json(existing[0]);
  }

  // Insert repo
  const result = await db
    .insert(schema.repos)
    .values({
      path: input.path,
      name: repoName,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const repo = result[0];
  if (!repo) {
    throw new Error("Failed to create repo");
  }

  // Initialize branch_naming rule
  const defaultBranchNaming = {
    pattern: "vt/{planId}/{taskSlug}",
    description: "Default branch naming pattern for Vibe Tree",
    examples: ["vt/1/add-auth", "vt/2/fix-bug", "vt/3/refactor-api"],
  };

  await db.insert(schema.projectRules).values({
    repoId: repo.id,
    ruleType: "branch_naming",
    ruleJson: JSON.stringify(defaultBranchNaming),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(repo, 201);
});

// GET /api/repos/:id
reposRouter.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"));
  if (isNaN(id)) {
    throw new NotFoundError("Repo");
  }

  const repos = await db
    .select()
    .from(schema.repos)
    .where(eq(schema.repos.id, id));

  const repo = repos[0];
  if (!repo) {
    throw new NotFoundError("Repo");
  }

  return c.json(repo);
});
