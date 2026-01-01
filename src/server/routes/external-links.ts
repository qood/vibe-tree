import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { externalLinks } from "../../db/schema";
import { z } from "zod";
import { validateOrThrow } from "../../shared/validation";

export const externalLinksRouter = new Hono();

// Link type detection
function detectLinkType(url: string): string {
  if (url.includes("notion.so") || url.includes("notion.site")) {
    return "notion";
  }
  if (url.includes("figma.com")) {
    return "figma";
  }
  if (url.includes("github.com") && url.includes("/issues/")) {
    return "github_issue";
  }
  if (url.includes("github.com") && url.includes("/pull/")) {
    return "github_pr";
  }
  return "url";
}

// Fetch content from external URL
async function fetchLinkContent(url: string, linkType: string): Promise<{ title?: string; content?: string }> {
  try {
    // For now, use a simple fetch approach
    // In production, you'd want to use specific APIs for Notion, Figma, etc.

    if (linkType === "github_issue" || linkType === "github_pr") {
      // Parse GitHub URL and use GitHub API
      const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
      if (match) {
        const [, owner, repo, type, number] = match;
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/${type === "pull" ? "pulls" : "issues"}/${number}`;
        const response = await fetch(apiUrl, {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "vibe-tree",
            ...(process.env.GITHUB_TOKEN ? { "Authorization": `token ${process.env.GITHUB_TOKEN}` } : {}),
          },
        });
        if (response.ok) {
          const data = await response.json();
          return {
            title: data.title,
            content: `# ${data.title}\n\n${data.body || ""}\n\n---\nState: ${data.state}\nAuthor: ${data.user?.login || "unknown"}`,
          };
        }
      }
    }

    if (linkType === "notion") {
      // Notion requires API key and page ID extraction
      // For now, return a placeholder
      return {
        title: "Notion Page",
        content: `[Notion link: ${url}]\n\nNote: Full Notion content extraction requires NOTION_API_KEY configuration.`,
      };
    }

    if (linkType === "figma") {
      // Figma requires API key
      return {
        title: "Figma Design",
        content: `[Figma link: ${url}]\n\nNote: Full Figma content extraction requires FIGMA_TOKEN configuration.`,
      };
    }

    // Generic URL - try to fetch HTML and extract basic info
    const response = await fetch(url, {
      headers: { "User-Agent": "vibe-tree" },
    });
    if (response.ok) {
      const html = await response.text();
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;
      // Extract text content (very basic)
      const textContent = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2000);
      return { title, content: textContent };
    }
  } catch (error) {
    console.error("Failed to fetch link content:", error);
  }
  return {};
}

// Schema
const addLinkSchema = z.object({
  repoId: z.string().min(1),
  url: z.string().url(),
  title: z.string().optional(),
});

const updateLinkSchema = z.object({
  title: z.string().optional(),
});

// GET /api/external-links?repoId=xxx
externalLinksRouter.get("/", async (c) => {
  const repoId = c.req.query("repoId");
  if (!repoId) {
    return c.json({ error: "repoId is required" }, 400);
  }

  const links = await db
    .select()
    .from(externalLinks)
    .where(eq(externalLinks.repoId, repoId))
    .orderBy(externalLinks.createdAt);

  return c.json(links);
});

// POST /api/external-links - Add a new link
externalLinksRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { repoId, url, title } = validateOrThrow(addLinkSchema, body);

  const linkType = detectLinkType(url);
  const now = new Date().toISOString();

  // Fetch content
  const { title: fetchedTitle, content } = await fetchLinkContent(url, linkType);

  const [inserted] = await db
    .insert(externalLinks)
    .values({
      repoId,
      url,
      linkType,
      title: title || fetchedTitle || null,
      contentCache: content || null,
      lastFetchedAt: content ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(inserted, 201);
});

// POST /api/external-links/:id/refresh - Re-fetch content
externalLinksRouter.post("/:id/refresh", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  const [link] = await db
    .select()
    .from(externalLinks)
    .where(eq(externalLinks.id, id));

  if (!link) {
    return c.json({ error: "Link not found" }, 404);
  }

  const { title, content } = await fetchLinkContent(link.url, link.linkType);
  const now = new Date().toISOString();

  const [updated] = await db
    .update(externalLinks)
    .set({
      title: title || link.title,
      contentCache: content || link.contentCache,
      lastFetchedAt: now,
      updatedAt: now,
    })
    .where(eq(externalLinks.id, id))
    .returning();

  return c.json(updated);
});

// PATCH /api/external-links/:id - Update title
externalLinksRouter.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  const body = await c.req.json();
  const { title } = validateOrThrow(updateLinkSchema, body);

  const now = new Date().toISOString();

  const [updated] = await db
    .update(externalLinks)
    .set({
      title,
      updatedAt: now,
    })
    .where(eq(externalLinks.id, id))
    .returning();

  if (!updated) {
    return c.json({ error: "Link not found" }, 404);
  }

  return c.json(updated);
});

// DELETE /api/external-links/:id
externalLinksRouter.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid id" }, 400);
  }

  await db.delete(externalLinks).where(eq(externalLinks.id, id));
  return c.json({ success: true });
});

// GET /api/external-links/context?repoId=xxx - Get all link contents for Claude context
externalLinksRouter.get("/context", async (c) => {
  const repoId = c.req.query("repoId");
  if (!repoId) {
    return c.json({ error: "repoId is required" }, 400);
  }

  const links = await db
    .select()
    .from(externalLinks)
    .where(eq(externalLinks.repoId, repoId));

  // Build context string for Claude
  const contextParts = links
    .filter((link) => link.contentCache)
    .map((link) => {
      return `## ${link.title || link.linkType.toUpperCase()}\nSource: ${link.url}\n\n${link.contentCache}`;
    });

  return c.json({
    links,
    contextMarkdown: contextParts.length > 0
      ? `# External References\n\n${contextParts.join("\n\n---\n\n")}`
      : null,
  });
});
