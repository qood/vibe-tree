import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register happy-dom globally
GlobalRegistrator.register();

import "@testing-library/jest-dom";
import { mock } from "bun:test";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: mock((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: mock(() => {}),
    removeListener: mock(() => {}),
    addEventListener: mock(() => {}),
    removeEventListener: mock(() => {}),
    dispatchEvent: mock(() => false),
  })),
});

// Mock clipboard API
Object.defineProperty(navigator, "clipboard", {
  writable: true,
  value: {
    writeText: mock(() => Promise.resolve(undefined)),
  },
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.OPEN;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(_url: string) {
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event("open"));
      }
    }, 0);
  }

  send(_data: string) {
    // Mock send
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent("close"));
    }
  }
}

(global as unknown as { WebSocket: typeof MockWebSocket }).WebSocket = MockWebSocket;
