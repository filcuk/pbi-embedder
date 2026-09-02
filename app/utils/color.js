/**
 * Shared colour parsing and conversion helpers (hex / RGB / HSL / HSV / CMYK).
 * American English identifiers; values normalise to uppercase hex where applicable.
 */

const HEX_OPAQUE_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const HEX_ALPHA_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const PARTIAL_HEX_OPAQUE_PATTERN = /^#?[0-9a-fA-F]{0,6}$/;
const PARTIAL_HEX_ALPHA_PATTERN = /^#?[0-9a-fA-F]{0,8}$/;

function expandShortHex(hex) {
  if (hex.length === 3 || hex.length === 4) {
    return hex
      .split("")
      .map((char) => char + char)
      .join("");
  }
  return hex;
}

/**
 * Strip leading `#` characters from a hex string.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function stripHexPrefix(value) {
  return String(value ?? "").trim().replace(/^#+/, "");
}

/**
 * Paint a hex mirror so a leading `#` can render muted while the real input
 * keeps the full selectable text (input text is transparent; caret stays visible).
 * @param {HTMLElement | null | undefined} mirrorEl
 * @param {string | null | undefined} text
 */
export function paintHexMirror(mirrorEl, text) {
  if (!mirrorEl) return;
  const raw = String(text ?? "");
  if (!raw) {
    mirrorEl.replaceChildren();
    return;
  }
  const match = raw.match(/^(#+)([\s\S]*)$/);
  if (match) {
    const hash = document.createElement("span");
    hash.className = "color-hex-hash";
    hash.textContent = match[1];
    mirrorEl.replaceChildren(hash, document.createTextNode(match[2]));
    return;
  }
  mirrorEl.textContent = raw;
}

/**
 * @param {string} value
 * @param {{ alpha?: boolean }} [options]
 * @returns {string | null} Normalised `#RRGGBB` or `#RRGGBBAA`, or null when invalid.
 */
export function parseHexColor(value, { alpha = false } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = text.match(alpha ? HEX_ALPHA_PATTERN : HEX_OPAQUE_PATTERN);
  if (!match) return null;
  let hex = expandShortHex(match[1]).toUpperCase();
  if (alpha && hex.length === 6) {
    hex += "FF";
  }
  return `#${hex}`;
}

/**
 * Whether `value` looks like an in-progress hex string (not necessarily complete).
 * @param {string} value
 * @param {boolean} [alpha]
 * @returns {boolean}
 */
export function isPartialHexInput(value, alpha = false) {
  const pattern = alpha ? PARTIAL_HEX_ALPHA_PATTERN : PARTIAL_HEX_OPAQUE_PATTERN;
  return pattern.test(String(value ?? "").trim());
}

/**
 * @param {{ r: number, g: number, b: number, a?: number }} rgb
 * @param {{ alpha?: boolean }} [options]
 * @returns {string}
 */
export function rgbToHex({ r, g, b, a = 1 }, { alpha = false } = {}) {
  const toByte = (n) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  const hex = `#${toByte(r)}${toByte(g)}${toByte(b)}`;
  if (!alpha) return hex;
  const alphaByte = Math.max(0, Math.min(255, Math.round(a * 255)));
  return `${hex}${alphaByte.toString(16).padStart(2, "0").toUpperCase()}`;
}

/**
 * @param {string} hex
 * @returns {{ r: number, g: number, b: number, a: number } | null}
 */
export function hexToRgb(hex) {
  const parsed = parseHexColor(hex, { alpha: true });
  if (!parsed) return null;
  const body = parsed.slice(1);
  const r = parseInt(body.slice(0, 2), 16);
  const g = parseInt(body.slice(2, 4), 16);
  const b = parseInt(body.slice(4, 6), 16);
  const a = body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function hueToRgb(p, q, t) {
  let tone = t;
  if (tone < 0) tone += 1;
  if (tone > 1) tone -= 1;
  if (tone < 1 / 6) return p + (q - p) * 6 * tone;
  if (tone < 1 / 2) return q;
  if (tone < 2 / 3) return p + (q - p) * (2 / 3 - tone) * 6;
  return p;
}

/**
 * @param {{ r: number, g: number, b: number }} rgb 0–255
 * @returns {{ h: number, s: number, l: number }} h 0–360, s/l 0–100
 */
export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) {
    return { h: 0, s: 0, l: l * 100 };
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * @param {{ h: number, s: number, l: number }} hsl h 0–360, s/l 0–100
 * @returns {{ r: number, g: number, b: number }}
 */
export function hslToRgb({ h, s, l }) {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  return {
    r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hn) * 255),
    b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255),
  };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb 0–255
 * @returns {{ h: number, s: number, v: number }} h 0–360, s/v 0–100
 */
export function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  const s = max === 0 ? 0 : d / max;
  return { h: h * 360, s: s * 100, v: max * 100 };
}

/**
 * @param {{ h: number, s: number, v: number }} hsv h 0–360, s/v 0–100
 * @returns {{ r: number, g: number, b: number }}
 */
export function hsvToRgb({ h, s, v }) {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const vn = Math.max(0, Math.min(100, v)) / 100;
  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);
  let rn = 0;
  let gn = 0;
  let bn = 0;
  switch (i % 6) {
    case 0:
      rn = vn;
      gn = t;
      bn = p;
      break;
    case 1:
      rn = q;
      gn = vn;
      bn = p;
      break;
    case 2:
      rn = p;
      gn = vn;
      bn = t;
      break;
    case 3:
      rn = p;
      gn = q;
      bn = vn;
      break;
    case 4:
      rn = t;
      gn = p;
      bn = vn;
      break;
    default:
      rn = vn;
      gn = p;
      bn = q;
      break;
  }
  return {
    r: Math.round(rn * 255),
    g: Math.round(gn * 255),
    b: Math.round(bn * 255),
  };
}

/**
 * @param {{ r: number, g: number, b: number }} rgb 0–255
 * @returns {{ c: number, m: number, y: number, k: number }} 0–100
 */
export function rgbToCmyk({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  return {
    c: ((1 - rn - k) / (1 - k)) * 100,
    m: ((1 - gn - k) / (1 - k)) * 100,
    y: ((1 - bn - k) / (1 - k)) * 100,
    k: k * 100,
  };
}

/**
 * @param {{ c: number, m: number, y: number, k: number }} cmyk 0–100
 * @returns {{ r: number, g: number, b: number }}
 */
export function cmykToRgb({ c, m, y, k }) {
  const cn = Math.max(0, Math.min(100, c)) / 100;
  const mn = Math.max(0, Math.min(100, m)) / 100;
  const yn = Math.max(0, Math.min(100, y)) / 100;
  const kn = Math.max(0, Math.min(100, k)) / 100;
  return {
    r: Math.round(255 * (1 - cn) * (1 - kn)),
    g: Math.round(255 * (1 - mn) * (1 - kn)),
    b: Math.round(255 * (1 - yn) * (1 - kn)),
  };
}
