import { spawn } from "node:child_process";
import { mkdir, rm, writeFile, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { attachJsonlLineReader, serializeJsonLine } from "../apps/server/src/pi/rpc-framer.ts";

async function main(): Promise<void> {
  const root = path.join(os.tmpdir(), `mypi-smoke-${Date.now()}`);
  const project = path.join(root, "project");
  await mkdir(project, { recursive: true });
  await writeFile(path.join(project, "README.md"), "smoke");
  const target = path.join(project, "should-not-exist.txt");

  const child = spawn(
    "pi",
    [
      "--mode",
      "rpc",
      "--no-session",
      "--no-extensions",
      "--extension",
      path.resolve("apps/server/extensions/approval.ts"),
    ],
    {
      cwd: project,
      env: {
        ...process.env,
        MYPI_MUTATIONS: "approval",
        MYPI_ALLOWED_ROOTS: project,
      },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const lines: string[] = [];
  attachJsonlLineReader(child.stdout!, (line) => {
    if (line.trim()) lines.push(line);
  });

  const send = (obj: object) => child.stdin!.write(serializeJsonLine(obj));
  const waitFor = async (pred: (line: string) => boolean, timeout = 20_000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (lines.some(pred)) return lines.find(pred)!;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`smoke timeout. last lines:\n${lines.slice(-8).join("\n")}`);
  };

  send({ id: "1", type: "get_state" });
  await waitFor((line) => line.includes('"command":"get_state"'));

  send({ id: "2", type: "set_thinking_level", level: "off" });
  await waitFor((line) => line.includes("set_thinking_level"));

  send({
    id: "3",
    type: "prompt",
    message: "Reply with exactly the text SMOKE_OK and do not call tools.",
  });
  await waitFor((line) => line.includes("text_delta") || line.includes("SMOKE_OK"));
  await waitFor((line) => line.includes("agent_settled"));

  send({
    id: "4",
    type: "prompt",
    message: `You must call the write tool now. Create the file ${target} with the exact contents smoke-write. Do not only reply.`,
  });
  const ui = await waitFor((line) => line.includes("extension_ui_request") || line.includes("tool_execution_start"), 30_000);
  if (ui.includes("extension_ui_request")) {
    const parsed = JSON.parse(ui) as { id: string };
    send({ type: "extension_ui_response", id: parsed.id, confirmed: false, cancelled: true });
  }
  await waitFor((line) => line.includes("agent_settled"), 30_000);

  let existed = true;
  try {
    await access(target);
  } catch {
    existed = false;
  }
  child.kill("SIGTERM");
  await rm(root, { recursive: true, force: true });
  if (existed) {
    throw new Error("Write file existed after denied approval");
  }
  console.log("smoke:real passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
