// @ts-nocheck - Bun.serve routes API has type issues with BunFile
/// <reference types="bun-types" />

const BACKEND_URL = "http://localhost:3000";

// Import HTML file for Bun's bundler
const indexHtml = Bun.file("./index.html");

// Bun's HTML-first development server with proxy support
Bun.serve({
  port: 5173,
  development: {
    hmr: true,
    console: true,
  },
  async fetch(req) {
    const url = new URL(req.url);

    // Proxy /api requests to backend
    if (url.pathname.startsWith("/api")) {
      const backendUrl = `${BACKEND_URL}${url.pathname}${url.search}`;
      const headers = new Headers(req.headers);
      headers.set("host", new URL(BACKEND_URL).host);

      return fetch(backendUrl, {
        method: req.method,
        headers,
        body: req.body,
      });
    }

    // Proxy /ws WebSocket requests to backend
    if (url.pathname.startsWith("/ws")) {
      const backendWsUrl = `ws://localhost:3000${url.pathname}${url.search}`;
      const headers = new Headers(req.headers);
      headers.set("host", "localhost:3000");

      return fetch(backendWsUrl.replace("ws://", "http://"), {
        method: req.method,
        headers,
        body: req.body,
      });
    }

    // Return undefined to let Bun handle static files and HTML
    return undefined;
  },
  routes: {
    // Serve index.html for all non-API routes (SPA routing)
    "/*": indexHtml,
  },
});

console.log("Frontend dev server running at http://localhost:5173");
