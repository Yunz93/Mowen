import { StringDecoder } from "node:string_decoder";
import type { Readable } from "node:stream";

export function serializeJsonLine(value: unknown): string {
  return `${JSON.stringify(value)}\n`;
}

export function splitJsonlChunk(
  buffer: string,
  chunk: string,
): { buffer: string; lines: string[] } {
  let next = buffer + chunk;
  const lines: string[] = [];
  while (true) {
    const newlineIndex = next.indexOf("\n");
    if (newlineIndex === -1) {
      return { buffer: next, lines };
    }
    let line = next.slice(0, newlineIndex);
    if (line.endsWith("\r")) {
      line = line.slice(0, -1);
    }
    lines.push(line);
    next = next.slice(newlineIndex + 1);
  }
}

export function attachJsonlLineReader(
  stream: Readable,
  onLine: (line: string) => void,
): () => void {
  const decoder = new StringDecoder("utf8");
  let buffer = "";

  const onData = (chunk: string | Buffer) => {
    const text = typeof chunk === "string" ? chunk : decoder.write(chunk);
    const split = splitJsonlChunk(buffer, text);
    buffer = split.buffer;
    for (const line of split.lines) {
      onLine(line);
    }
  };

  const onEnd = () => {
    buffer += decoder.end();
    if (buffer.length > 0) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
      onLine(line);
      buffer = "";
    }
  };

  stream.on("data", onData);
  stream.on("end", onEnd);

  return () => {
    stream.off("data", onData);
    stream.off("end", onEnd);
  };
}
