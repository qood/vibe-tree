#!/usr/bin/env bun

/**
 * E2E Test Seed Data Script
 *
 * This script populates the database with test data for E2E testing.
 * Usage:
 *   bun run scripts/seed-e2e.ts
 *   bun run scripts/seed-e2e.ts --clean  # Clean and reseed
 */

import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "../src/db/schema";
import path from "path";
import fs from "fs";

const args = process.argv.slice(2);
const shouldClean = args.includes("--clean");

// Use test database or main database
const DB_DIR = path.join(process.cwd(), ".vibetree");
const DB_PATH = path.join(DB_DIR, "vibetree.sqlite");

console.log(`📦 Using database: ${DB_PATH}`);

// Ensure .vibetree directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  console.log(`✅ Created directory: ${DB_DIR}`);
}

const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite, { schema });

async function cleanDatabase() {
  console.log("🧹 Cleaning existing data...");

  // Delete in reverse order of dependencies
  await db.delete(schema.chatMessages);
  await db.delete(schema.chatSummaries);
  await db.delete(schema.chatSessions);
  await db.delete(schema.externalLinks);
  await db.delete(schema.taskInstructions);
  await db.delete(schema.planTasks);
  await db.delete(schema.plans);
  await db.delete(schema.planningSessions);
  await db.delete(schema.agentRuns);
  await db.delete(schema.agentSessions);
  await db.delete(schema.terminalSessions);
  await db.delete(schema.branchLinks);
  await db.delete(schema.instructionsLog);
  await db.delete(schema.requirementsNotes);
  await db.delete(schema.worktreeActivity);
  await db.delete(schema.repoPins);
  await db.delete(schema.projectRules);
  await db.delete(schema.treeSpecs);

  console.log("✅ Database cleaned");
}

