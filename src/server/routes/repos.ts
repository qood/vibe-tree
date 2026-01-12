import { Hono } from "hono";
import { NotFoundError } from "../middleware/error-handler";
import { getCachedOrFetch } from "../lib/cache";
import { fetchReposListGraphQL, fetchRepoViewGraphQL } from "../lib/github-api";
import type { RepoInfo } from "../lib/github-api";

// GET /api/repos - List repos from GitHub
const listRepos = new Hono().get("/", async (c) => {
  const limit = parseInt(c.req.query("limit") ?? "30");

  try {
    // Cache repos list for 5 minutes (GraphQL API call)
    const repos = await getCachedOrFetch<RepoInfo[]>(
      `repos:list:${limit}`,
      () => fetchReposListGraphQL(limit),
      5 * 60 * 1000, // 5 minutes TTL
    );

    return c.json(repos);
  } catch (error) {
    console.error("Failed to fetch repos:", error);
    return c.json(
      {
        error: "Failed to fetch repositories from GitHub API",
        code: "GH_FETCH_ERROR",
      },
      500,
    );
  }
});

// GET /api/repos/:owner/:name - Get single repo info
const getRepo = new Hono().get("/:owner/:name", async (c) => {
  const owner = c.req.param("owner");
  const name = c.req.param("name");
  const fullName = `${owner}/${name}`;

  const repo = await fetchRepoViewGraphQL(fullName);

  if (!repo) {
    throw new NotFoundError("Repo");
  }

  return c.json(repo);
});

// Export chained router for RPC type inference
export const reposRouter = new Hono().route("/", listRepos).route("/", getRepo);
