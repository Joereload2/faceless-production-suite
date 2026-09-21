import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import manifest from "./manifest";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: { host: "127.0.0.1" },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
