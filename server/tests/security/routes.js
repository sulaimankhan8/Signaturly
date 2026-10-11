import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Every route the API serves, read from the route files themselves.
 *
 * The access tests are generated from this list, so a route added later is in them from the
 * day it is written: a new route that nobody has classified makes the suite fail.
 *
 * It reads `routes/index.js` for where each router is mounted and each router file for its
 * `router.<method>("path", ...)` calls. A route declared any other way would be missed, which
 * is why the test also checks that every route file was mounted and yielded at least one route.
 */

const ROUTES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../src/routes");
const read = (file) => fs.readFileSync(path.join(ROUTES_DIR, file), "utf8");

// Routers mounted outside routes/index.js, in app.js
const MOUNTED_IN_APP = { "webhook.routes.js": "/api/webhooks" };

const join = (prefix, route) => `${prefix}${route === "/" ? "" : route}`.replace(/\/+/g, "/");

export const mounts = () => {
  const index = read("index.js");
  const fileOf = Object.fromEntries([...index.matchAll(/import\s+(\w+)\s+from\s+"\.\/([\w.]+\.js)"/g)].map((m) => [m[1], m[2]]));
  const found = [...index.matchAll(/router\.use\(\s*"([^"]+)"\s*,\s*(\w+)\s*\)/g)].map((m) => ({ prefix: `/api${m[1]}`, file: fileOf[m[2]] }));
  return [...found, ...Object.entries(MOUNTED_IN_APP).map(([file, prefix]) => ({ prefix, file }))];
};

export const routeFiles = () => fs.readdirSync(ROUTES_DIR).filter((file) => file.endsWith(".routes.js"));

export const discoverRoutes = () => {
  const routes = [{ method: "GET", path: "/api/health", file: "index.js" }];
  for (const { prefix, file } of mounts()) {
    const source = read(file);
    for (const match of source.matchAll(/router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g)) {
      routes.push({ method: match[1].toUpperCase(), path: join(prefix, match[2]), file });
    }
  }
  return routes;
};

export const keyOf = (route) => `${route.method} ${route.path}`;
