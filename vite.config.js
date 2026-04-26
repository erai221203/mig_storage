import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // During `vite dev`, proxy API calls to `wrangler pages dev` running on 8788.
    // Run `npx wrangler pages dev dist --compatibility-date=2025-01-01` separately,
    // or just use `npm run pages:dev` to test the full stack.
    proxy: {
      "/api": "http://127.0.0.1:8788",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
