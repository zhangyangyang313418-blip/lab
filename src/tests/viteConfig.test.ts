import { describe, expect, it } from "vitest";
import { devServerConfig } from "../config/devServerConfig";

describe("Vite dev server configuration", () => {
  it("pins HMR to the same local endpoint so the browser does not repeatedly reconnect", () => {
    expect(devServerConfig.host).toBe("127.0.0.1");
    expect(devServerConfig.port).toBe(5173);
    expect(devServerConfig.strictPort).toBe(true);
    expect(devServerConfig.hmr).toMatchObject({
      protocol: "ws",
      host: "127.0.0.1",
      clientPort: 5173,
    });
  });
});
