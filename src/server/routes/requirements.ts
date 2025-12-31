import { Hono } from "hono";
import { eq, desc } from "drizzle-orm";
import { db, schema } from "../../db";
import { BadRequestError, NotFoundError } from "../middleware/error-handler";

export const requirementsRouter = new Hono();

export type NoteType = "prd" | "notion" | "memo" | "task_breakdown";

export interface RequirementsNote {
  id: number;
  repoId: string;
  planId: number | null;
  noteType: NoteType;
  title: string | null;
  content: string;
  notionUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// GET /api/requirements?repoId=xxx - Get all requirements notes for a repo
requirementsRouter.get("/", async (c) => {
  const repoId = c.req.query("repoId");
  if (!repoId) {
    throw new BadRequestError("repoId is required");
  }

  const notes = await db
    .select()
    .from(schema.requirementsNotes)
    .where(eq(schema.requirementsNotes.repoId, repoId))
    .orderBy(desc(schema.requirementsNotes.updatedAt));

  return c.json(notes);
});

// GET /api/requirements/:id - Get a single note
requirementsRouter.get("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const notes = await db
    .select()
    .from(schema.requirementsNotes)
    .where(eq(schema.requirementsNotes.id, id))
    .limit(1);

  if (!notes[0]) {
    throw new NotFoundError(`Note not found: ${id}`);
  }

  return c.json(notes[0]);
});

// POST /api/requirements - Create a new note
requirementsRouter.post("/", async (c) => {
  const body = await c.req.json();
  const { repoId, planId, noteType, title, content, notionUrl } = body;

  if (!repoId || !noteType) {
    throw new BadRequestError("repoId and noteType are required");
  }

  // At least one of content or notionUrl must be provided
  if (!content && !notionUrl) {
    throw new BadRequestError("Either content or notionUrl is required");
  }

  const validTypes: NoteType[] = ["prd", "notion", "memo", "task_breakdown"];
  if (!validTypes.includes(noteType)) {
    throw new BadRequestError(`Invalid noteType. Must be one of: ${validTypes.join(", ")}`);
  }

  const now = new Date().toISOString();
  const result = await db
    .insert(schema.requirementsNotes)
    .values({
      repoId,
      planId: planId || null,
      noteType,
      title: title || null,
      content: content || "",
      notionUrl: notionUrl || null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return c.json(result[0], 201);
});

// PUT /api/requirements/:id - Update a note
requirementsRouter.put("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const body = await c.req.json();
  const { noteType, title, content, notionUrl } = body;

  const existing = await db
    .select()
    .from(schema.requirementsNotes)
    .where(eq(schema.requirementsNotes.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new NotFoundError(`Note not found: ${id}`);
  }

  const now = new Date().toISOString();
  const updateData: Partial<typeof schema.requirementsNotes.$inferInsert> = {
    updatedAt: now,
  };

  if (noteType !== undefined) updateData.noteType = noteType;
  if (title !== undefined) updateData.title = title;
  if (content !== undefined) updateData.content = content;
  if (notionUrl !== undefined) updateData.notionUrl = notionUrl;

  const result = await db
    .update(schema.requirementsNotes)
    .set(updateData)
    .where(eq(schema.requirementsNotes.id, id))
    .returning();

  return c.json(result[0]);
});

// DELETE /api/requirements/:id - Delete a note
requirementsRouter.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new BadRequestError("Invalid id");
  }

  const existing = await db
    .select()
    .from(schema.requirementsNotes)
    .where(eq(schema.requirementsNotes.id, id))
    .limit(1);

  if (!existing[0]) {
    throw new NotFoundError(`Note not found: ${id}`);
  }

  await db
    .delete(schema.requirementsNotes)
    .where(eq(schema.requirementsNotes.id, id));

  return c.json({ success: true });
});

// POST /api/requirements/parse-tasks - Parse tasks from content
requirementsRouter.post("/parse-tasks", async (c) => {
  const body = await c.req.json();
  const { content } = body;

  if (!content) {
    throw new BadRequestError("content is required");
  }

  // Simple task parsing: look for lines starting with - or * or numbered lists
  const lines = content.split("\n");
  const tasks: { title: string; description?: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match markdown list items: - item, * item, 1. item, 1) item
    const match = trimmed.match(/^(?:[-*]|\d+[.)]) +(.+)$/);
    if (match) {
      tasks.push({ title: match[1].trim() });
    }
  }

  return c.json({ tasks });
});
