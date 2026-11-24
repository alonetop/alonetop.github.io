import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const dist = path.resolve("dist");
const base = (process.env.BASE_PATH || "/").replace(/\/$/, "");
const origin = process.env.SITE_URL || "https://example.com";

async function walk(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map(async (e) =>
        e.isDirectory()
          ? walk(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}

const files = await walk(dist);
const htmlFiles = files.filter((f) => f.endsWith(".html"));

for (const required of [
  "index.html",
  "404.html",
  "zh/index.html",
  "en/index.html",
  "zh/writing/index.html",
  "en/writing/index.html",
  "zh/about/index.html",
  "en/about/index.html",
  "fonts/ascii-rest-mono.woff2",
]) {
  assert(
    files.includes(path.join(dist, required)),
    `Missing generated asset/page: ${required}`,
  );
}

const errors = [];
let checked = 0;

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const relative = path.relative(dist, file).replaceAll(path.sep, "/");
  const route =
    relative === "404.html"
      ? "/404.html"
      : `/${relative.replace(/index\.html$/, "")}`;
  const current = new URL(`${base}${route}`, origin);

  for (const match of html.matchAll(/(?:href|src)="([^"#]+)"/g)) {
    const raw = match[1].replaceAll("&amp;", "&");
    if (/^(data:|mailto:|tel:|javascript:)/.test(raw)) continue;
    const link = new URL(raw, current);
    if (link.origin !== new URL(origin).origin) continue;
    if (base && !link.pathname.startsWith(`${base}/`)) {
      errors.push(`${relative}: missing base in ${raw}`);
      continue;
    }
    let target = path.join(
      dist,
      decodeURIComponent(link.pathname.slice(base.length)),
    );
    if (link.pathname.endsWith("/")) target = path.join(target, "index.html");
    try {
      const s = await stat(target);
      if (s.isDirectory()) await stat(path.join(target, "index.html"));
      checked++;
    } catch {
      errors.push(`${relative}: broken ${raw}`);
    }
  }

  if (relative !== "index.html") {
    assert.equal(
      (html.match(/id="intro-screen"/g) || []).length,
      1,
      `${relative}: missing shared intro`,
    );
    assert.match(
      html,
      /ascii-rest-mono\.woff2/,
      `${relative}: missing self-hosted ASCII font declaration`,
    );
  }

  if (
    relative === "zh/index.html" ||
    relative === "en/index.html" ||
    relative === "zh/about/index.html" ||
    relative === "en/about/index.html" ||
    relative === "404.html"
  ) {
    assert.match(
      html,
      /data-ascii-piece=/,
      `${relative}: expected SSR ASCII art container`,
    );
    assert.match(
      html,
      /<pre class="ascii-stage/,
      `${relative}: expected static SSR ASCII first frame`,
    );
  }

  if (relative.includes("/posts/")) {
    assert.match(html, /data-pagefind-body/);
    assert.match(html, /rel="canonical"/);
    assert.match(html, /hreflang=/);
  }
}

for (const lang of ["zh", "en"]) {
  const feed = await readFile(path.join(dist, lang, "rss.xml"), "utf8");
  const articleCount = htmlFiles.filter((f) =>
    path
      .relative(dist, f)
      .replaceAll(path.sep, "/")
      .startsWith(`${lang}/posts/`),
  ).length;
  assert.equal(
    (feed.match(/<item>/g) || []).length,
    articleCount,
    `${lang}: feed and article counts differ`,
  );
  assert(!feed.includes("undefined"), "Invalid RSS");
  if (articleCount) {
    assert(
      feed.includes(`${origin}${base}/${lang}/posts/`),
      "RSS lacks origin or base",
    );
    assert(
      files.some((f) => f.includes(`pagefind.${lang}_`)),
      `Missing ${lang} search index`,
    );
  }
}

assert(
  files.some((f) => f.endsWith("pagefind.js")),
  "Missing search runtime",
);
assert.equal(errors.length, 0, errors.join("\n"));
console.log(
  `Verified ${htmlFiles.length} HTML pages, ${checked} internal links/assets, ASCII SSR frames, bilingual RSS, metadata, and search indexes (base: ${base || "/"}).`,
);
