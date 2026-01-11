import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
  spyOn,
  mock,
} from "bun:test";
import * as childProcess from "child_process";
import type { PRInfo } from "../../shared/types";
import { fetchPRsGraphQL } from "../server/lib/github-api";

// Token cache TTL is 5 minutes
const TOKEN_CACHE_TTL = 5 * 60 * 1000;

// Mock response for successful PR fetch
function createMockPRResponse(prs: Parameters<typeof createMockPR>[0][]) {
  return {
    data: {
      repository: {
        pullRequests: {
          nodes: prs.map(createMockPR),
        },
      },
    },
  };
}

function createMockPR(data: {
  number: number;
  title: string;
  state?: "OPEN" | "CLOSED" | "MERGED";
  headRefName?: string;
  isDraft?: boolean;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  reviewDecision?: string | null;
  labels?: string[];
  assignees?: string[];
  statusCheckState?: string | null;
}) {
  return {
    number: data.number,
    title: data.title,
    state: data.state ?? "OPEN",
    url: `https://github.com/owner/repo/pull/${data.number}`,
    headRefName: data.headRefName ?? `feature/pr-${data.number}`,
    isDraft: data.isDraft ?? false,
    additions: data.additions ?? 10,
    deletions: data.deletions ?? 5,
    changedFiles: data.changedFiles ?? 3,
    reviewDecision: data.reviewDecision ?? null,
    labels: {
      nodes: (data.labels ?? []).map((name) => ({ name })),
    },
    assignees: {
      nodes: (data.assignees ?? []).map((login) => ({ login })),
    },
    commits: {
      nodes: [
        {
          commit: {
            statusCheckRollup: data.statusCheckState
              ? { state: data.statusCheckState }
              : null,
          },
        },
      ],
    },
  };
}

