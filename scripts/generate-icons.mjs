// Generates PWA icons for both Next apps from an inline SVG, using sharp.
// Run: node scripts/generate-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

// Both apps share the Taravee brand: warm charcoal tile with a gold "T".
const APPS = [{ dir: "apps/admin" }, { dir: "apps/affiliate" }];

const BG1 = "#2b2620";
const BG2 = "#121110";
const GOLD1 = "#f3e2a1";
const GOLD2 = "#a9802a";

function squareSvg(size) {
  const r = Math.round(size * 0.22);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${BG1}"/><stop offset="1" stop-color="${BG2}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${GOLD1}"/><stop offset="1" stop-color="${GOLD2}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <text x="50%" y="50%" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(
    size * 0.56,
  )}" font-weight="700" fill="url(#gold)" text-anchor="middle" dominant-baseline="central">T</text>
</svg>`;
}

async function png(size) {
  return sharp(Buffer.from(squareSvg(size))).png().toBuffer();
}

for (const app of APPS) {
  const out = path.join(root, app.dir, "public");
  await mkdir(out, { recursive: true });
  const targets = [
    ["icon-192.png", 192],
    ["icon-512.png", 512],
    ["apple-touch-icon.png", 180],
    ["favicon.png", 48],
  ];
  for (const [name, size] of targets) {
    await writeFile(path.join(out, name), await png(size));
  }
  // eslint-disable-next-line no-console
  console.log(`✔ icons written to ${app.dir}/public`);
}
