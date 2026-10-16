// Writes the public pages out as ready-made HTML after `vite build` (plan task P3-14).
//
// What it produces in dist/:
//   index.html             the landing page, served at "/"
//   pricing/index.html     and one folder per other public page
//   t/index.html, t/<key>/ the ready-made templates, when the API can be reached (see below)
//   app.html               the empty shell every other route (dashboard, signing, ...) starts from
//   sitemap.xml            the same list of pages
//
// The host must send unknown paths to /app.html (see vercel.json). The shell must stay empty:
// if the landing page were the fallback, a signer would see it flash before their document.
//
// Template pages are built from the API's public list, read from VITE_API_BASE_URL while the
// site is being built. If the API cannot be reached, the build goes on without them and says so:
// the pages then still work in the app, but a search engine sees them empty until the next build.
//
// The script checks its own output and exits with an error when a page comes out empty,
// so a broken public page fails the build instead of reaching search engines.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, loadEnv } from "vite";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrOut = path.join(root, "dist-ssr");
const SITE_URL = (process.env.VITE_SITE_URL || "https://pactdoc.com").replace(/\/$/, "");

const escapeHtml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// What a reader without scripts or styles is left with
const visibleText = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const fail = (message) => {
  console.error(`prerender: ${message}`);
  process.exit(1);
};

const shellPath = path.join(dist, "index.html");
if (!fs.existsSync(shellPath)) fail("dist/index.html not found. Run `vite build` first.");
// Link previews (WhatsApp, Slack, social sites) load the share image only from a full address
const shell = fs.readFileSync(shellPath, "utf8").replace('content="/og-image.png"', `content="${SITE_URL}/og-image.png"`);
if (!shell.includes('<div id="root"></div>')) fail('dist/index.html has no empty <div id="root"></div> to fill.');

// Build the public pages for Node, with every dependency bundled in so nothing is resolved at run time
await build({
  root,
  logLevel: "warn",
  build: { ssr: "src/prerender.jsx", outDir: ssrOut, emptyOutDir: true },
  ssr: { noExternal: true },
});

const { PAGES: FIXED_PAGES, render, templatePages } = await import(pathToFileURL(path.join(ssrOut, "prerender.js")).href);

// The templates on offer right now, from the API this site talks to
const fetchTemplates = async () => {
  // The same address the app itself is built with: from the environment, or from the .env files Vite reads
  const api = (process.env.VITE_API_BASE_URL || loadEnv("production", root, "VITE_").VITE_API_BASE_URL || "").replace(/\/+$/, "");
  if (!api) return { templates: [], why: "VITE_API_BASE_URL is not set" };
  try {
    const res = await fetch(`${api}/api/public/templates`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return { templates: [], why: `the API answered ${res.status}` };
    return { templates: (await res.json()).data || [] };
  } catch (error) {
    return { templates: [], why: `the API at ${api} could not be reached (${error.cause?.code || error.name})` };
  }
};

const { templates, why } = await fetchTemplates();
if (why) console.warn(`prerender: template pages skipped: ${why}`);
else if (templates.length === 0) console.warn("prerender: template pages skipped: no template is on offer yet");
if (process.env.PRERENDER_REQUIRE_TEMPLATES && templates.length === 0) fail("template pages were required but none could be built.");

// The price list, for the pricing page
const fetchPlans = async () => {
  const api = (process.env.VITE_API_BASE_URL || loadEnv("production", root, "VITE_").VITE_API_BASE_URL || "").replace(/\/+$/, "");
  if (!api) return null;
  try {
    const res = await fetch(`${api}/api/public/plans`, { signal: AbortSignal.timeout(8000) });
    return res.ok ? (await res.json()).data : null;
  } catch {
    return null;
  }
};
const plans = await fetchPlans();
if (!plans) console.warn("prerender: the pricing page was written without prices: the API could not be reached");

const PAGES = [
  ...FIXED_PAGES.map((page) => (page.usesPlans && plans ? { ...page, plans, data: plans, dataId: "public-pricing-data", contains: "₹299" } : page)),
  ...templatePages(templates),
];

const withHead = (html, page) => {
  const url = `${SITE_URL}${page.path === "/" ? "/" : page.path}`;
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${description}" />`)
    .replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${title}" />`)
    .replace(/<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${description}" />`)
    .replace("</head>", `  <link rel="canonical" href="${url}" />\n    <meta property="og:url" content="${url}" />\n  </head>`);
};

// The empty shell is kept under its own name before index.html becomes the landing page
fs.writeFileSync(path.join(dist, "app.html"), shell);

const written = [];
for (const page of PAGES) {
  let markup;
  try {
    markup = render(page);
  } catch (error) {
    fail(`${page.path} could not be rendered: ${error.stack || error.message}`);
  }

  const text = visibleText(markup);
  if (text.length < 400) fail(`${page.path} rendered almost nothing (${text.length} characters of text).`);
  if (!text.includes(page.contains)) fail(`${page.path} does not contain "${page.contains}".`);

  // Data the page was rendered from travels with it, so the app does not fetch it a second time
  const data = page.data
    ? `<script id="${page.dataId || "public-template-data"}" type="application/json">${JSON.stringify(page.data).replace(/</g, "\\u003c")}</script>`
    : "";
  const html = withHead(shell.replace('<div id="root"></div>', `<div id="root">${markup}</div>${data}`), page);
  const target = page.path === "/" ? path.join(dist, "index.html") : path.join(dist, page.path.slice(1), "index.html");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html);
  written.push({ page, target, characters: text.length });
}

const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...PAGES.map(
      (page) =>
        `  <url>\n    <loc>${SITE_URL}${page.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${page.priority}</priority>\n  </url>`
    ),
    "</urlset>",
    "",
  ].join("\n")
);

fs.rmSync(ssrOut, { recursive: true, force: true });

for (const { page, target, characters } of written.filter(({ page }) => !page.path.startsWith("/t/"))) {
  console.log(`prerender: ${page.path.padEnd(12)} -> ${path.relative(root, target)} (${characters} characters of text)`);
}
if (templates.length > 0) console.log(`prerender: /t/<key>     -> ${templates.length} template pages`);
console.log(`prerender: app shell   -> ${path.join("dist", "app.html")}; sitemap with ${PAGES.length} pages`);
