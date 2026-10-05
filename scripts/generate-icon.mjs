/**
 * scripts/generate-icon.mjs — gera a identidade visual do Hub (orb Terracota).
 *
 * O ícone é o orb de pontos do Jarvis (esfera de Fibonacci) nas cores do DS
 * Terracota, sobre o creme --hub-bg com cantos arredondados. Saídas:
 *   public/icon.svg               — manifest PWA (any) + favicon
 *   public/icon-192.png           — manifest + apple-touch-icon
 *   public/icon-512.png           — manifest
 *   public/icon-maskable-512.png  — manifest (maskable, full-bleed)
 *   public/hub.ico                — atalhos do Windows (16/32/48 BMP + 256 PNG)
 *
 * Rodar: node scripts/generate-icon.mjs
 */

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

// ── Paleta (espelho de src/styles/global.css) ─────────────────────────────────
const BG = { r: 0xf7, g: 0xf1, b: 0xe6 };            // --hub-bg
const DOT_LIGHT = { r: 0xd9, g: 0x8a, b: 0x63 };     // terracota claro (frente/topo)
const DOT_DARK = { r: 0xa6, g: 0x45, b: 0x2e };      // --hub-primary-strong (fundo)

// ── Esfera de Fibonacci (mesma ideia do Orb 3D real) ──────────────────────────
function orbDots() {
  const N = 620;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const tiltX = -0.42;
  const rotY = 0.55;
  const dots = [];
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    let x = Math.cos(theta) * r;
    let z = Math.sin(theta) * r;
    let py = y;
    // rotação Y
    const x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
    const z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
    // tilt X
    const y2 = py * Math.cos(tiltX) - z1 * Math.sin(tiltX);
    const z2 = py * Math.sin(tiltX) + z1 * Math.cos(tiltX);
    dots.push({ x: x1, y: y2, z: z2 });
  }
  dots.sort((a, b) => a.z - b.z); // pinta de trás pra frente
  return dots;
}

function dotStyle(d) {
  const depth = (d.z + 1) / 2;                        // 0 = fundo, 1 = frente
  const light = Math.max(0, (-d.x - d.y + 1.4) / 2.8); // luz vindo do topo-esquerda
  const t = Math.min(1, light * 0.55 + depth * 0.25);
  const mix = (a, b) => Math.round(a + (b - a) * t);
  return {
    r: mix(DOT_DARK.r, DOT_LIGHT.r),
    g: mix(DOT_DARK.g, DOT_LIGHT.g),
    b: mix(DOT_DARK.b, DOT_LIGHT.b),
    alpha: 0.20 + Math.pow(depth, 1.3) * 0.80,
    radius: 0.40 + Math.pow(depth, 1.15) * 1.05, // em "unidades de ponto" (escala aplicada depois)
  };
}

// ── SVG ───────────────────────────────────────────────────────────────────────
function buildSvg() {
  const S = 512, C = 256, R = 152, DOT = 4.1;
  const circles = orbDots().map((d) => {
    const s = dotStyle(d);
    const cx = (C + d.x * R).toFixed(1);
    const cy = (C + d.y * R).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${(s.radius * DOT).toFixed(2)}" fill="rgb(${s.r},${s.g},${s.b})" fill-opacity="${s.alpha.toFixed(2)}"/>`;
  });
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}">`,
    `<rect width="${S}" height="${S}" rx="112" fill="rgb(${BG.r},${BG.g},${BG.b})"/>`,
    ...circles,
    '</svg>',
  ].join('\n');
}

