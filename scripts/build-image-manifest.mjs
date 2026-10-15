// Generates content/images.json from the photo manifest table in content/images.md,
// so Convex (which can import JSON but not markdown) can look up alt text and sizes.
// Run after editing images.md:  node scripts/build-image-manifest.mjs
import { readFileSync, writeFileSync } from "node:fs";

const md = readFileSync(new URL("../content/images.md", import.meta.url), "utf8");
const images = {};
for (const line of md.split("\n")) {
  const cells = line.split("|").map((c) => c.trim());
  // | file | W × H | subject | alt | used for |
  if (cells.length < 6 || !/\.(jpe?g|png|webp|avif)$/i.test(cells[1])) continue;
  const size = /^(\d+)\s*×\s*(\d+)$/.exec(cells[2]);
  if (!size) throw new Error(`Bad size for ${cells[1]}: ${cells[2]}`);
  images[`/images/${cells[1]}`] = {
    alt: cells[4],
    width: Number(size[1]),
    height: Number(size[2]),
    subject: cells[3],
  };
}
writeFileSync(
  new URL("../content/images.json", import.meta.url),
  JSON.stringify(images, null, 2) + "\n",
);
console.log(`Wrote ${Object.keys(images).length} images to content/images.json`);
