/**
 * Screenshots the board previews in design/preview/ with headless Chromium and prints one JSON line per board.
 *
 * Project: zorasocial — Zora Agent Lab on the Groupon Partner Storefront API
 * Module:  design/gen/shots.js
 * Deps:    playwright (found through NODE_PATH), a Chromium binary named by ZAL_CHROME
 * Tested:  n/a (run after python3 design/gen/build.py lockup)
 *
 * node design/gen/shots.js [page]   page is top_deals, finder, price_truth, scorecard, deal or lockup
 */
import { createRequire } from "node:module";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const exe = process.env.ZAL_CHROME;
if (!exe) {
  console.error("shots.js: ZAL_CHROME is not set. Point it at a Chromium or chrome-headless-shell binary, and NODE_PATH at a node_modules that holds playwright.");
  process.exit(2);
}

// The repo is an ES module package; playwright comes from NODE_PATH, which only the CommonJS resolver reads.
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const here = dirname(fileURLToPath(import.meta.url));
const design = dirname(here);
const repo = dirname(design);
const previewDir = join(design, "preview");
const shotDir = join(previewDir, "shots");
const wanted = process.argv[2] ?? null;

function boardsOnDisk() {
  let files;
  try {
    files = readdirSync(previewDir).filter((f) => f.endsWith(".html"));
  } catch {
    console.error("shots.js: design/preview/ does not exist. Run python3 design/gen/build.py first.");
    process.exit(1);
  }
  return files
    .map((file) => {
      const html = readFileSync(join(previewDir, file), "utf8");
      const page = /<meta name="zal-page" content="([a-z_]+)">/.exec(html)?.[1] ?? null;
      const width = Number(/<div data-theme="[a-z]+" style="width: (\d+)px; height: (\d+)px/.exec(html)?.[1] ?? 0);
      const height = Number(/<div data-theme="[a-z]+" style="width: (\d+)px; height: (\d+)px/.exec(html)?.[2] ?? 0);
      return { file, name: file.replace(/\.html$/, ""), page, width, height };
    })
    .filter((b) => wanted === null || b.page === wanted);
}

const boards = boardsOnDisk();
if (boards.length === 0) {
  console.error(`shots.js: no preview belongs to ${wanted ?? "any page"}. Run python3 design/gen/build.py ${wanted ?? ""} first.`);
  process.exit(1);
}
for (const b of boards) {
  if (b.width !== 1280 && b.width !== 390) {
    console.error(`shots.js: ${b.name} has a root width of ${b.width}; boards are 1280 or 390 wide.`);
    process.exit(1);
  }
}

mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: exe });
let failed = false;
try {
  for (const b of boards) {
    const page = await browser.newPage({ viewport: { width: b.width, height: 900 } });
    await page.goto(pathToFileURL(join(previewDir, b.file)).href, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const m = await page.evaluate(() => {
      const root = document.querySelector("[data-theme]");
      const edge = root.getBoundingClientRect().right;
      // An element past the right edge counts only when no ancestor inside the board clips it on purpose.
      const clipped = (el) => {
        for (let p = el.parentElement; p && p !== root; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === "hidden" || o === "auto" || o === "clip" || o === "scroll") return true;
        }
        return false;
      };
      const offenders = [];
      for (const el of root.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > edge + 0.5 && !clipped(el)) {
          offenders.push(`${el.tagName.toLowerCase()} +${Math.round(r.right - edge)}px "${(el.textContent || "").trim().slice(0, 40)}"`);
        }
      }
      const fonts = [...new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")))];
      return {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        // The root clips at the stated height, so measure where its last block really ends.
        contentHeight: Math.ceil(Math.max(0, ...[...root.children].map((el) => el.getBoundingClientRect().bottom)) - root.getBoundingClientRect().top),
        overflowX: offenders.length,
        offenders: offenders.slice(0, 5),
        fonts,
      };
    });
    const shot = join(shotDir, `${b.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    await page.close();
    const clippedBottom = m.contentHeight > b.height;
    if (m.overflowX > 0 || m.scrollWidth > b.width) failed = true;
    console.log(JSON.stringify({ name: b.name, page: b.page, width: b.width, height: b.height, ...m, clippedBottom, shot: relative(repo, shot) }));
  }
} finally {
  await browser.close();
}
if (failed) {
  console.error("shots.js: at least one board is wider than its width; see overflowX and offenders above.");
  process.exit(1);
}
