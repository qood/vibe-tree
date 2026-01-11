import { Hono } from "hono";
import { db, schema } from "../../db";
import { eq, and, desc } from "drizzle-orm";
import { broadcast } from "../ws";
import { z } from "zod";
import { validateOrThrow } from "../../shared/validation";
import { BadRequestError, NotFoundError } from "../middleware/error-handler";
import { getCachedOrFetch, invalidateCache } from "../lib/cache";
import { PerfTimer, PERF_ENABLED } from "../lib/perf";
import {
  fetchIssueGraphQL,
  fetchPRGraphQL,
  type BranchLinkIssueInfo,
  type BranchLinkPRInfo,
} from "../lib/github-api";

export const branchLinksRouter = new Hono();

// Cached versions of GitHub GraphQL API calls (60 second TTL)
const GITHUB_CACHE_TTL = 60_000;

async function fetchGitHubIssueInfoCached(
  repoId: string,
  issueNumber: number
): Promise<BranchLinkIssueInfo | null> {
  const cacheKey = `github:issue:${repoId}:${issueNumber}`;
  return getCachedOrFetch(
    cacheKey,
    () => fetchIssueGraphQL(repoId, issueNumber),
    GITHUB_CACHE_TTL
  );
}

async function fetchGitHubPRInfoCached(
  repoId: string,
  prNumber: number
): Promise<BranchLinkPRInfo | null> {
  const cacheKey = `github:pr:${repoId}:${prNumber}`;
  return getCachedOrFetch(
    cacheKey,
    () => fetchPRGraphQL(repoId, prNumber),
    GITHUB_CACHE_TTL
  );
}

// Validation schemas
const getBranchLinksSchema = z.object({
  repoId: z.string().min(1),
  branchName: z.string().min(1),
});

const createBranchLinkSchema = z.object({
  repoId: z.string().min(1),
  branchName: z.string().min(1),
  linkType: z.enum(["issue", "pr"]),
  url: z.string().url(),
  number: z.number().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
});

const updateBranchLinkSchema = z.object({
  title: z.string().optional(),
  status: z.string().optional(),
});

// GET /api/branch-links?repoId=...&branchName=...
branchLinksRouter.get("/", async (c) => {
  const query = validateOrThrow(getBranchLinksSchema, {
    repoId: c.req.query("repoId"),
    branchName: c.req.query("branchName"),
  });

  const links = await db
    .select()
    .from(schema.branchLinks)
    .where(
      and(
        eq(schema.branchLinks.repoId, query.repoId),
        eq(schema.branchLinks.branchName, query.branchName)
      )
    )
    .orderBy(desc(schema.branchLinks.createdAt));

  return c.json(links);
});

