#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

if (process.argv.includes("--version")) {
  process.stdout.write("0.0.0-fake\n");
  process.exit(0);
}

const args = process.argv.slice(2);
let sessionPath = null;
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === "--session" && args[i + 1]) {
    sessionPath = args[i + 1];
  }
  if (args[i] === "--session-dir" && args[i + 1]) {
    sessionPath = path.join(args[i + 1], "fake-session.json");
  }
}

const state = {
  model: {
    id: "fake-model",
    name: "Fake Model",
    provider: "fake",
    reasoning: true,
  },
  thinkingLevel: "off",
  isStreaming: false,
  sessionFile: sessionPath,
  sessionId: "fake-session",
  messageCount: 0,
  pendingMessageCount: 0,
  messages: [],
  followUps: [],
  aborted: false,
  generationStamp: Date.now(),
};

if (sessionPath) {
  try {
    const raw = readFileSync(sessionPath, "utf8");
    state.messages = JSON.parse(raw);
  } catch {
    state.messages = [];
  }
}

function persist() {
  if (!sessionPath) return;
  mkdirSync(path.dirname(sessionPath), { recursive: true });
  writeFileSync(sessionPath, JSON.stringify(state.messages, null, 2));
}

function send(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
}

function respond(id, command, success, data, error) {
  const body = { id, type: "response", command, success };
  if (data !== undefined) body.data = data;
  if (error) body.error = error;
  send(body);
}

function now() {
  return Date.now();
}

const waiters = new Map();

function waitForUiResponse(id) {
  return new Promise((resolve) => {
    waiters.set(id, resolve);
  });
}

async function streamText(text) {
  send({
    type: "message_start",
    message: {
      role: "assistant",
      content: [],
      timestamp: now(),
    },
  });
  send({ type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 0 } });
  const parts = text.split(" ");
  const delayMs = text.includes("stream this slowly") ? 200 : 40;
  let acc = "";
  for (const part of parts) {
    if (state.aborted) break;
    acc += acc ? ` ${part}` : part;
    const delta = acc.endsWith(part) && acc !== part ? ` ${part}` : part;
    send({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta } });
    await new Promise((r) => setTimeout(r, delayMs));
  }
  send({
    type: "message_update",
    assistantMessageEvent: { type: "text_end", contentIndex: 0, content: acc },
  });
  const message = { role: "assistant", content: [{ type: "text", text: acc }], timestamp: now() };
  send({ type: "message_end", message });
  state.messages.push(message);
  persist();
}

async function runWrite(filePath, content) {
  const toolCallId = `call-write-${now()}`;
  send({
    type: "message_start",
    message: { role: "assistant", content: [], timestamp: now() },
  });
  send({
    type: "message_update",
    assistantMessageEvent: {
      type: "toolcall_end",
      contentIndex: 0,
      toolCall: { type: "toolCall", id: toolCallId, name: "write", arguments: { path: filePath, content } },
    },
  });
  send({
    type: "message_end",
    message: {
      role: "assistant",
      content: [{ type: "toolCall", id: toolCallId, name: "write", arguments: { path: filePath, content } }],
      timestamp: now(),
    },
  });
  send({ type: "tool_execution_start", toolCallId, toolName: "write", args: { path: filePath, content } });
  const requestId = `ui-${now()}`;
  const payload = {
    kind: "mypi.approval",
    toolName: "write",
    toolCallId,
    cwd: process.cwd(),
    target: filePath,
    risk: "This writes to the project filesystem. Review the path before allowing.",
  };
  send({
    type: "extension_ui_request",
    id: requestId,
    method: "confirm",
    title: "Allow write?",
    message: `Path:\n${filePath}\nWorking directory:\n${process.cwd()}\n${payload.risk}\n\nMYPI_APPROVAL_V1\n${JSON.stringify(payload)}`,
  });
  const response = await waitForUiResponse(requestId);
  const allowed = Boolean(response.confirmed) && !response.cancelled;
  if (allowed) {
    const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
    send({
      type: "tool_execution_end",
      toolCallId,
      toolName: "write",
      result: { content: [{ type: "text", text: `Wrote ${filePath}` }] },
      isError: false,
    });
  } else {
    send({
      type: "tool_execution_end",
      toolCallId,
      toolName: "write",
      result: { content: [{ type: "text", text: "Denied by user or timed out" }] },
      isError: true,
    });
  }
}

async function runBash(command) {
  const toolCallId = `call-bash-${now()}`;
  send({ type: "tool_execution_start", toolCallId, toolName: "bash", args: { command } });
  const requestId = `ui-${now()}`;
  const payload = {
    kind: "mypi.approval",
    toolName: "bash",
    toolCallId,
    cwd: process.cwd(),
    target: command,
    rawCommand: command,
    risk: "This command runs with your user privileges. MyPi does not try to guess whether Bash is safe.",
  };
  send({
    type: "extension_ui_request",
    id: requestId,
    method: "confirm",
    title: "Allow bash?",
    message: `Command:\n${command}\nWorking directory:\n${process.cwd()}\n${payload.risk}\n\nMYPI_APPROVAL_V1\n${JSON.stringify(payload)}`,
  });
  const response = await waitForUiResponse(requestId);
  const allowed = Boolean(response.confirmed) && !response.cancelled;
  send({
    type: "tool_execution_end",
    toolCallId,
    toolName: "bash",
    result: {
      content: [{ type: "text", text: allowed ? `ran: ${command}` : "Denied by user or timed out" }],
    },
    isError: !allowed,
  });
}

