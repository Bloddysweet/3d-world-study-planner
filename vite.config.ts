import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";
import { cloudConfiguration } from "./src/auth/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createTargetsMiddleware, readAiConfig } from "./server/targets-api";
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const config = cloudConfiguration(
    env.VITE_SUPABASE_URL,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
  );
  // Fail before bundling a mistakenly supplied privileged key or partial setup.
  if (
    command === "build" &&
    (env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) &&
    config.error
  )
    throw new Error(config.error);
  return {
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
  };
});
