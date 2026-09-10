import { afterEach, describe, expect, it, vi } from "vitest";
import { SocketClient } from "../../apps/web/src/transport/socket-client.ts";

describe("socket client reconnect", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps retrying when the session bootstrap request fails", async () => {
    vi.useFakeTimers();
    const fetchSession = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    vi.stubGlobal("fetch", fetchSession);
    const client = new SocketClient();

    await client.connect();
    expect(fetchSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fetchSession).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(fetchSession).toHaveBeenCalledTimes(3);
    client.disconnect();
  });
});
