import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { onErrorHandler } from "./middleware/error-handler";
import { perfLoggerMiddleware } from "./middleware/perf-logger";
import { ptyManager } from "./pty-manager";
import { handleWsMessage, addClient, removeClient, type WSClient } from "./ws";
import { startCacheGC } from "./lib/cache";
import { apiRoutes } from "./api";

// Base app with middleware
const baseApp = new Hono()
  .use("*", logger())
  .use("*", perfLoggerMiddleware)
  .use(
    "/api/*",
    cors({
      origin: ["http://localhost:5173", "http://localhost:3000"],
      credentials: true,
    }),
  )
  .onError(onErrorHandler);

// Mount API routes
const app = baseApp.route("/api", apiRoutes);

// 404 handler for API routes
app.notFound((c) => {
  return c.json({ error: "Not found", code: "NOT_FOUND" }, 404);
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

console.log(`Starting Vibe Tree server...`);

// WebSocket data type
type WsData = { type: "main" } | { type: "term"; sessionId: string };

// Terminal WebSocket clients map
const terminalClients = new Map<WebSocket, { sessionId: string; unsubscribe: () => void }>();

Bun.serve<WsData>({
  port,
  fetch(req, server) {
    const url = new URL(req.url);

    // Handle WebSocket upgrade for main ws
    if (url.pathname === "/ws") {
      const upgraded = server.upgrade(req, { data: { type: "main" } });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Handle WebSocket upgrade for terminal
    if (url.pathname === "/ws/term") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) {
        return new Response("sessionId required", { status: 400 });
      }
      const upgraded = server.upgrade(req, { data: { type: "term", sessionId } });
      if (upgraded) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Handle HTTP requests with Hono
    return app.fetch(req);
  },
  websocket: {
    open(ws) {
      if (ws.data.type === "term") {
        const sessionId = ws.data.sessionId;
        console.log(`Terminal WebSocket connected for session: ${sessionId}`);

        // Subscribe to PTY output
        const unsubscribe = ptyManager.onData(sessionId, (output) => {
          try {
            ws.send(JSON.stringify({ type: "data", data: output }));
          } catch {
            // Client disconnected
          }
        });

        // Subscribe to PTY exit
        const unsubscribeExit = ptyManager.onExit(sessionId, (code) => {
          try {
            ws.send(JSON.stringify({ type: "exit", code }));
          } catch {
            // Client disconnected
          }
        });

        terminalClients.set(ws as unknown as WebSocket, {
          sessionId,
          unsubscribe: () => {
            unsubscribe();
            unsubscribeExit();
          },
        });

        // Send current buffer if any
        const buffer = ptyManager.getOutputBuffer(sessionId);
        if (buffer) {
          ws.send(JSON.stringify({ type: "data", data: buffer }));
        }
      } else {
        addClient(ws as unknown as WSClient);
        console.log("WebSocket client connected");
      }
    },
    message(ws, message) {
      if (ws.data.type === "term") {
        const sessionId = ws.data.sessionId;
        try {
          const msg = JSON.parse(message.toString());
          if (msg.type === "input") {
            ptyManager.write(sessionId, msg.data);
          } else if (msg.type === "resize") {
            ptyManager.resize(sessionId, msg.cols, msg.rows);
          }
        } catch {
          // Invalid message
        }
      } else {
        handleWsMessage(ws as unknown as WSClient, message);
      }
    },
    close(ws) {
      if (ws.data.type === "term") {
        const client = terminalClients.get(ws as unknown as WebSocket);
        if (client) {
          client.unsubscribe();
          terminalClients.delete(ws as unknown as WebSocket);
        }
        console.log(`Terminal WebSocket disconnected for session: ${ws.data.sessionId}`);
      } else {
        removeClient(ws as unknown as WSClient);
        console.log("WebSocket client disconnected");
      }
    },
  },
});

console.log(`Server running at http://localhost:${port}`);
console.log(`WebSocket available at ws://localhost:${port}/ws`);

// Start cache garbage collector
startCacheGC();
console.log("Cache garbage collector started");
