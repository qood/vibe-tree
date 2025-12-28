import { describe, test, expect } from "bun:test";
import {
  createRepoSchema,
  updateBranchNamingSchema,
  startPlanSchema,
  updatePlanSchema,
  commitPlanSchema,
  scanSchema,
  logInstructionSchema,
  repoIdQuerySchema,
  restartPromptQuerySchema,
  validateOrThrow,
  ValidationError,
} from "../shared/validation";

describe("createRepoSchema", () => {
  test("accepts valid absolute path", () => {
    const result = createRepoSchema.safeParse({ path: "/Users/test/repo" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.path).toBe("/Users/test/repo");
    }
  });

  test("accepts path with optional name", () => {
    const result = createRepoSchema.safeParse({
      path: "/Users/test/repo",
      name: "my-repo",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("my-repo");
    }
  });

  test("rejects empty path", () => {
    const result = createRepoSchema.safeParse({ path: "" });
    expect(result.success).toBe(false);
  });

  test("rejects relative path", () => {
    const result = createRepoSchema.safeParse({ path: "relative/path" });
    expect(result.success).toBe(false);
  });

  test("rejects missing path", () => {
    const result = createRepoSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("updateBranchNamingSchema", () => {
  test("accepts valid input", () => {
    const result = updateBranchNamingSchema.safeParse({
      repoId: 1,
      pattern: "vt/{planId}/{taskSlug}",
      description: "Test description",
      examples: ["vt/1/feature"],
    });
    expect(result.success).toBe(true);
  });

  test("uses defaults for optional fields", () => {
    const result = updateBranchNamingSchema.safeParse({
      repoId: 1,
      pattern: "vt/{planId}/{taskSlug}",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBe("");
      expect(result.data.examples).toEqual([]);
    }
  });

  test("rejects invalid repoId", () => {
    const result = updateBranchNamingSchema.safeParse({
      repoId: 0,
      pattern: "vt/{planId}/{taskSlug}",
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative repoId", () => {
    const result = updateBranchNamingSchema.safeParse({
      repoId: -1,
      pattern: "vt/{planId}/{taskSlug}",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty pattern", () => {
    const result = updateBranchNamingSchema.safeParse({
      repoId: 1,
      pattern: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("startPlanSchema", () => {
  test("accepts valid input", () => {
    const result = startPlanSchema.safeParse({
      repoId: 1,
      title: "My Plan",
    });
    expect(result.success).toBe(true);
  });

  test("rejects empty title", () => {
    const result = startPlanSchema.safeParse({
      repoId: 1,
      title: "",
    });
    expect(result.success).toBe(false);
  });

  test("rejects too long title", () => {
    const result = startPlanSchema.safeParse({
      repoId: 1,
      title: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  test("accepts title at max length", () => {
    const result = startPlanSchema.safeParse({
      repoId: 1,
      title: "a".repeat(200),
    });
    expect(result.success).toBe(true);
  });
});

describe("updatePlanSchema", () => {
  test("accepts valid input", () => {
    const result = updatePlanSchema.safeParse({
      planId: 1,
      contentMd: "# Plan content",
    });
    expect(result.success).toBe(true);
  });

  test("uses default for missing contentMd", () => {
    const result = updatePlanSchema.safeParse({
      planId: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentMd).toBe("");
    }
  });

  test("rejects invalid planId", () => {
    const result = updatePlanSchema.safeParse({
      planId: 0,
      contentMd: "content",
    });
    expect(result.success).toBe(false);
  });
});

describe("commitPlanSchema", () => {
  test("accepts valid planId", () => {
    const result = commitPlanSchema.safeParse({ planId: 1 });
    expect(result.success).toBe(true);
  });

  test("rejects invalid planId", () => {
    const result = commitPlanSchema.safeParse({ planId: 0 });
    expect(result.success).toBe(false);
  });

  test("rejects missing planId", () => {
    const result = commitPlanSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("scanSchema", () => {
  test("accepts valid repoId", () => {
    const result = scanSchema.safeParse({ repoId: 1 });
    expect(result.success).toBe(true);
  });

  test("rejects invalid repoId", () => {
    const result = scanSchema.safeParse({ repoId: -1 });
    expect(result.success).toBe(false);
  });
});

describe("logInstructionSchema", () => {
  test("accepts valid user_instruction", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      kind: "user_instruction",
      contentMd: "Do something",
    });
    expect(result.success).toBe(true);
  });

  test("accepts valid director_suggestion", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      kind: "director_suggestion",
      contentMd: "Suggestion content",
    });
    expect(result.success).toBe(true);
  });

  test("accepts valid system_note", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      kind: "system_note",
      contentMd: "System note",
    });
    expect(result.success).toBe(true);
  });

  test("accepts optional fields", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      planId: 5,
      worktreePath: "/path/to/worktree",
      branchName: "feature-branch",
      kind: "user_instruction",
      contentMd: "Content",
    });
    expect(result.success).toBe(true);
  });

  test("rejects invalid kind", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      kind: "invalid_kind",
      contentMd: "Content",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty contentMd", () => {
    const result = logInstructionSchema.safeParse({
      repoId: 1,
      kind: "user_instruction",
      contentMd: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("repoIdQuerySchema", () => {
  test("coerces string to number", () => {
    const result = repoIdQuerySchema.safeParse({ repoId: "1" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repoId).toBe(1);
    }
  });

  test("accepts number directly", () => {
    const result = repoIdQuerySchema.safeParse({ repoId: 5 });
    expect(result.success).toBe(true);
  });

  test("rejects non-numeric string", () => {
    const result = repoIdQuerySchema.safeParse({ repoId: "abc" });
    expect(result.success).toBe(false);
  });

  test("rejects zero", () => {
    const result = repoIdQuerySchema.safeParse({ repoId: "0" });
    expect(result.success).toBe(false);
  });
});

describe("restartPromptQuerySchema", () => {
  test("accepts minimal input", () => {
    const result = restartPromptQuerySchema.safeParse({ repoId: "1" });
    expect(result.success).toBe(true);
  });

  test("accepts all optional fields", () => {
    const result = restartPromptQuerySchema.safeParse({
      repoId: "1",
      planId: "2",
      worktreePath: "/path/to/worktree",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.repoId).toBe(1);
      expect(result.data.planId).toBe(2);
      expect(result.data.worktreePath).toBe("/path/to/worktree");
    }
  });
});

describe("validateOrThrow", () => {
  test("returns data on success", () => {
    const result = validateOrThrow(createRepoSchema, { path: "/test/path" });
    expect(result.path).toBe("/test/path");
  });

  test("throws ValidationError on failure", () => {
    expect(() => {
      validateOrThrow(createRepoSchema, { path: "" });
    }).toThrow(ValidationError);
  });

  test("ValidationError has correct message", () => {
    try {
      validateOrThrow(createRepoSchema, {});
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).message).toContain("path");
    }
  });
});
