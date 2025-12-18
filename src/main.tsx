import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Force clients to pick up the latest bundle if their browser has cached an older build.
// Bump this string whenever we need to invalidate client-side caches.
const APP_BUILD_ID = "2025-12-18.1";
const BUILD_KEY = "dockmgmt_build_id";

try {
  const existing = localStorage.getItem(BUILD_KEY);
  if (existing !== APP_BUILD_ID) {
    localStorage.setItem(BUILD_KEY, APP_BUILD_ID);
    // Reload once to ensure the newest JS/CSS is loaded.
    window.location.reload();
  }
} catch {
  // If localStorage is unavailable, just continue.
}

createRoot(document.getElementById("root")!).render(<App />);

