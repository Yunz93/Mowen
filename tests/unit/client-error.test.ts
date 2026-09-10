import { describe, expect, it } from "vitest";
import { clientErrorMessage } from "../../apps/web/src/lib/client-error.ts";

describe("clientErrorMessage", () => {
  it("maps socket failures to Chinese copy", () => {
    expect(clientErrorMessage(new Error("Socket is not connected"))).toBe("还没连上服务，请稍后再发。");
    expect(clientErrorMessage(new Error("Socket closed"))).toBe("连接已断开，请稍后再发。");
    expect(clientErrorMessage(new Error("连接已断开。"))).toBe("连接已断开，请稍后再发。");
  });

  it("keeps server messages and uses a fallback for empty values", () => {
    expect(clientErrorMessage(new Error("模型不可用"))).toBe("模型不可用");
    expect(clientErrorMessage(undefined, "发送失败")).toBe("发送失败");
    expect(clientErrorMessage("[object Object]", "发送失败")).toBe("发送失败");
  });
});