// POST /api/branch-links
branchLinksRouter.post("/", async (c) => {
  const perf = PERF_ENABLED ? new PerfTimer() : null;

  const body = await c.req.json();
  const input = validateOrThrow(createBranchLinkSchema, body);
  const now = new Date().toISOString();

  // Check for duplicate
  const [existing] = await (perf
    ? perf.measureDb("check-duplicate", () =>
        db
          .select()
          .from(schema.branchLinks)
          .where(
            and(
              eq(schema.branchLinks.repoId, input.repoId),
              eq(schema.branchLinks.branchName, input.branchName),
              eq(schema.branchLinks.url, input.url)
            )
          )
          .limit(1)
      )
    : db
        .select()
        .from(schema.branchLinks)
        .where(
          and(
            eq(schema.branchLinks.repoId, input.repoId),
            eq(schema.branchLinks.branchName, input.branchName),
            eq(schema.branchLinks.url, input.url)
          )
        )
        .limit(1));

  if (existing) {
    // Update existing link instead of creating duplicate
    await (perf
      ? perf.measureDb("update-existing", () =>
          db
            .update(schema.branchLinks)
            .set({
              title: input.title ?? existing.title,
              status: input.status ?? existing.status,
              updatedAt: now,
            })
            .where(eq(schema.branchLinks.id, existing.id))
        )
      : db
          .update(schema.branchLinks)
          .set({
            title: input.title ?? existing.title,
            status: input.status ?? existing.status,
            updatedAt: now,
          })
          .where(eq(schema.branchLinks.id, existing.id)));

    const [updated] = await db
      .select()
      .from(schema.branchLinks)
      .where(eq(schema.branchLinks.id, existing.id));

    broadcast({
      type: "branchLink.updated",
      repoId: input.repoId,
      data: updated,
    });

    perf?.log("POST /api/branch-links (update existing)");
    return c.json(updated);
  }

  // Fetch info from GitHub if we have a number
  let title = input.title ?? null;
  let status = input.status ?? null;
  let checksStatus: string | null = null;
  let reviewDecision: string | null = null;
  let checks: string | null = null;
  let labels: string | null = null;
  let reviewers: string | null = null;
  let projectStatus: string | null = null;

  if (input.number) {
    if (input.linkType === "issue") {
      const issueInfo = perf
        ? await perf.measureGitHubAsync("fetch-issue", () =>
            fetchGitHubIssueInfoCached(input.repoId, input.number!)
          )
        : await fetchGitHubIssueInfoCached(input.repoId, input.number);
      if (issueInfo) {
        title = issueInfo.title;
        status = issueInfo.status;
        labels = JSON.stringify(issueInfo.labels);
        projectStatus = issueInfo.projectStatus ?? null;
      }
    } else if (input.linkType === "pr") {
      const prInfo = perf
        ? await perf.measureGitHubAsync("fetch-pr", () =>
            fetchGitHubPRInfoCached(input.repoId, input.number!)
          )
        : await fetchGitHubPRInfoCached(input.repoId, input.number);
      if (prInfo) {
        title = prInfo.title;
        status = prInfo.status;
        checksStatus = prInfo.checksStatus;
        reviewDecision = prInfo.reviewDecision;
        checks = JSON.stringify(prInfo.checks);
        labels = JSON.stringify(prInfo.labels);
        reviewers = JSON.stringify(prInfo.reviewers);
        projectStatus = prInfo.projectStatus ?? null;
      }
    }
  }

  const result = await (perf
    ? perf.measureDb("insert-link", () =>
        db
          .insert(schema.branchLinks)
          .values({
            repoId: input.repoId,
            branchName: input.branchName,
            linkType: input.linkType,
            url: input.url,
            number: input.number ?? null,
            title,
            status,
            checksStatus,
            reviewDecision,
            checks,
            labels,
            reviewers,
            projectStatus,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
      )
    : db
        .insert(schema.branchLinks)
        .values({
          repoId: input.repoId,
          branchName: input.branchName,
          linkType: input.linkType,
          url: input.url,
          number: input.number ?? null,
          title,
          status,
          checksStatus,
          reviewDecision,
          checks,
          labels,
          reviewers,
          projectStatus,
          createdAt: now,
          updatedAt: now,
        })
        .returning());

  const link = result[0];
  if (!link) {
    throw new BadRequestError("Failed to create branch link");
  }

  broadcast({
    type: "branchLink.created",
    repoId: input.repoId,
    data: link,
  });

  perf?.log("POST /api/branch-links (create new)");
  return c.json(link, 201);
});

// PATCH /api/branch-links/:id
branchLinksRouter.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const body = await c.req.json();
  const input = validateOrThrow(updateBranchLinkSchema, body);
  const now = new Date().toISOString();

  const [existing] = await db
    .select()
    .from(schema.branchLinks)
    .where(eq(schema.branchLinks.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Branch link not found");
  }

  await db
    .update(schema.branchLinks)
    .set({
      title: input.title ?? existing.title,
      status: input.status ?? existing.status,
      updatedAt: now,
    })
    .where(eq(schema.branchLinks.id, id));

  const [updated] = await db
    .select()
    .from(schema.branchLinks)
    .where(eq(schema.branchLinks.id, id));

  broadcast({
    type: "branchLink.updated",
    repoId: existing.repoId,
    data: updated,
  });

  return c.json(updated);
});

// DELETE /api/branch-links/:id
branchLinksRouter.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const [existing] = await db
    .select()
    .from(schema.branchLinks)
    .where(eq(schema.branchLinks.id, id))
    .limit(1);

  if (!existing) {
    throw new NotFoundError("Branch link not found");
  }

  await db.delete(schema.branchLinks).where(eq(schema.branchLinks.id, id));

  broadcast({
    type: "branchLink.deleted",
    repoId: existing.repoId,
    data: { id },
  });

  return c.json({ success: true });
});

