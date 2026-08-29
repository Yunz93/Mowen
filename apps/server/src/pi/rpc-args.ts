export function buildPiRpcArgs(input: {
  approvalExtensionPath: string;
  trustProject: boolean;
  sessionPath?: string | null;
  sessionDir: string;
}): string[] {
  const args = ["--mode", "rpc", "--extension", input.approvalExtensionPath];
  args.push(input.trustProject ? "--approve" : "--no-approve");
  if (input.sessionPath) {
    args.push("--session", input.sessionPath);
  } else {
    args.push("--session-dir", input.sessionDir);
  }
  return args;
}
