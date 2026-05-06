import type { ServerOptions } from "vite";

export const devServerConfig = {
  host: "127.0.0.1",
  port: 5173,
  strictPort: true,
  hmr: {
    protocol: "ws",
    host: "127.0.0.1",
    clientPort: 5173,
  },
} satisfies ServerOptions;
