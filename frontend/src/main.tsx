import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { enableApiMetrics, disableApiMetrics, getApiMetrics, logApiMetrics } from "./lib/api";

// Expose API metrics to browser console for performance testing
declare global {
  interface Window {
    apiMetrics: {
      enable: () => void;
      disable: () => void;
      get: () => ReturnType<typeof getApiMetrics>;
      log: () => void;
    };
  }
}

window.apiMetrics = {
  enable: enableApiMetrics,
  disable: disableApiMetrics,
  get: getApiMetrics,
  log: logApiMetrics,
};

// Log usage instructions
console.log(`
📊 API Performance Metrics Available!

Usage:
  window.apiMetrics.enable()  - Start tracking API calls
  window.apiMetrics.log()     - Show metrics summary
  window.apiMetrics.get()     - Get raw metrics data
  window.apiMetrics.disable() - Stop tracking

Example workflow:
  1. window.apiMetrics.enable()
  2. (Open a branch panel)
  3. window.apiMetrics.log()
`);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
