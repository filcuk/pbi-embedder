/**
 * Sanitize SVG markup for safe inline injection (image preview and similar).
 * Broader than also-see icons: keeps SMIL animation elements.
 */

/** Allowed SVG element local names (lowercase). */
const ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "path",
  "circle",
  "rect",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "use",
  "symbol",
  "marker",
  "title",
  "desc",
  "lineargradient",
  "radialgradient",
  "stop",
  "clippath",
  "mask",
  "pattern",
  "filter",
  "feblend",
  "fecolormatrix",
  "fecomponenttransfer",
  "fecomposite",
  "feconvolvematrix",
  "fediffuselighting",
  "fedisplacementmap",
  "fedistantlight",
  "fedropshadow",
  "feflood",
  "fefunca",
  "fefuncb",
  "fefuncg",
  "fefuncr",
  "fegaussianblur",
  "feimage",
  "femerge",
  "femergenode",
  "femorphology",
  "feoffset",
  "fepointlight",
  "fespecularlighting",
  "fespotlight",
  "fetile",
  "feturbulence",
  "text",
  "tspan",
  "textpath",
  "image",
  "switch",
  "animate",
  "animatetransform",
  "animatemotion",
  "set",
  "mpath",
]);

/** Attribute names that must never appear. */
const BLOCKED_ATTR = /^(on|xmlns:xlink$)/i;

/**
 * @param {string} name
 * @returns {boolean}
 */
function isAllowedAttr(name) {
  if (!name || BLOCKED_ATTR.test(name)) return false;
  if (name.includes(":") && name.toLowerCase() !== "xlink:href") return false;
  return true;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isSafeUrlAttr(value) {
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  if (/^javascript:/i.test(trimmed)) return false;
  if (/^data:/i.test(trimmed)) {
    return /^data:image\//i.test(trimmed) && !/^data:image\/svg\+xml/i.test(trimmed);
  }
  return true;
}

/**
 * @param {Element} el
 */
function scrubElement(el) {
  const tag = el.tagName.toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) {
    el.remove();
    return;
  }

  for (const attr of [...el.attributes]) {
    const name = attr.name;
    const value = attr.value;
    if (!isAllowedAttr(name)) {
      el.removeAttribute(name);
      continue;
    }
    if (
      (name === "href" ||
        name.toLowerCase() === "xlink:href" ||
        name === "src") &&
      !isSafeUrlAttr(value)
    ) {
      el.removeAttribute(name);
    }
  }

  for (const child of [...el.children]) {
    scrubElement(child);
  }
}

/**
 * @param {string} source
 * @returns {string}
 */
function sanitizeWithDomParser(source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.tagName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    return "";
  }

  scrubElement(svg);
  if (svg.tagName.toLowerCase() !== "svg") return "";
  return svg.outerHTML;
}

/**
 * Conservative string sanitizer for environments without `DOMParser` (Node tests).
 *
 * @param {string} source
 * @returns {string}
 */
function sanitizeFallback(source) {
  if (
    /<\s*(script|foreignObject|iframe|object|embed|link|meta|style)\b/i.test(
      source
    )
  ) {
    return "";
  }
  if (/\son[a-z]+\s*=/i.test(source)) return "";
  if (/javascript:/i.test(source)) return "";
  if (!/^<\s*svg\b/i.test(source)) return "";

  let out = source.replace(/<!--[\s\S]*?-->/g, "");
  out = out.replace(
    /<\/?\s*(script|foreignObject|iframe|object|embed|link|meta|style|a)\b[^>]*>/gi,
    ""
  );
  out = out.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return out;
}

/**
 * Sanitize SVG markup for safe inline injection.
 * Requires a full `<svg>` root. Keeps SMIL `animate*` / `set` when otherwise clean.
 *
 * @param {unknown} raw
 * @returns {string} Safe SVG markup, or "" when empty/invalid/unsafe
 */
/**
 * Drop XML prolog / DOCTYPE so fetched `.svg` files still match the root check.
 * @param {string} source
 * @returns {string}
 */
function stripSvgProlog(source) {
  return source
    .replace(/^<\?xml\b[\s\S]*?\?>\s*/i, "")
    .replace(/^<!DOCTYPE\b[\s\S]*?>\s*/i, "");
}

export function sanitizeSvgMarkup(raw) {
  let source = typeof raw === "string" ? raw.trim() : "";
  if (!source) return "";
  source = stripSvgProlog(source);
  if (!/^<\s*svg\b/i.test(source)) return "";

  if (typeof DOMParser !== "undefined") {
    try {
      return sanitizeWithDomParser(source);
    } catch {
      return "";
    }
  }

  return sanitizeFallback(source);
}
