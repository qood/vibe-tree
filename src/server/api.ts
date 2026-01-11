/**
 * API routes definition for Hono RPC type inference
 * This file is separated from index.ts to avoid Bun runtime dependencies
 */
import { Hono } from "hono";
import { reposRouter } from "./routes/repos";
import { projectRulesRouter } from "./routes/project-rules";
import { planRouter } from "./routes/plan";
import { scanRouter } from "./routes/scan";
import { instructionsRouter } from "./routes/instructions";
import { treeSpecRouter } from "./routes/tree-spec";
import { repoPinsRouter } from "./routes/repo-pins";
import { aiRouter } from "./routes/ai";
import { chatRouter } from "./routes/chat";
import { branchRouter } from "./routes/branch";
import { termRouter } from "./routes/term";
import { requirementsRouter } from "./routes/requirements";
import { externalLinksRouter } from "./routes/external-links";
import { planningSessionsRouter } from "./routes/planning-sessions";
import { branchLinksRouter } from "./routes/branch-links";
import { systemRouter } from "./routes/system";

// API routes with type inference for RPC
export const apiRoutes = new Hono()
  .get("/health", (c) => c.json({ status: "ok" as const, timestamp: new Date().toISOString() }))
  .route("/repos", reposRouter)
  .route("/project-rules", projectRulesRouter)
  .route("/plan", planRouter)
  .route("/scan", scanRouter)
  .route("/instructions", instructionsRouter)
  .route("/tree-spec", treeSpecRouter)
  .route("/repo-pins", repoPinsRouter)
  .route("/ai", aiRouter)
  .route("/chat", chatRouter)
  .route("/branch", branchRouter)
  .route("/term", termRouter)
  .route("/requirements", requirementsRouter)
  .route("/external-links", externalLinksRouter)
  .route("/planning-sessions", planningSessionsRouter)
  .route("/branch-links", branchLinksRouter)
  .route("/system", systemRouter);

// Export type for Hono RPC client
export type ApiType = typeof apiRoutes;
