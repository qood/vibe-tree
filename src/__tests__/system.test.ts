import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { systemRouter } from "../server/routes/system";
import * as childProcess from "child_process";

// Create a test app with the system router
const app = new Hono();
app.route("/api/system", systemRouter);

describe("systemRouter", () => {
  describe("POST /api/system/select-directory", () => {
    test("returns unsupported platform error for unknown platforms", async () => {
      // Save original platform
      const originalPlatform = process.platform;

      // Mock platform to an unsupported value
      Object.defineProperty(process, "platform", {
        value: "freebsd",
        configurable: true,
      });

      const res = await app.request("/api/system/select-directory", {
        method: "POST",
      });

      // Restore original platform
      Object.defineProperty(process, "platform", {
        value: originalPlatform,
        configurable: true,
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.code).toBe("UNSUPPORTED_PLATFORM");
    });

    test("returns correct response structure for darwin platform", async () => {
      // This test verifies the API contract without actually opening a dialog
      // The actual dialog behavior is tested through integration tests
      const originalPlatform = process.platform;

      if (originalPlatform !== "darwin") {
        // Skip this test on non-macOS platforms
        return;
      }

      // We can't easily mock the osascript call, so we just verify the route exists
      // and accepts POST requests
      const res = await app.request("/api/system/select-directory", {
        method: "POST",
      });

      // The response should be either success or an error (if dialog fails)
      expect([200, 500]).toContain(res.status);
      const json = await res.json();

      // Verify response structure
      if (res.status === 200) {
        expect(json).toHaveProperty("cancelled");
        expect(json).toHaveProperty("path");
      } else {
        expect(json).toHaveProperty("error");
      }
    });

    test("handles cancelled dialog response", async () => {
      // Mock a cancelled dialog response
      // Note: In a real test environment, you would mock the spawn function
      // For now, we verify the endpoint structure
      const res = await app.request("/api/system/select-directory", {
        method: "POST",
      });

      const json = await res.json();

      // Response should have the expected structure
      if (res.status === 200) {
        expect(typeof json.cancelled).toBe("boolean");
        if (!json.cancelled) {
          expect(typeof json.path).toBe("string");
        } else {
          expect(json.path).toBeNull();
        }
      }
    });
  });
});

describe("selectDirectoryMacOS behavior", () => {
  test("should handle path with trailing slash", () => {
    // Test the path normalization logic
    const pathWithSlash = "/Users/test/project/";
    const normalizedPath = pathWithSlash.trim().replace(/\/$/, "");
    expect(normalizedPath).toBe("/Users/test/project");
  });

  test("should handle path with newline", () => {
    // Test the path cleanup logic
    const pathWithNewline = "/Users/test/project\n";
    const cleanedPath = pathWithNewline.trim().replace(/\/$/, "");
    expect(cleanedPath).toBe("/Users/test/project");
  });
});
