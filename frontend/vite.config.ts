import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
// FHEVM @zama-fhe/sdk loads a multi-threaded WASM worker via a CDN blob.
// That requires a cross-origin-isolated context (SharedArrayBuffer),
// so we set COOP + COEP headers on the dev server AND in vercel.json (prod).
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1500,
  },
});
