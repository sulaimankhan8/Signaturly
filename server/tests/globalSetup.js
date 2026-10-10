import { MongoMemoryServer } from "mongodb-memory-server";
import fs from "fs";
import os from "os";
import path from "path";

let mongo;
let uploadsRoot;

// Starts one throwaway MongoDB and one temp storage folder for the whole run.
// Tests never touch a real database or the project's uploads folder.
export default async function setup({ provide }) {
  mongo = await MongoMemoryServer.create();
  uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pactdoc-test-"));

  provide("mongoUri", mongo.getUri("pactdoc_test"));
  provide("uploadsDir", path.join(uploadsRoot, "uploads"));

  return async () => {
    await mongo.stop();
    fs.rmSync(uploadsRoot, { recursive: true, force: true });
  };
}