// ── Raster RGBA ───────────────────────────────────────────────────────────────
function render(size, { fullBleed = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const rx = fullBleed ? 0 : size * 0.219;

  // fundo creme com cantos arredondados (antialias por distância)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.max(rx - x - 0.5, x + 0.5 - (size - rx), 0);
    const dy = Math.max(rx - y - 0.5, y + 0.5 - (size - rx), 0);
    const a = rx === 0 ? 1 : Math.max(0, Math.min(1, rx - Math.hypot(dx, dy) + (dx || dy ? 0.5 : rx)));
    const i = (y * size + x) * 4;
    px[i] = BG.r; px[i + 1] = BG.g; px[i + 2] = BG.b; px[i + 3] = Math.round(a * 255);
  }

  // orb (no maskable, orb um pouco menor — zona segura de 80%)
  const C = size / 2, R = size * (fullBleed ? 0.24 : 0.297), DOT = size / 125;
  for (const d of orbDots()) {
    const s = dotStyle(d);
    const cx = C + d.x * R, cy = C + d.y * R, rad = s.radius * DOT;
    for (let y = Math.floor(cy - rad - 1); y <= Math.ceil(cy + rad + 1); y++) {
      for (let x = Math.floor(cx - rad - 1); x <= Math.ceil(cx + rad + 1); x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const cov = Math.max(0, Math.min(1, rad - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
        if (cov === 0) continue;
        const a = cov * s.alpha;
        const i = (y * size + x) * 4;
        px[i]     = Math.round(s.r * a + px[i] * (1 - a));
        px[i + 1] = Math.round(s.g * a + px[i + 1] * (1 - a));
        px[i + 2] = Math.round(s.b * a + px[i + 2] * (1 - a));
        px[i + 3] = Math.max(px[i + 3], Math.round(a * 255));
      }
    }
  }
  return px;
}

function downsample(px, from, to) {
  const out = Buffer.alloc(to * to * 4);
  const k = from / to;
  for (let y = 0; y < to; y++) for (let x = 0; x < to; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(y * k); sy < Math.floor((y + 1) * k); sy++) {
      for (let sx = Math.floor(x * k); sx < Math.floor((x + 1) * k); sx++) {
        const i = (sy * from + sx) * 4;
        r += px[i]; g += px[i + 1]; b += px[i + 2]; a += px[i + 3]; n++;
      }
    }
    const o = (y * to + x) * 4;
    out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
  }
  return out;
}

// ── PNG / ICO writers ─────────────────────────────────────────────────────────
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw, { level: 9 })), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function icoBmpEntry(px, size) {
  // BITMAPINFOHEADER + BGRA bottom-up + máscara AND zerada
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  const body = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = ((size - 1 - y) * size + x) * 4, d = (y * size + x) * 4;
    body[d] = px[s + 2]; body[d + 1] = px[s + 1]; body[d + 2] = px[s]; body[d + 3] = px[s + 3];
  }
  const mask = Buffer.alloc((size / 8 + 3 & ~3) * size);
  return Buffer.concat([header, body, mask]);
}
function encodeIco(entries) {
  const dir = Buffer.from([0, 0, 1, 0, entries.length, 0]);
  const heads = [];
  let offset = 6 + entries.length * 16;
  const bodies = [];
  for (const { size, data } of entries) {
    const h = Buffer.alloc(16);
    h[0] = size === 256 ? 0 : size; h[1] = size === 256 ? 0 : size;
    h[4] = 1; h[6] = 32;
    h.writeUInt32LE(data.length, 8); h.writeUInt32LE(offset, 12);
    heads.push(h); bodies.push(data); offset += data.length;
  }
  return Buffer.concat([dir, ...heads, ...bodies]);
}

// ── Gera tudo ─────────────────────────────────────────────────────────────────
const big = render(512);
const bigMask = render(512, { fullBleed: true });

writeFileSync('public/icon.svg', buildSvg());
writeFileSync('public/icon-512.png', encodePng(big, 512));
writeFileSync('public/icon-192.png', encodePng(downsample(big, 512, 192), 192));
writeFileSync('public/icon-maskable-512.png', encodePng(bigMask, 512));
writeFileSync('public/hub.ico', encodeIco([
  { size: 16, data: icoBmpEntry(downsample(big, 512, 16), 16) },
  { size: 32, data: icoBmpEntry(downsample(big, 512, 32), 32) },
  { size: 48, data: icoBmpEntry(downsample(big, 512, 48), 48) },
  { size: 256, data: encodePng(downsample(big, 512, 256), 256) },
]));

console.log('gerados: icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, hub.ico');