async function seedData() {
  console.log("🌱 Seeding test data...");

  const now = new Date().toISOString();

  // 1. Repo Pins
  const repoPinId = await db
    .insert(schema.repoPins)
    .values({
      repoId: "test-owner/test-repo",
      localPath: "/test/path/to/repo",
      label: "Test Repository",
      baseBranch: "main",
      lastUsedAt: now,
      createdAt: now,
    })
    .returning({ id: schema.repoPins.id });

  console.log(`✅ Created repo pin (ID: ${repoPinId[0].id})`);

  // 2. Project Rules
  await db.insert(schema.projectRules).values({
    repoId: "test-owner/test-repo",
    ruleType: "branch_naming",
    ruleJson: JSON.stringify({
      pattern: "feature/{issue-number}-{description}",
      example: "feature/123-add-login",
    }),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });

  console.log("✅ Created project rules");

  // 3. Planning Sessions
  const sessionId = "test-session-001";
  await db.insert(schema.planningSessions).values({
    id: sessionId,
    repoId: "test-owner/test-repo",
    title: "E2E Test Planning Session",
    baseBranch: "main",
    status: "draft",
    nodesJson: JSON.stringify([
      {
        id: "node-1",
        type: "task",
        label: "Implement login feature",
        position: { x: 100, y: 100 },
      },
      {
        id: "node-2",
        type: "task",
        label: "Add authentication tests",
        position: { x: 100, y: 200 },
      },
    ]),
    edgesJson: JSON.stringify([
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
      },
    ]),
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ Created planning session (ID: ${sessionId})`);

  // 4. Plans
  const planId = await db
    .insert(schema.plans)
    .values({
      repoId: "test-owner/test-repo",
      title: "Test Plan: User Authentication",
      contentMd: `# User Authentication Plan

## Overview
Implement user authentication with email/password.

## Tasks
1. Create login form
2. Implement API endpoint
3. Add session management
`,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: schema.plans.id });

  console.log(`✅ Created plan (ID: ${planId[0].id})`);

  // 5. Plan Tasks
  await db.insert(schema.planTasks).values([
    {
      planId: planId[0].id,
      title: "Create login form component",
      description: "Build a React component for user login",
      status: "todo",
      orderIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
    {
      planId: planId[0].id,
      title: "Implement authentication API",
      description: "Create /api/auth/login endpoint",
      status: "doing",
      orderIndex: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      planId: planId[0].id,
      title: "Add session management",
      description: "Implement JWT-based session handling",
      status: "done",
      orderIndex: 2,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("✅ Created plan tasks");

  // 6. Chat Sessions
  const chatSessionId = "chat-session-001";
  await db.insert(schema.chatSessions).values({
    id: chatSessionId,
    repoId: "test-owner/test-repo",
    worktreePath: "/test/path/to/repo",
    branchName: "feature/123-add-login",
    planId: planId[0].id,
    status: "active",
    lastUsedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  console.log(`✅ Created chat session (ID: ${chatSessionId})`);

  // 7. Chat Messages
  await db.insert(schema.chatMessages).values([
    {
      sessionId: chatSessionId,
      role: "user",
      content: "I want to implement user authentication",
      chatMode: "planning",
      createdAt: now,
    },
    {
      sessionId: chatSessionId,
      role: "assistant",
      content: "I'll help you implement user authentication. Let me create a plan...",
      chatMode: "planning",
      createdAt: now,
    },
    {
      sessionId: chatSessionId,
      role: "user",
      content: "Start with the login form",
      chatMode: "execution",
      createdAt: now,
    },
    {
      sessionId: chatSessionId,
      role: "assistant",
      content: "Creating login form component...",
      chatMode: "execution",
      createdAt: now,
    },
  ]);

  console.log("✅ Created chat messages");

  // 8. External Links
  await db.insert(schema.externalLinks).values([
    {
      planningSessionId: sessionId,
      linkType: "notion",
      url: "https://notion.so/test-doc-123",
      title: "Authentication Spec",
      contentCache: "# Auth Spec\n\nUser auth requirements...",
      lastFetchedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      planningSessionId: sessionId,
      linkType: "github_issue",
      url: "https://github.com/test-owner/test-repo/issues/123",
      title: "Add user login feature",
      createdAt: now,
      updatedAt: now,
    },
  ]);

  console.log("✅ Created external links");

  // 9. Branch Links
  await db.insert(schema.branchLinks).values({
    repoId: "test-owner/test-repo",
    branchName: "feature/123-add-login",
    linkType: "pr",
    url: "https://github.com/test-owner/test-repo/pull/456",
    number: 456,
    title: "Add user authentication",
    status: "open",
    checksStatus: "success",
    reviewDecision: "APPROVED",
    checks: JSON.stringify([
      { name: "CI", status: "completed", conclusion: "success" },
      { name: "Lint", status: "completed", conclusion: "success" },
    ]),
    labels: JSON.stringify(["enhancement", "authentication"]),
    reviewers: JSON.stringify(["reviewer1", "reviewer2"]),
    createdAt: now,
    updatedAt: now,
  });

  console.log("✅ Created branch links");

  // 10. Worktree Activity
  await db.insert(schema.worktreeActivity).values({
    worktreePath: "/test/path/to/repo",
    repoId: "test-owner/test-repo",
    branchName: "feature/123-add-login",
    activeAgent: "claude",
    lastSeenAt: now,
    note: "Working on login feature",
  });

  console.log("✅ Created worktree activity");

  // 11. Agent Sessions
  const agentSessionId = "agent-session-001";
  await db.insert(schema.agentSessions).values({
    id: agentSessionId,
    repoId: "test-owner/test-repo",
    worktreePath: "/test/path/to/repo",
    branch: "feature/123-add-login",
    status: "running",
    pid: 12345,
    startedAt: now,
    lastSeenAt: now,
  });

  console.log(`✅ Created agent session (ID: ${agentSessionId})`);

  // 12. Terminal Sessions
  await db.insert(schema.terminalSessions).values({
    id: "terminal-session-001",
    repoId: "test-owner/test-repo",
    worktreePath: "/test/path/to/repo",
    pid: 54321,
    status: "running",
    lastOutput: "$ npm test\nRunning tests...",
    createdAt: now,
    updatedAt: now,
    lastUsedAt: now,
  });

  console.log("✅ Created terminal session");

  console.log("\n🎉 Seed data creation completed!");
}

async function main() {
  try {
    if (shouldClean) {
      await cleanDatabase();
    }

    await seedData();

    console.log("\n📊 Summary:");
    console.log("   - Database: " + DB_PATH);
    console.log("   - Mode: " + (shouldClean ? "Clean + Seed" : "Seed"));
    console.log("\n💡 Tip: Run with --clean to clear existing data before seeding");
  } catch (error) {
    console.error("❌ Error seeding data:", error);
    process.exit(1);
  }
}

main();
