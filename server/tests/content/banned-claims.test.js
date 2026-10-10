import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Words the product must not use until the feature behind them exists (see the audit's claims table)
const BANNED = /merkle|blockchain|zero[- ]knowledge|immutab|notari[sz]ed|tamper-proof|court-admissible|forensic/i;

// Plan task P3-12: the product is PactDoc everywhere.
const OLD_NAME = /signaturly/i;
// The one allowed mention is the configuration check that still rejects the old default admin key
const OLD_NAME_ALLOWED = ["config/env.js"];

const ROOTS = ["../../src", "../../../client/src", "../../../admin/src"].map((p) => path.resolve(import.meta.dirname, p));
const SKIP = new Set(["scripts", "node_modules", "dist"]);

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });

const linesMatching = (pattern, isAllowed = () => false) => {
  const hits = [];
  for (const file of ROOTS.flatMap(sourceFiles)) {
    const normalized = file.split(path.sep).join("/");
    if (isAllowed(normalized)) continue;

    fs.readFileSync(file, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
      });
  }
  return hits;
};

describe("product text makes no claim the code cannot back", () => {
  it("contains none of the banned words", () => {
    expect(linesMatching(BANNED)).toEqual([]);
  });
});

describe("the old product name is gone", () => {
  it("does not appear in any shipped source file", () => {
    expect(linesMatching(OLD_NAME, (file) => OLD_NAME_ALLOWED.some((allowed) => file.endsWith(allowed)))).toEqual([]);
  });
});
