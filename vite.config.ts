import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { devServerConfig } from "./src/config/devServerConfig";

export default defineConfig({
  plugins: [react()],
  server: devServerConfig,
  test: {
    environment: "jsdom",
    globals: true
  }
});
