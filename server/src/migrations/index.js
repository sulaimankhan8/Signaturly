import mongoose from "mongoose";
import * as plans2026 from "./001-plans-2026-10.js";
import * as workspaces2026 from "./002-workspaces-2026-10.js";

/**
 * Changes to stored data that go with a release, run once each, in order.
 *
 * A migration is a file exporting `name` and `up()`. `up` must be safe to run twice: the record
 * of what has run is written after it finishes, so a run interrupted halfway is repeated.
 * Run with `npm run migrate`.
 */
const MIGRATIONS = [plans2026, workspaces2026];

const appliedSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, appliedAt: { type: Date, default: Date.now }, result: { type: Object } });
export const AppliedMigration = mongoose.models.AppliedMigration || mongoose.model("AppliedMigration", appliedSchema);

export const runMigrations = async () => {
  const done = new Set((await AppliedMigration.find({}).lean()).map((row) => row.name));
  const ran = [];
  for (const migration of MIGRATIONS) {
    if (done.has(migration.name)) continue;
    const result = await migration.up();
    await AppliedMigration.create({ name: migration.name, result });
    ran.push({ name: migration.name, result });
  }
  return ran;
};
