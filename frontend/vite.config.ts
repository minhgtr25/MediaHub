import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, "..", "");
  const backendEnv = loadEnv(mode, "../backend", "");
  const PORT = process.env.PORT ?? backendEnv.PORT ?? rootEnv.PORT ?? "5000";
  const apiTarget = `http://localhost:${PORT}`;

  return {
    plugins: [react()],
    envDir: "..",
    server: { proxy: { "/api": apiTarget } },
    preview: { proxy: { "/api": apiTarget } },
  };
});
