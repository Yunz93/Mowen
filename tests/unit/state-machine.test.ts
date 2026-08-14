import { describe, expect, it } from "vitest";
import { canTransition, transition } from "../../apps/server/src/pi/state-machine.ts";

describe("task state machine", () => {
  it("follows the documented happy path", () => {
    let status = transition("stopped", "activate");
    expect(status).toBe("booting");
    status = transition(status, "pi_ready");
    expect(status).toBe("idle");
    status = transition(status, "prompt_accepted");
    expect(status).toBe("running");
    status = transition(status, "approval_request");
    expect(status).toBe("waiting_approval");
    status = transition(status, "approval_resolved");
    expect(status).toBe("running");
    status = transition(status, "agent_settled");
    expect(status).toBe("idle");
  });

  it("rejects illegal jumps", () => {
    expect(canTransition("idle", "approval_request")).toBe(false);
    expect(() => transition("idle", "approval_request")).toThrow(/Illegal task transition/);
  });
});
