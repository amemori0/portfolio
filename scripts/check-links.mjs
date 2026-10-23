// dist/ の全HTMLから内部リンク(/ で始まる href と src)を集め、対応するファイルがあるかを調べる
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));

const listHtml = async dir => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(entry => (entry.isDirectory() ? listHtml(join(dir, entry.name)) : entry.name.endsWith(".html") ? [join(dir, entry.name)] : [])));
  return files.flat();
};

const exists = async path => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const missing = new Set();
for (const file of await listHtml(DIST)) {
  const html = await readFile(file, "utf8");
  for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"/][^"]*|\/)"/g)) {
    const path = decodeURI(url.split(/[?#]/)[0]);
    const target = path.endsWith("/") ? join(DIST, path, "index.html") : join(DIST, path);
    if (!(await exists(target))) missing.add(`${path} (in ${file.replace(DIST, "")})`);
  }
}

if (missing.size > 0) {
  console.error(`Missing ${missing.size} link(s):\n${[...missing].join("\n")}`);
  process.exit(1);
}
console.log("All internal links resolve.");
