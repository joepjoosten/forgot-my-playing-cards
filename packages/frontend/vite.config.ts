import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves the app from /<repo-name>/ — set via BASE_PATH in CI.
  base: process.env.BASE_PATH ?? "/",
  // .env / .env.local live at the repo root (convex dev writes .env.local there).
  envDir: path.resolve(here, "../.."),
  envPrefix: ["VITE_", "CONVEX_"],
  resolve: {
    alias: {
      "@backend": path.resolve(here, "../backend"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(here, "index.html"),
        dev: path.resolve(here, "dev.html"),
      },
    },
  },
});
