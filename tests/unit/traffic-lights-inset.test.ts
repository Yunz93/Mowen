import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cssPath = path.resolve("apps/web/src/styles/app.css");

function stripLayer(source: string, layerName: string): { layered: string; rest: string } {
  const marker = `@layer ${layerName}`;
  const start = source.indexOf(marker);
  if (start < 0) return { layered: "", rest: source };
  let i = source.indexOf("{", start);
  if (i < 0) return { layered: "", rest: source };
  let depth = 0;
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          layered: source.slice(start, i + 1),
          rest: source.slice(0, start) + source.slice(i + 1),
        };
      }
    }
  }
  return { layered: source.slice(start), rest: source.slice(0, start) };
}

describe("macOS traffic-light inset", () => {
  it("is declared outside @layer components so Tailwind px/pl utilities cannot cover the lights", () => {
    const css = readFileSync(cssPath, "utf8");
    const { layered, rest } = stripLayer(css, "components");
    expect(layered).not.toMatch(/\.traffic-inline/);
    expect(rest).toMatch(
      /html\.desktop\[data-platform="darwin"\]\s+\.traffic-inline\s*\{[^}]*padding-left:\s*var\(--traffic-lights-inset\)/,
    );
    expect(rest).toMatch(/--traffic-lights-inset:\s*80px/);
  });
});
