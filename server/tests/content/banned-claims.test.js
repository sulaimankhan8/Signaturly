import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Words the product must not use until the feature behind them exists (see the audit's claims table)
const BANNED = /merkle|blockchain|zero[- ]knowledge|immutab|notari[sz]ed|tamper-proof|court-admissible|forensic/i;

const ROOTS = ["../../src", "../../../client/src", "../../../admin/src"].map((p) => path.resolve(import.meta.dirname, p));
const SKIP = new Set(["scripts", "node_modules", "dist"]);

const sourceFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });

describe("product text makes no claim the code cannot back", () => {
  it("contains none of the banned words", () => {
    const hits = [];
    for (const file of ROOTS.flatMap(sourceFiles)) {
      fs.readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (BANNED.test(line)) hits.push(`${path.relative(process.cwd(), file)}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
    }
    expect(hits).toEqual([]);
  });
});