async function handlePrompt(message, mode) {
  state.aborted = false;
  state.isStreaming = true;
  send({ type: "agent_start" });
  send({ type: "turn_start" });
  const user = { role: "user", content: [{ type: "text", text: message }], timestamp: now() };
  send({ type: "message_start", message: user });
  send({ type: "message_end", message: user });
  state.messages.push(user);

  if (message.trim() === "CRASH") {
    process.exit(1);
  }

  try {
    if (message.startsWith("WRITE:")) {
      const rest = message.slice("WRITE:".length);
      const split = rest.indexOf(":");
      const filePath = rest.slice(0, split);
      const content = rest.slice(split + 1);
      await runWrite(filePath, content);
    } else if (message.startsWith("BASH:")) {
      await runBash(message.slice("BASH:".length));
    } else {
      const prefix = mode === "steer" ? "Steered: " : mode === "follow_up" ? "Follow-up: " : "Echo: ";
      await streamText(`${prefix}${message}`);
    }
  } finally {
    send({ type: "turn_end", message: { role: "assistant", content: [] }, toolResults: [] });
    send({ type: "agent_end", messages: state.messages, willRetry: false });
    send({ type: "agent_settled" });
    state.isStreaming = false;
    persist();
    const queued = state.followUps.splice(0);
    state.pendingMessageCount = 0;
    for (const queuedMessage of queued) {
      enqueuePrompt(queuedMessage, "follow_up");
    }
  }
}

let promptChain = Promise.resolve();

function enqueuePrompt(message, mode) {
  promptChain = promptChain.then(
    () => handlePrompt(message, mode),
    () => handlePrompt(message, mode),
  );
}

function handleLine(line) {
  if (!line.trim()) return;
  let parsed;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  if (parsed.type === "extension_ui_response") {
    const waiter = waiters.get(parsed.id);
    if (waiter) {
      waiters.delete(parsed.id);
      waiter(parsed);
    }
    return;
  }

  const id = parsed.id;
  const type = parsed.type;
  switch (type) {
    case "get_state":
      respond(id, type, true, {
        model: state.model,
        thinkingLevel: state.thinkingLevel,
        isStreaming: state.isStreaming,
        isCompacting: false,
        steeringMode: "one-at-a-time",
        followUpMode: "one-at-a-time",
        sessionFile: state.sessionFile,
        sessionId: state.sessionId,
        autoCompactionEnabled: true,
        messageCount: state.messages.length,
        pendingMessageCount: state.followUps.length,
      });
      break;
    case "get_messages":
      respond(id, type, true, { messages: state.messages });
      break;
    case "get_available_models":
      respond(id, type, true, { models: [state.model] });
      break;
    case "get_available_thinking_levels":
      respond(id, type, true, { levels: ["off", "low", "high"] });
      break;
    case "set_model":
      state.model = { ...state.model, provider: parsed.provider, id: parsed.modelId, name: parsed.modelId };
      respond(id, type, true, state.model);
      break;
    case "set_thinking_level":
      state.thinkingLevel = parsed.level;
      respond(id, type, true);
      break;
    case "prompt":
      respond(id, type, true);
      enqueuePrompt(parsed.message, "prompt");
      break;
    case "steer":
      respond(id, type, true);
      enqueuePrompt(parsed.message, "steer");
      break;
    case "follow_up":
      respond(id, type, true);
      if (state.isStreaming) {
        enqueuePrompt(parsed.message, "follow_up");
      } else {
        state.followUps.push(parsed.message);
        state.pendingMessageCount = state.followUps.length;
        send({ type: "queue_update", steering: [], followUp: [...state.followUps] });
      }
      break;
    case "abort":
      state.aborted = true;
      respond(id, type, true);
      break;
    case "compact":
      respond(id, type, true, { summary: "compacted", tokensBefore: 100, estimatedTokensAfter: 40 });
      break;
    case "get_session_stats":
      respond(id, type, true, {
        sessionFile: state.sessionFile,
        sessionId: state.sessionId,
        userMessages: state.messages.filter((m) => m.role === "user").length,
        assistantMessages: state.messages.filter((m) => m.role === "assistant").length,
        toolCalls: 0,
        totalMessages: state.messages.length,
        tokens: { input: 12, output: 8, cacheRead: 0, cacheWrite: 0, total: 20 },
        cost: 0.0012,
        contextUsage: { tokens: 20, contextWindow: 100000, percent: 1 },
      });
      break;
    default:
      respond(id, type, false, undefined, `Unknown command: ${type}`);
  }
}

const decoder = new StringDecoder("utf8");
let buffer = "";
process.stdin.on("data", (chunk) => {
  buffer += decoder.write(chunk);
  while (true) {
    const idx = buffer.indexOf("\n");
    if (idx === -1) break;
    let line = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 1);
    if (line.endsWith("\r")) line = line.slice(0, -1);
    handleLine(line);
  }
});

process.stdin.on("end", () => {
  buffer += decoder.end();
  if (buffer) handleLine(buffer);
});
