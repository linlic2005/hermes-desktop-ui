import { describe, expect, it, vi } from "vitest";
import { replaceWebSocket } from "../lib/websocket";

describe("replaceWebSocket", () => {
  it("closes and detaches the previous socket before replacing it", () => {
    const previous = {
      readyState: 1,
      close: vi.fn(),
      onopen: vi.fn(),
      onmessage: vi.fn(),
      onerror: vi.fn(),
      onclose: vi.fn(),
    };
    const next = { readyState: 0, close: vi.fn() };
    const ref = { current: previous };

    replaceWebSocket(ref as never, next as never);

    expect(previous.onopen).toBeNull();
    expect(previous.onmessage).toBeNull();
    expect(previous.onerror).toBeNull();
    expect(previous.onclose).toBeNull();
    expect(previous.close).toHaveBeenCalledWith(1000);
    expect(ref.current).toBe(next);
  });
});
