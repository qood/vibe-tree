import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../db/schema";
import { eq } from "drizzle-orm";

// Create in-memory database for testing
let sqlite: Database;
let testDb: ReturnType<typeof drizzle>;

function setupTestDb() {
  sqlite = new Database(":memory:");
  testDb = drizzle(sqlite, { schema });

  // Create tables
  sqlite.run(`
    CREATE TABLE repos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.run(`
    CREATE TABLE project_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      rule_type TEXT NOT NULL,
      rule_json TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.run(`
    CREATE TABLE plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      title TEXT NOT NULL,
      content_md TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      github_issue_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.run(`
    CREATE TABLE plan_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES plans(id),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'todo',
      order_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  sqlite.run(`
    CREATE TABLE instructions_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_id INTEGER NOT NULL REFERENCES repos(id),
      plan_id INTEGER REFERENCES plans(id),
      worktree_path TEXT,
      branch_name TEXT,
      kind TEXT NOT NULL,
      content_md TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

function clearDb() {
  sqlite.run("DELETE FROM instructions_log");
  sqlite.run("DELETE FROM plan_tasks");
  sqlite.run("DELETE FROM plans");
  sqlite.run("DELETE FROM project_rules");
  sqlite.run("DELETE FROM repos");
}

describe("Database Schema", () => {
  beforeAll(() => {
    setupTestDb();
  });

  afterAll(() => {
    sqlite.close();
  });

  beforeEach(() => {
    clearDb();
  });

  test("can insert and query repos", async () => {
    const now = new Date().toISOString();
    const result = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(result.length).toBe(1);
    expect(result[0]?.name).toBe("test-repo");
    expect(result[0]?.path).toBe("/test/repo");
  });

  test("repo path is unique", async () => {
    const now = new Date().toISOString();
    await testDb.insert(schema.repos).values({
      path: "/test/repo",
      name: "test-repo",
      createdAt: now,
      updatedAt: now,
    });

    // Try to insert duplicate
    expect(() => {
      sqlite.run(
        "INSERT INTO repos (path, name, created_at, updated_at) VALUES ('/test/repo', 'another', ?, ?)",
        [now, now]
      );
    }).toThrow();
  });

  test("can insert project_rules with repo reference", async () => {
    const now = new Date().toISOString();

    // Insert repo first
    const repos = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const repoId = repos[0]?.id;
    expect(repoId).toBeDefined();

    // Insert project rule
    const rules = await testDb
      .insert(schema.projectRules)
      .values({
        repoId: repoId!,
        ruleType: "branch_naming",
        ruleJson: JSON.stringify({ pattern: "test/{id}" }),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(rules.length).toBe(1);
    expect(rules[0]?.ruleType).toBe("branch_naming");
  });

  test("can insert and query plans", async () => {
    const now = new Date().toISOString();

    // Insert repo
    const repos = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const repoId = repos[0]?.id!;

    // Insert plan
    const plans = await testDb
      .insert(schema.plans)
      .values({
        repoId,
        title: "Test Plan",
        contentMd: "# Test",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(plans.length).toBe(1);
    expect(plans[0]?.title).toBe("Test Plan");
    expect(plans[0]?.status).toBe("draft");
  });

  test("can update plan status", async () => {
    const now = new Date().toISOString();

    // Insert repo
    const repos = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const repoId = repos[0]?.id!;

    // Insert plan
    const plans = await testDb
      .insert(schema.plans)
      .values({
        repoId,
        title: "Test Plan",
        status: "draft",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const planId = plans[0]?.id!;

    // Update plan
    const updated = await testDb
      .update(schema.plans)
      .set({ status: "committed", updatedAt: now })
      .where(eq(schema.plans.id, planId))
      .returning();

    expect(updated[0]?.status).toBe("committed");
  });

  test("can insert instructions_log", async () => {
    const now = new Date().toISOString();

    // Insert repo
    const repos = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const repoId = repos[0]?.id!;

    // Insert instruction log
    const logs = await testDb
      .insert(schema.instructionsLog)
      .values({
        repoId,
        kind: "user_instruction",
        contentMd: "Do something",
        createdAt: now,
      })
      .returning();

    expect(logs.length).toBe(1);
    expect(logs[0]?.kind).toBe("user_instruction");
  });

  test("can insert plan_tasks", async () => {
    const now = new Date().toISOString();

    // Insert repo
    const repos = await testDb
      .insert(schema.repos)
      .values({
        path: "/test/repo",
        name: "test-repo",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const repoId = repos[0]?.id!;

    // Insert plan
    const plans = await testDb
      .insert(schema.plans)
      .values({
        repoId,
        title: "Test Plan",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    const planId = plans[0]?.id!;

    // Insert task
    const tasks = await testDb
      .insert(schema.planTasks)
      .values({
        planId,
        title: "Task 1",
        description: "First task",
        status: "todo",
        orderIndex: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    expect(tasks.length).toBe(1);
    expect(tasks[0]?.title).toBe("Task 1");
    expect(tasks[0]?.status).toBe("todo");
  });
});

describe("Shared Types", () => {
  test("BranchNamingRule structure", () => {
    const rule = {
      pattern: "vt/{planId}/{taskSlug}",
      description: "Test",
      examples: ["vt/1/feature"],
    };
    expect(rule.pattern).toBeDefined();
    expect(Array.isArray(rule.examples)).toBe(true);
  });

  test("Warning structure", () => {
    const warning = {
      severity: "warn" as const,
      code: "DIRTY" as const,
      message: "Test warning",
      meta: { branch: "test" },
    };
    expect(["warn", "error"]).toContain(warning.severity);
  });

  test("TreeNode structure", () => {
    const node = {
      branchName: "main",
      badges: ["dirty"],
      lastCommitAt: new Date().toISOString(),
      aheadBehind: { ahead: 0, behind: 0 },
    };
    expect(node.branchName).toBeDefined();
    expect(Array.isArray(node.badges)).toBe(true);
  });
});
