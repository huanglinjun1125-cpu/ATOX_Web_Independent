import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function files(dir) {
  const r = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) r.push(...(await files(p)));
    else r.push(p);
  }
  return r;
}
// Convert the inherited colored surfaces to a neutral palette. Semantic warning/error
// colors remain intact; brand accents use shared aliases instead of module palettes.
function color(s) {
  const h = s.slice(1);
  if (![3, 4, 6, 8].includes(h.length)) return s;
  const hex = h.length < 5 ? [...h].map((x) => x + x).join("") : h;
  const r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
  const a = hex.slice(6);
  if (b > r * 0.97 && b > g * 1.05 && b - g > 8) {
    const v = Math.round(0.26 * r + 0.5 * g + 0.24 * b);
    return (
      "#" +
      [v, v + Math.min(2, 255 - v), v]
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("") +
      a
    );
  }
  if (g > r * 1.02 && r > b * 1.25 && g - b > 50) {
    return "#ff665c" + a;
  }
  return s;
}
for (const file of [
  ...(await files(path.join(root, "src"))),
  ...(await files(path.join(root, "public"))),
]) {
  if (!/\.(css|svg)$/.test(file) || file.endsWith("brand.css")) continue;
  const before = await readFile(file, "utf8");
  const after = before
    .replace(/#[\da-fA-F]{3,8}\b/g, color)
    .replaceAll("HACKATHON", "ATOX");
  if (before !== after) await writeFile(file, after);
}
console.log(
  "Inherited module surfaces and public vectors now use the ATOX palette.",
);
