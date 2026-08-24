export type DiffLine = {
  type: "equal" | "add" | "remove";
  text: string;
};

function at(grid: number[][], row: number, col: number): number {
  return grid[row]?.[col] ?? 0;
}

export function unifiedDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const n = oldLines.length;
  const m = newLines.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      const row = dp[i];
      if (!row) continue;
      row[j] = oldLines[i] === newLines[j] ? at(dp, i + 1, j + 1) + 1 : Math.max(at(dp, i + 1, j), at(dp, i, j + 1));
    }
  }
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (oldLines[i] === newLines[j]) {
      lines.push({ type: "equal", text: oldLines[i] ?? "" });
      i += 1;
      j += 1;
    } else if (at(dp, i + 1, j) >= at(dp, i, j + 1)) {
      lines.push({ type: "remove", text: oldLines[i] ?? "" });
      i += 1;
    } else {
      lines.push({ type: "add", text: newLines[j] ?? "" });
      j += 1;
    }
  }
  while (i < n) {
    lines.push({ type: "remove", text: oldLines[i] ?? "" });
    i += 1;
  }
  while (j < m) {
    lines.push({ type: "add", text: newLines[j] ?? "" });
    j += 1;
  }
  return lines;
}

export function diffFromApproval(input: {
  oldText?: string;
  newText?: string;
  content?: string;
}): DiffLine[] | null {
  if (typeof input.oldText === "string" && typeof input.newText === "string") {
    return unifiedDiff(input.oldText, input.newText);
  }
  if (typeof input.content === "string") {
    return unifiedDiff("", input.content);
  }
  return null;
}
