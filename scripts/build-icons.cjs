// Builds app/favicon.ico, app/icon.png and app/apple-icon.png from the SE monogram
// in public/images/selems-logo.png. Run from the project root:
//   node scripts/build-icons.cjs . <preview-dir>
const path = require("node:path");
const fs = require("node:fs");
const root = process.argv[2], out = process.argv[3];
const sharp = require(require.resolve("sharp", { paths: [require.resolve("next", { paths: [root] })] }));
const logo = path.join(root, "public/images/selems-logo.png");
(async () => {
  // 1. The SE monogram lives in the white area at the far left. Find its bounds.
  // The buffalo's horn reaches into this area; the monogram is only orange and
  // blue, so paint near-black, low-saturation pixels white before trimming.
  const { data, info: raw } = await sharp(logo).extract({ left: 0, top: 0, width: 440, height: 541 }).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += raw.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // Black horn, its grey anti-aliasing and the white ground are all unsaturated;
    // the orange S and blue E (and their soft edges) are strongly coloured.
    if (max - min < 50) { data[i] = data[i + 1] = data[i + 2] = 255; }
  }
  const left = await sharp(data, { raw: { width: raw.width, height: raw.height, channels: raw.channels } }).png().toBuffer();
  const { info } = await sharp(left).trim({ background: "#ffffff", threshold: 40 }).toBuffer({ resolveWithObject: true });
  console.log("monogram bounds:", info.trimOffsetLeft, info.trimOffsetTop, info.width, info.height);
  const mono = await sharp(left).extract({ left: -info.trimOffsetLeft, top: -info.trimOffsetTop, width: info.width, height: info.height }).toBuffer();
  // 2. Square, white, with breathing room.
  const side = Math.round(Math.max(info.width, info.height) * 1.22);
  const square = await sharp({ create: { width: side, height: side, channels: 4, background: "#ffffff" } })
    .composite([{ input: mono, gravity: "center" }]).png().toBuffer();
  fs.writeFileSync(path.join(out, "monogram-preview.png"), await sharp(square).resize(256).png().toBuffer());
  const app = path.join(root, "app");
  fs.writeFileSync(path.join(app, "icon.png"), await sharp(square).resize(512, 512).png({ compressionLevel: 9 }).toBuffer());
  fs.writeFileSync(path.join(app, "apple-icon.png"), await sharp(square).resize(180, 180).png({ compressionLevel: 9 }).toBuffer());
  // 3. favicon.ico with 16, 32 and 48px PNG images inside (ICO allows PNG payloads).
  const sizes = [16, 32, 48];
  const pngs = await Promise.all(sizes.map((s) => sharp(square).resize(s, s).png().toBuffer()));
  const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = 6 + 16 * sizes.length; const entries = [];
  sizes.forEach((s, i) => { const e = Buffer.alloc(16); e.writeUInt8(s === 256 ? 0 : s, 0); e.writeUInt8(s === 256 ? 0 : s, 1); e.writeUInt8(0, 2); e.writeUInt8(0, 3); e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12); offset += pngs[i].length; entries.push(e); });
  fs.writeFileSync(path.join(app, "favicon.ico"), Buffer.concat([header, ...entries, ...pngs]));
  // 4. A header-sized logo (keeps the original for the footer, schema and emails).
  const meta = await sharp(logo).metadata();
  console.log("logo:", meta.width, "x", meta.height, meta.hasAlpha ? "alpha" : "no alpha");
  console.log("wrote app/icon.png, app/apple-icon.png, app/favicon.ico");
})().catch((e) => { console.error(e); process.exit(1); });
