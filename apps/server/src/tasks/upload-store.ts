const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_TTL_MS = 15 * 60 * 1000;

type Upload = { mimeType: string; data: Buffer; createdAt: number };

export class UploadStore {
  private readonly uploads = new Map<string, Upload>();

  constructor(
    private readonly maxBytes = MAX_UPLOAD_BYTES,
    private readonly ttlMs = UPLOAD_TTL_MS,
  ) {}

  add(id: string, mimeType: string, data: Buffer): boolean {
    this.removeExpired();
    const usedBytes = [...this.uploads.values()].reduce((total, upload) => total + upload.data.byteLength, 0);
    if (usedBytes + data.byteLength > this.maxBytes) return false;
    this.uploads.set(id, { mimeType, data, createdAt: Date.now() });
    return true;
  }

  consume(ids: string[]): Array<{ mimeType: string; data: Buffer }> {
    this.removeExpired();
    const result: Array<{ mimeType: string; data: Buffer }> = [];
    for (const id of ids) {
      const upload = this.uploads.get(id);
      if (!upload) continue;
      this.uploads.delete(id);
      result.push({ mimeType: upload.mimeType, data: upload.data });
    }
    return result;
  }

  private removeExpired(now = Date.now()): void {
    for (const [id, upload] of this.uploads) {
      if (now - upload.createdAt >= this.ttlMs) this.uploads.delete(id);
    }
  }
}
