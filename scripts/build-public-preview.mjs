import { build } from "esbuild";
import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, "assets"), { recursive: true });
await build({
  entryPoints: [path.join(root, "src/preview/client.tsx")],
  bundle: true,
  outfile: path.join(out, "assets/app.js"),
  minify: true,
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  alias: {
    "next/link": path.join(root, "src/preview/link.tsx"),
    "next/image": path.join(root, "src/preview/image.tsx"),
    "next/navigation": path.join(root, "src/preview/navigation.ts"),
  },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SITE_PREVIEW": '"true"',
  },
  logLevel: "info",
});
const sheets = [
  "src/app/globals.css",
  "src/components/site-header.css",
  "src/modules/homepage/styles.css",
  "src/modules/event-board/styles.css",
  "src/modules/project-board/styles.css",
  "src/modules/event-experience/styles.css",
  "src/components/brand.css",
];
const css = (
  await Promise.all(sheets.map((s) => readFile(path.join(root, s), "utf8")))
)
  .join("\n")
  .replace(/^@import\s+["']tailwindcss["'];/m, "");
await writeFile(path.join(out, "assets/site.css"), css);
await cp(path.join(root, "public"), out, { recursive: true });
const routes = [
  "/",
  "/events",
  "/projects",
  "/projects/submit",
  "/events/malaysia-ai-mvp-2026",
  "/login",
  "/account",
  "/events/demo",
  "/events/upcoming-demo",
  "/events/past-demo",
];
for (const route of routes) {
  const dir = path.join(out, route.slice(1));
  await mkdir(dir, { recursive: true });
  const isEvent = route.includes("malaysia-ai-mvp");
  const title = isEvent
    ? "Build AI That Matters — ATOX × TAMAPUSC at APU"
    : route === "/events"
      ? "Events — ATOX"
      : route === "/projects"
        ? "Projects — ATOX"
        : "ATOX 爱拓无限 — Connect the next";
  await writeFile(
    path.join(dir, "index.html"),
    `<!doctype html><html lang="${isEvent ? "en" : "zh-CN"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#090a0a"><title>${title}</title><meta name="description" content="ATOX AI youth ecosystem. Public website preview: explore events, projects and the proposed Malaysia AI and MVP Hackathon 2026."><link rel="icon" href="/brand/favicon.svg"><link rel="stylesheet" href="/assets/site.css"></head><body><div id="root"></div><noscript><main style="padding:48px;font:18px Arial;color:#f1f0e9"><h1>ATOX</h1><p>This interactive website preview needs JavaScript enabled.</p></main></noscript><script type="module" src="/assets/app.js"></script></body></html>`,
  );
}
await cp(path.join(out, "login/index.html"), path.join(out, "404.html"));
console.log(
  `Public preview: ${routes.length} routes. No backend credentials or private data included.`,
);
