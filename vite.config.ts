import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTargetsMiddleware, readAiConfig } from "./server/targets-api";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "private-targets-api",
      configureServer(server) {
        server.middlewares.use(createTargetsMiddleware(readAiConfig()));
      },
    },
  ],
  server: { host: "0.0.0.0", port: 5173, allowedHosts: true },
  preview: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: true,
    proxy: { "/api/targets": "http://127.0.0.1:3001" },
  },
  // Prebundle the optional rig cloner at startup, not on the first World visit.
  // Late dependency discovery otherwise reloads the embedded preview iframe.
  optimizeDeps: { include: ["three/examples/jsm/utils/SkeletonUtils.js"] },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "server/**/*.test.ts"],
  },
  build: { chunkSizeWarningLimit: 1100 },
});