describe("fetchPRsGraphQL", () => {
  let execSyncSpy: ReturnType<typeof spyOn>;
  let originalFetch: typeof fetch;
  let fetchMock: ReturnType<typeof mock>;
  let consoleErrorSpy: ReturnType<typeof spyOn>;
  let originalDateNow: typeof Date.now;
  let mockNow: number;

  // Base time that increments between tests to ensure fresh token cache
  let testBaseTime = 1000000000;

  beforeEach(() => {
    // Increment base time by more than 2x TTL to ensure fresh cache for each test
    // (Some tests advance mockNow by TTL, so we need extra margin)
    testBaseTime += 2 * TOKEN_CACHE_TTL + 10000;
    mockNow = testBaseTime;

    // Mock Date.now first (before any execSync calls)
    originalDateNow = Date.now;
    Date.now = () => mockNow;

    // Mock execSync
    execSyncSpy = spyOn(childProcess, "execSync");

    // Mock fetch
    originalFetch = globalThis.fetch;
    fetchMock = mock(() => Promise.resolve(new Response()));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    // Mock console.error to keep test output clean
    consoleErrorSpy = spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    execSyncSpy.mockRestore();
    globalThis.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
    Date.now = originalDateNow;
  });

  describe("Normal cases", () => {
    test("fetches PR list successfully", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([
        {
          number: 1,
          title: "Test PR",
          state: "OPEN",
          headRefName: "feature/test",
          labels: ["bug", "priority"],
          assignees: ["user1", "user2"],
          statusCheckState: "SUCCESS",
          reviewDecision: "APPROVED",
        },
      ]);

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result: PRInfo[] = await fetchPRsGraphQL("owner/repo");

      expect(result).toHaveLength(1);
      expect(result[0]?.number).toBe(1);
      expect(result[0]?.title).toBe("Test PR");
      expect(result[0]?.state).toBe("OPEN");
      expect(result[0]?.branch).toBe("feature/test");
      expect(result[0]?.labels).toEqual(["bug", "priority"]);
      expect(result[0]?.assignees).toEqual(["user1", "user2"]);
      expect(result[0]?.checks).toBe("SUCCESS");
      expect(result[0]?.reviewDecision).toBe("APPROVED");
    });

    test("returns empty array when no PRs exist", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([]);

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
    });

    test("maps all PR fields correctly", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([
        {
          number: 42,
          title: "Add new feature",
          state: "MERGED",
          headRefName: "feature/awesome",
          isDraft: true,
          additions: 100,
          deletions: 50,
          changedFiles: 10,
          reviewDecision: "CHANGES_REQUESTED",
          labels: ["enhancement"],
          assignees: ["dev1"],
          statusCheckState: "FAILURE",
        },
      ]);

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result: PRInfo[] = await fetchPRsGraphQL("owner/repo");

      expect(result[0]).toMatchObject({
        number: 42,
        title: "Add new feature",
        state: "MERGED",
        url: "https://github.com/owner/repo/pull/42",
        branch: "feature/awesome",
        isDraft: true,
        additions: 100,
        deletions: 50,
        changedFiles: 10,
        reviewDecision: "CHANGES_REQUESTED",
        labels: ["enhancement"],
        assignees: ["dev1"],
        checks: "FAILURE",
      });
    });

    test("does not set checks field when statusCheckRollup is null", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([
        {
          number: 1,
          title: "PR without checks",
          statusCheckState: null,
        },
      ]);

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result: PRInfo[] = await fetchPRsGraphQL("owner/repo");

      expect(result[0]?.checks).toBeUndefined();
    });

    test("sends correct headers and request body", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([]);
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      await fetchPRsGraphQL("owner/repo");

      expect(fetchMock).toHaveBeenCalledTimes(1);

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

      expect(url).toBe("https://api.github.com/graphql");
      expect(options.method).toBe("POST");
      expect(options.headers).toMatchObject({
        Authorization: "Bearer ghp_test_token",
        "Content-Type": "application/json",
        "User-Agent": "vibe-tree",
      });

      const body = JSON.parse(options.body as string);
      expect(body.variables).toEqual({
        owner: "owner",
        repo: "repo",
        first: 50,
      });
    });
  });

  describe("Error cases", () => {
    test("returns empty array when token is not available", async () => {
      execSyncSpy.mockImplementation(() => {
        throw new Error("gh: not logged in");
      });

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "GitHub token not available"
      );
    });

    test("returns empty array for invalid repoId (no slash)", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const result = await fetchPRsGraphQL("invalidrepo");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Invalid repoId format:",
        "invalidrepo"
      );
    });

    test("returns empty array for invalid repoId (too many slashes)", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const result = await fetchPRsGraphQL("owner/repo/extra");

      expect(result).toEqual([]);
    });

    test("returns empty array for empty repoId", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const result = await fetchPRsGraphQL("");

      expect(result).toEqual([]);
    });

    test("returns empty array on HTTP error", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response("Unauthorized", {
            status: 401,
            statusText: "Unauthorized",
          })
        )
      );

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "GitHub API error:",
        401,
        "Unauthorized"
      );
    });

    test("returns empty array on network error", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      fetchMock.mockImplementation(() =>
        Promise.reject(new Error("Network error"))
      );

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "fetchPRsGraphQL error:",
        expect.any(Error)
      );
    });

    test("returns empty array on GraphQL error", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = {
        errors: [{ message: "Repository not found" }],
      };

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith("GraphQL errors:", [
        { message: "Repository not found" },
      ]);
    });

    test("returns empty array when response structure is invalid", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      // Response with missing data.repository
      const mockResponse = { data: {} };

      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await fetchPRsGraphQL("owner/repo");

      expect(result).toEqual([]);
    });
  });

  describe("Token cache behavior", () => {
    test("caches token and does not call execSync again within TTL", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([]);
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      // First call - should call execSync
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(1);

      // Second call within TTL (advance time by 1 minute)
      mockNow += 60 * 1000;
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    test("refetches token after TTL expires", async () => {
      execSyncSpy.mockImplementation(() => "ghp_test_token\n");

      const mockResponse = createMockPRResponse([]);
      fetchMock.mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify(mockResponse), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      // First call
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(1);

      // Advance time by more than TTL (5 minutes + 1ms)
      mockNow += TOKEN_CACHE_TTL + 1;

      // Second call after TTL - should call execSync again
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(2);
    });

    test("caches null token on error and does not retry within TTL", async () => {
      execSyncSpy.mockImplementation(() => {
        throw new Error("gh: not logged in");
      });

      // First call - should fail and cache null
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(1);

      // Second call within TTL - should use cached null
      mockNow += 60 * 1000;
      await fetchPRsGraphQL("owner/repo");
      expect(execSyncSpy).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