// POST /api/branch-links/:id/refresh - Re-fetch data from GitHub
// Use ?force=true to bypass cache
branchLinksRouter.post("/:id/refresh", async (c) => {
  const perf = PERF_ENABLED ? new PerfTimer() : null;
  const forceRefresh = c.req.query("force") === "true";

  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const [existing] = await (perf
    ? perf.measureDb("fetch-existing", () =>
        db
          .select()
          .from(schema.branchLinks)
          .where(eq(schema.branchLinks.id, id))
          .limit(1)
      )
    : db
        .select()
        .from(schema.branchLinks)
        .where(eq(schema.branchLinks.id, id))
        .limit(1));

  if (!existing) {
    throw new NotFoundError("Branch link not found");
  }

  if (!existing.number) {
    throw new BadRequestError("Cannot refresh link without number");
  }

  // Invalidate cache if force refresh
  if (forceRefresh) {
    if (existing.linkType === "issue") {
      invalidateCache(`github:issue:${existing.repoId}:${existing.number}`);
    } else {
      invalidateCache(`github:pr:${existing.repoId}:${existing.number}`);
    }
    perf?.recordCacheMiss();
  }

  const now = new Date().toISOString();
  let title = existing.title;
  let status = existing.status;
  let checksStatus = existing.checksStatus;
  let reviewDecision = existing.reviewDecision;
  let checks = existing.checks;
  let labels = existing.labels;
  let reviewers = existing.reviewers;
  let projectStatus = existing.projectStatus;

  if (existing.linkType === "issue") {
    const issueInfo = perf
      ? await perf.measureGitHubAsync("refresh-issue", () =>
          fetchGitHubIssueInfoCached(existing.repoId, existing.number!)
        )
      : await fetchGitHubIssueInfoCached(existing.repoId, existing.number);
    if (issueInfo) {
      title = issueInfo.title;
      status = issueInfo.status;
      labels = JSON.stringify(issueInfo.labels);
      projectStatus = issueInfo.projectStatus ?? null;
    }
  } else if (existing.linkType === "pr") {
    const prInfo = perf
      ? await perf.measureGitHubAsync("refresh-pr", () =>
          fetchGitHubPRInfoCached(existing.repoId, existing.number!)
        )
      : await fetchGitHubPRInfoCached(existing.repoId, existing.number);
    if (prInfo) {
      title = prInfo.title;
      status = prInfo.status;
      checksStatus = prInfo.checksStatus;
      reviewDecision = prInfo.reviewDecision;
      checks = JSON.stringify(prInfo.checks);
      labels = JSON.stringify(prInfo.labels);
      reviewers = JSON.stringify(prInfo.reviewers);
      projectStatus = prInfo.projectStatus ?? null;
    }
  }

  await (perf
    ? perf.measureDb("update-link", () =>
        db
          .update(schema.branchLinks)
          .set({
            title,
            status,
            checksStatus,
            reviewDecision,
            checks,
            labels,
            reviewers,
            projectStatus,
            updatedAt: now,
          })
          .where(eq(schema.branchLinks.id, id))
      )
    : db
        .update(schema.branchLinks)
        .set({
          title,
          status,
          checksStatus,
          reviewDecision,
          checks,
          labels,
          reviewers,
          projectStatus,
          updatedAt: now,
        })
        .where(eq(schema.branchLinks.id, id)));

  const [updated] = await db
    .select()
    .from(schema.branchLinks)
    .where(eq(schema.branchLinks.id, id));

  broadcast({
    type: "branchLink.updated",
    repoId: existing.repoId,
    data: updated,
  });

  perf?.log(`POST /api/branch-links/${id}/refresh`);
  return c.json(updated);
});
