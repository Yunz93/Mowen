#!/usr/bin/env node
/**
 * Publish-time helper matching 墨知: emit latest.json next to SHA256SUMS.txt
 * so the app checks `releases/latest/download/latest.json` instead of the GitHub API.
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  buildQingzhouLatestJson,
  changelogNotesForVersion,
  normalizeReleaseTag,
  parseSha256Sums,
} from "../apps/server/src/setup/qingzhou-update.ts";

const tagArg = process.argv[2];
const repo = process.argv[3] || process.env.GITHUB_REPOSITORY || "Yunz93/Qingzhou";
const sumsPath = process.argv[4] || "dist/SHA256SUMS.txt";
const outPath = process.argv[5] || "dist/latest.json";
const changelogPath = process.argv[6];

if (!tagArg) {
  console.error("usage: write-latest-json.ts <tag> [repo] [SHA256SUMS] [out] [CHANGELOG]");
  process.exit(1);
}

const tag = normalizeReleaseTag(tagArg);
const notes = changelogPath
  ? changelogNotesForVersion(readFileSync(changelogPath, "utf8"), tag)
  : "";
const latest = buildQingzhouLatestJson({
  repo,
  tag,
  sums: parseSha256Sums(readFileSync(sumsPath, "utf8")),
  notes,
});
writeFileSync(outPath, `${JSON.stringify(latest, null, 2)}\n`);
console.log(`wrote ${outPath} for ${tag}`);
