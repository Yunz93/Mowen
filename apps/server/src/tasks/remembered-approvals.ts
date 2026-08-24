import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { rememberKey, type ApprovalRequest } from "@mowen/protocol";

export type RememberedGrant = {
  cwd: string;
  toolName: string;
  target: string;
  createdAt: string;
};

export class RememberedApprovals {
  private grants: RememberedGrant[] = [];

  constructor(private readonly dataDir: string) {}

  private filePath(): string {
    return path.join(this.dataDir, "approvals.json");
  }

  async load(): Promise<void> {
    try {
      const raw = await readFile(this.filePath(), "utf8");
      const parsed = JSON.parse(raw) as { grants?: RememberedGrant[] };
      this.grants = Array.isArray(parsed.grants) ? parsed.grants : [];
    } catch {
      this.grants = [];
    }
  }

  match(approval: ApprovalRequest): boolean {
    const key = rememberKey(approval.cwd, approval.toolName, approval.target);
    return this.grants.some((grant) => rememberKey(grant.cwd, grant.toolName, grant.target) === key);
  }

  async remember(approval: ApprovalRequest): Promise<void> {
    if (this.match(approval)) return;
    this.grants.push({
      cwd: approval.cwd,
      toolName: approval.toolName,
      target: approval.target,
      createdAt: new Date().toISOString(),
    });
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.filePath(), `${JSON.stringify({ grants: this.grants }, null, 2)}\n`, "utf8");
  }
}
