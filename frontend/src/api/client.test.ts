import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";
import { ConnectionConfig, HealthResponse } from "./types";

const connection: ConnectionConfig = {
  id: "test",
  name: "Test Gateway",
  mode: "local",
  apiBaseUrl: "http://gateway.test",
  wsBaseUrl: "ws://gateway.test",
  token: "wrong-token",
  createdAt: "2026-04-26T00:00:00.000Z",
  updatedAt: "2026-04-26T00:00:00.000Z",
};

const health: HealthResponse = {
  ok: true,
  gateway: "running",
  mode: "local",
  localMode: true,
  hermesDashboard: "available",
  hermesCommandAvailable: true,
  ptySupported: true,
  nativeWindowsExperimental: false,
  version: "0.1.0",
  time: "2026-04-26T00:00:00.000Z",
  message: "Gateway is running",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("ApiClient connection test", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects when health is public but the protected endpoint rejects the token", async () => {
    const client = new ApiClient();
    client.setConfig(connection);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/health")) return jsonResponse(health);
      if (url.endsWith("/api/server/info")) {
        return jsonResponse(
          { error: "auth_failed", message: "Invalid or missing token", details: {} },
          401,
        );
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(client.testConnection()).rejects.toMatchObject({
      error: "auth_failed",
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://gateway.test/api/server/info",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
  });
});
