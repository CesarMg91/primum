// Generate all raster brand assets from the Primum shield+P mark via sharp.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = resolve(root, "public");
const app = resolve(root, "app");
mkdirSync(pub, { recursive: true });

const GRAD = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#028090"/><stop offset="1" stop-color="#00c2a8"/></linearGradient>`;
const SHIELD = `<path d="M256 94 L402 150 V284 C402 370 334 420 256 448 C178 420 110 370 110 284 V150 Z" fill="#ffffff"/>`;
const P = `<path d="M214 410 V172 H300 A62 62 0 0 1 300 296 H214" fill="none" stroke="#028090" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>`;

// Rounded-corner app icon (transparent corners) — for PWA "any" + favicon source.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${GRAD}</defs><rect width="512" height="512" rx="116" fill="url(#g)"/>${SHIELD}${P}</svg>`;

// Full-bleed square (opaque) — Apple masks its own corners.
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${GRAD}</defs><rect width="512" height="512" fill="url(#g)"/>${SHIELD}${P}</svg>`;

// Maskable: full-bleed teal, mark shrunk to ~70% so it survives the safe-zone crop.
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${GRAD}</defs><rect width="512" height="512" fill="url(#g)"/><g transform="translate(256 256) scale(0.7) translate(-256 -256)">${SHIELD}${P}</g></svg>`;

// OG / social card 1200x630.
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
  <defs>${GRAD}
    <radialGradient id="bgglow" cx="78%" cy="8%" r="70%"><stop offset="0" stop-color="#0a5d54"/><stop offset="1" stop-color="#042f2e"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bgglow)"/>
  <g transform="translate(96 92)">
    <g transform="scale(0.36)"><rect width="512" height="512" rx="116" fill="url(#g)"/>${SHIELD}${P}</g>
  </g>
  <text x="296" y="170" font-family="ui-sans-serif,Segoe UI,system-ui,sans-serif" font-size="86" font-weight="700" fill="#ffffff" letter-spacing="-2">Primum</text>
  <text x="300" y="214" font-family="ui-sans-serif,Segoe UI,system-ui,sans-serif" font-size="26" font-weight="400" fill="#5dcaa5" letter-spacing="4">PRIMUM NON NOCERE</text>
  <text x="96" y="360" font-family="ui-sans-serif,Segoe UI,system-ui,sans-serif" font-size="58" font-weight="700" fill="#ffffff" letter-spacing="-1">¿Es seguro tu modelo de IA</text>
  <text x="96" y="430" font-family="ui-sans-serif,Segoe UI,system-ui,sans-serif" font-size="58" font-weight="700" fill="#ffffff" letter-spacing="-1">en la cl&#237;nica?</text>
  <text x="96" y="510" font-family="ui-sans-serif,system-ui,sans-serif" font-size="30" font-weight="400" fill="#9fe1cb">Benchmark abierto, safety-first, en espa&#241;ol mexicano</text>
  <rect x="96" y="548" width="360" height="2" fill="#0f6e56"/>
  <text x="96" y="592" font-family="ui-sans-serif,system-ui,sans-serif" font-size="24" font-weight="500" fill="#5dcaa5" letter-spacing="1">primumbench.org</text>
</svg>`;

const buf = (svg) => Buffer.from(svg);
const jobs = [
  [rounded, 192, resolve(pub, "icon-192.png")],
  [rounded, 512, resolve(pub, "icon-512.png")],
  [maskable, 512, resolve(pub, "icon-512-maskable.png")],
  [square, 180, resolve(app, "apple-icon.png")],
  [rounded, 48, resolve(pub, "favicon-48.png")],
  [rounded, 32, resolve(pub, "favicon-32.png")],
];

for (const [svg, size, out] of jobs) {
  await sharp(buf(svg)).resize(size, size).png().toFile(out);
  console.log("✓", out.split(/[\\/]/).pop(), `${size}x${size}`);
}
// OG is non-square
await sharp(buf(og)).resize(1200, 630).png().toFile(resolve(app, "opengraph-image.png"));
console.log("✓ opengraph-image.png 1200x630");

// favicon.ico (multi-size) from the 32px raster — sharp can emit ICO via the .ico() path is N/A,
// so we pack a single 32x32 PNG as .ico using the BMP/PNG-in-ICO container.
const ico32 = await sharp(buf(rounded)).resize(32, 32).png().toBuffer();
const header = Buffer.from([0,0,1,0,1,0,32,32,0,0,1,0,32,0,0,0,0,0,22,0,0,0]);
header.writeUInt32LE(ico32.length, 14);
header.writeUInt32LE(22, 18);
const { writeFileSync } = await import("node:fs");
writeFileSync(resolve(pub, "favicon.ico"), Buffer.concat([header, ico32]));
console.log("✓ favicon.ico (32x32 png-in-ico)");

console.log("\nListo: todos los assets generados.");
