import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type UserSettings = {
  workspaceRoot: string | null;
  setupCompletedAt: string | null;
  trustProject: boolean;
  autoCheckForUpdates: boolean;
  skippedUpdateVersion: string;
  lastUpdateCheckAt: string | null;
};

const EMPTY: UserSettings = {
  workspaceRoot: null,
  setupCompletedAt: null,
  trustProject: false,
  autoCheckForUpdates: true,
  skippedUpdateVersion: "",
  lastUpdateCheckAt: null,
};

export class SettingsStore {
  private settings: UserSettings = { ...EMPTY };

  constructor(private readonly dataDir: string) {}

  private filePath(): string {
    return path.join(this.dataDir, "settings.json");
  }

  async load(): Promise<UserSettings> {
    try {
      const raw = await readFile(this.filePath(), "utf8");
      const parsed = JSON.parse(raw) as Partial<UserSettings>;
      this.settings = {
        workspaceRoot: typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot : null,
        setupCompletedAt:
          typeof parsed.setupCompletedAt === "string" ? parsed.setupCompletedAt : null,
        trustProject: parsed.trustProject === true,
        autoCheckForUpdates: parsed.autoCheckForUpdates !== false,
        skippedUpdateVersion: typeof parsed.skippedUpdateVersion === "string" ? parsed.skippedUpdateVersion : "",
        lastUpdateCheckAt: typeof parsed.lastUpdateCheckAt === "string" ? parsed.lastUpdateCheckAt : null,
      };
    } catch {
      this.settings = { ...EMPTY };
    }
    return this.get();
  }

  get(): UserSettings {
    return { ...this.settings };
  }

  async save(patch: Partial<UserSettings>): Promise<UserSettings> {
    this.settings = {
      ...this.settings,
      ...patch,
    };
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.filePath(), `${JSON.stringify(this.settings, null, 2)}\n`, "utf8");
    return this.get();
  }
}
