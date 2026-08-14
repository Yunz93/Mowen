import type { TaskStatus } from "@mypi/protocol";

export type MachineEvent =
  | "activate"
  | "pi_ready"
  | "spawn_failed"
  | "prompt_accepted"
  | "approval_request"
  | "approval_resolved"
  | "agent_settled"
  | "abort"
  | "abort_confirmed"
  | "pi_exit"
  | "restart"
  | "queued";

const transitions: Record<TaskStatus, Partial<Record<MachineEvent, TaskStatus>>> = {
  stopped: { activate: "booting", queued: "queued" },
  queued: { activate: "booting", pi_exit: "error" },
  booting: { pi_ready: "idle", spawn_failed: "error", pi_exit: "error", abort: "aborting" },
  idle: {
    prompt_accepted: "running",
    abort: "idle",
    pi_exit: "error",
    activate: "idle",
  },
  running: {
    approval_request: "waiting_approval",
    agent_settled: "idle",
    abort: "aborting",
    pi_exit: "error",
  },
  waiting_approval: {
    approval_resolved: "running",
    abort: "aborting",
    pi_exit: "error",
    agent_settled: "idle",
  },
  aborting: { abort_confirmed: "idle", pi_exit: "error", agent_settled: "idle" },
  error: { restart: "booting", activate: "booting" },
};

export function transition(status: TaskStatus, event: MachineEvent): TaskStatus {
  const next = transitions[status][event];
  if (!next) {
    throw new Error(`Illegal task transition: ${status} + ${event}`);
  }
  return next;
}

export function canTransition(status: TaskStatus, event: MachineEvent): boolean {
  return Boolean(transitions[status][event]);
}

export function isActiveProcessStatus(status: TaskStatus): boolean {
  return (
    status === "booting" ||
    status === "idle" ||
    status === "running" ||
    status === "waiting_approval" ||
    status === "aborting"
  );
}

export function isBusyStatus(status: TaskStatus): boolean {
  return status === "running" || status === "waiting_approval" || status === "aborting";
}
