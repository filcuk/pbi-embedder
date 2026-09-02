/**
 * Checkerboard image preview — SVG markup, image URLs, or Blob/File.
 *
 * Markup:
 *   <div class="image-preview" aria-live="polite"
 *     data-image-preview-pixelated
 *     data-image-preview-maximize
 *     data-image-preview-expand-on-click
 *     data-image-preview-download
 *     data-image-preview-download-name="preview.svg"
 *     data-image-preview-dimensions
 *     data-image-preview-file-size
 *     data-image-preview-meta-extra="Scale 4×"
 *     data-expandable-surface-label="Preview">
 *     <p class="image-preview__empty">No image</p>
 *   </div>
 *
 * data-image-preview-pixelated — crisp nearest-neighbour scaling for media
 * data-image-preview-maximize — floating fullscreen control via expandable-surface
 * data-image-preview-expand-on-click — click the viewport to maximise
 * data-image-preview-download — floating download control
 * data-image-preview-download-name — default download filename
 * data-image-preview-dimensions — show intrinsic width×height (px) bottom-right
 * data-image-preview-file-size — show source byte size bottom-right
 * data-image-preview-frames — for SMIL multi-frame SVG, show `frame K/N` while animating
 * data-image-preview-duration — for SMIL SVG, show total loop duration (e.g. `2.7 s`)
 * data-image-preview-meta — when meta content is enabled: `hover` (default), `always`, or `never`
 * data-image-preview-meta-extra — append app-specific text to the meta strip
 *
 * Maximise requires `initExpandableSurfaces()` on the page (same as code-block).
 * Content is set via the instance API (`setSvg`, `setSrc`, `setBlob`, `clear`).
 * `setSvg` sanitizes markup (strips scripts / event handlers; keeps SMIL `animate*`).
 * Frame/duration meta applies to inline SMIL SVG (e.g. `g#frame-N` groups); not GIF/APNG via `<img>`.
 */

import { setHidden } from "../utils/dom.js";
import { createIcon } from "../utils/icons.js";
import { sanitizeSvgMarkup } from "../utils/sanitize-svg.js";
import { downloadFile } from "./file-download.js";

const SVG_PARSER = typeof DOMParser === "undefined" ? null : new DOMParser();

/**
 * @param {HTMLElement} el
 * @returns {HTMLElement | null}
 */
function getEmptyEl(el) {
  return el.querySelector(".image-preview__empty");
}

/**
 * @param {Element} node
 */
function isChromeChild(node) {
  if (!(node instanceof Element)) return false;
  if (node.classList.contains("image-preview__empty")) return true;
  if (node.classList.contains("image-preview__meta")) return true;
  if (node.classList.contains("image-preview__download")) return true;
  if (node.classList.contains("expandable-surface__expand")) return true;
  if (node.classList.contains("surface-actions")) return true;
  if (node.hasAttribute("data-expandable-surface-open")) return true;
  return false;
}

/**
 * @param {HTMLElement} el
 */
function removeMedia(el) {
  for (const node of [...el.children]) {
    if (isChromeChild(node)) continue;
    node.remove();
  }
}

/**
 * @param {HTMLElement} el
 */
function hasMediaChild(el) {
  return [...el.children].some((node) => !isChromeChild(node));
}

/**
 * @param {string} markup
 * @returns {SVGSVGElement | null}
 */
function parseSvgMarkup(markup) {
  if (!SVG_PARSER) return null;
  const doc = SVG_PARSER.parseFromString(String(markup ?? ""), "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const svg = doc.documentElement;
  return svg instanceof SVGSVGElement ? svg : null;
}

/**
 * @param {number} bytes
 */
function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * @param {string | null} value
 * @returns {number | null}
 */
function parseSvgLength(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^([+]?(?:\d+\.?\d*|\.\d+))\s*(px|pt|pc|in|cm|mm|q)?$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const units = {
    px: 1,
    pt: 96 / 72,
    pc: 16,
    in: 96,
    cm: 96 / 2.54,
    mm: 96 / 25.4,
    q: 96 / 101.6,
  };
  return amount * (units[match[2]?.toLowerCase() ?? "px"] ?? 1);
}

/**
 * Read the rendered SVG dimensions, using explicit width/height before the
 * viewBox coordinate space. A viewBox is only a fallback when dimensions are
 * omitted; it does not override the SVG's requested pixel size.
 *
 * @param {SVGSVGElement} svg
 * @returns {{ width: number, height: number } | null}
 */
export function readSvgDimensions(svg) {
  const width = parseSvgLength(svg.getAttribute("width"));
  const height = parseSvgLength(svg.getAttribute("height"));
  const vb = svg.viewBox?.baseVal;
  const hasViewBox = vb && vb.width > 0 && vb.height > 0;

  if (width !== null && height !== null) {
    return { width, height };
  }
  if (hasViewBox && width !== null) {
    return { width, height: (width / vb.width) * vb.height };
  }
  if (hasViewBox && height !== null) {
    return { width: (height / vb.height) * vb.width, height };
  }
  if (hasViewBox) {
    return { width: vb.width, height: vb.height };
  }
  return null;
}

/**
 * @param {{ width: number, height: number }} size
 */
function formatDimensions(size) {
  return `${size.width} × ${size.height}`;
}

/**
 * @param {string | null | undefined} durAttr
 * @returns {number | null} seconds
 */
function parseSmilDurationSec(durAttr) {
  if (!durAttr) return null;
  const trimmed = String(durAttr).trim().toLowerCase();
  if (!trimmed || trimmed === "indefinite" || trimmed === "media") return null;
  if (trimmed.endsWith("ms")) {
    const ms = Number.parseFloat(trimmed.slice(0, -2));
    return Number.isFinite(ms) && ms > 0 ? ms / 1000 : null;
  }
  if (trimmed.endsWith("s")) {
    const sec = Number.parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(sec) && sec > 0 ? sec : null;
  }
  const sec = Number.parseFloat(trimmed);
  return Number.isFinite(sec) && sec > 0 ? sec : null;
}

/**
 * @param {number} sec
 */
function formatDuration(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const rounded = Math.round(sec * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} s`;
}

/**
 * Inspect inline SVG for SMIL multi-frame groups and/or timed animations.
 * @param {SVGSVGElement} svg
 * @returns {{ frameCount: number, durationSec: number | null }}
 */
function inspectSvgAnimation(svg) {
  const frameGroups = [...svg.querySelectorAll(":scope > g[id^='frame-']")].filter(
    (node) => /^frame-\d+$/i.test(node.id)
  );

  /** @type {number | null} */
  let durationSec = null;

  if (frameGroups.length > 0) {
    for (const group of frameGroups) {
      const animate = group.querySelector("animate, animateTransform");
      const dur = parseSmilDurationSec(animate?.getAttribute("dur"));
      if (typeof dur === "number" && (durationSec === null || dur > durationSec)) {
        durationSec = dur;
      }
    }
    return { frameCount: frameGroups.length, durationSec };
  }

  for (const animate of svg.querySelectorAll("animate, animateTransform, animateMotion")) {
    const dur = parseSmilDurationSec(animate.getAttribute("dur"));
    if (typeof dur === "number" && (durationSec === null || dur > durationSec)) {
      durationSec = dur;
    }
  }

  return { frameCount: 0, durationSec };
}

/**
 * @param {string} name
 * @param {string} fallbackExt
 */
function ensureFilename(name, fallbackExt) {
  const trimmed = name?.trim();
  if (!trimmed) return `preview.${fallbackExt}`;
  if (trimmed.includes(".")) return trimmed;
  return `${trimmed}.${fallbackExt}`;
}

/**
 * @param {string | undefined} value
 * @returns {"hover" | "always" | "never"}
 */
function resolveMetaVisibility(value) {
  const trimmed = String(value ?? "")
    .trim()
    .toLowerCase();
  if (trimmed === "always" || trimmed === "never" || trimmed === "hover") {
    return trimmed;
  }
  return "hover";
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function resolveMetaExtra(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Map image-preview maximise options onto expandable-surface data attributes.
 * Call `initExpandableSurfaces()` after init (or on the page) to activate.
 *
 * @param {HTMLElement} el
 * @param {{ maximize?: boolean, expandOnClick?: boolean }} options
 */
function syncExpandableAttrs(el, options) {
  const maximize =
    typeof options.maximize === "boolean"
      ? options.maximize
      : el.hasAttribute("data-image-preview-maximize");
  const expandOnClick =
    typeof options.expandOnClick === "boolean"
      ? options.expandOnClick
      : el.hasAttribute("data-image-preview-expand-on-click");

  if (maximize) {
    el.setAttribute("data-image-preview-maximize", "");
  } else {
    el.removeAttribute("data-image-preview-maximize");
  }

  if (expandOnClick) {
    el.setAttribute("data-image-preview-expand-on-click", "");
  } else {
    el.removeAttribute("data-image-preview-expand-on-click");
  }

  if (!maximize && !expandOnClick) {
    el.removeAttribute("data-expandable-surface-click");
    el.removeAttribute("data-expandable-surface-control");
    return { maximize: false, expandOnClick: false };
  }

  el.setAttribute("data-expandable-surface", "");

  if (expandOnClick) {
    el.setAttribute("data-expandable-surface-click", "");
  } else {
    el.removeAttribute("data-expandable-surface-click");
  }

  if (maximize) {
    el.removeAttribute("data-expandable-surface-control");
  } else {
    el.setAttribute("data-expandable-surface-control", "false");
  }

  return { maximize, expandOnClick };
}

/**
 * @param {HTMLElement} el
 * @param {object} [options]
 */
export function initImagePreview(el, options = {}) {
  if (!(el instanceof HTMLElement)) return null;
  if (!el.classList.contains("image-preview")) return null;
  if (el.dataset.imagePreviewInit !== undefined) return null;

  el.dataset.imagePreviewInit = "";

  const emptyEl = getEmptyEl(el);
  /** @type {string | null} */
  let objectUrl = null;
  /** @type {"svg" | "img" | null} */
  let contentType = null;
  /** @type {string | null} */
  let svgMarkup = null;
  /** @type {Blob | null} */
  let sourceBlob = null;
  /** @type {string | null} */
  let sourceUrl = null;
  /** @type {{ width: number, height: number } | null} */
  let dimensions = null;
  /** @type {number | null} */
  let byteLength = null;
  /** @type {number} */
  let contentGeneration = 0;

  const showDownload =
    typeof options.download === "boolean"
      ? options.download
      : el.hasAttribute("data-image-preview-download");
  const showDimensions =
    typeof options.dimensions === "boolean"
      ? options.dimensions
      : el.hasAttribute("data-image-preview-dimensions");
  const showFileSize =
    typeof options.fileSize === "boolean"
      ? options.fileSize
      : el.hasAttribute("data-image-preview-file-size");
  const showFrames =
    typeof options.frames === "boolean"
      ? options.frames
      : el.hasAttribute("data-image-preview-frames");
  const showDuration =
    typeof options.duration === "boolean"
      ? options.duration
      : el.hasAttribute("data-image-preview-duration");
  const fixedMetaContent = showDimensions || showFileSize || showFrames || showDuration;
  const configuredMetaVisibility = resolveMetaVisibility(
    typeof options.meta === "string" ? options.meta : el.dataset.imagePreviewMeta
  );
  let metaExtra = resolveMetaExtra(
    typeof options.metaExtra === "string"
      ? options.metaExtra
      : el.dataset.imagePreviewMetaExtra
  );
  let hasMetaContent = fixedMetaContent || metaExtra !== "";
  let metaVisibility = hasMetaContent ? configuredMetaVisibility : "never";

  if (showDownload) el.setAttribute("data-image-preview-download", "");
  else el.removeAttribute("data-image-preview-download");
  if (showDimensions) el.setAttribute("data-image-preview-dimensions", "");
  else el.removeAttribute("data-image-preview-dimensions");
  if (showFileSize) el.setAttribute("data-image-preview-file-size", "");
  else el.removeAttribute("data-image-preview-file-size");
  if (showFrames) el.setAttribute("data-image-preview-frames", "");
  else el.removeAttribute("data-image-preview-frames");
  if (showDuration) el.setAttribute("data-image-preview-duration", "");
  else el.removeAttribute("data-image-preview-duration");

  if (metaExtra) el.dataset.imagePreviewMetaExtra = metaExtra;
  else delete el.dataset.imagePreviewMetaExtra;

  if (hasMetaContent) {
    el.dataset.imagePreviewMeta = metaVisibility;
  } else {
    delete el.dataset.imagePreviewMeta;
  }

  if (typeof options.downloadName === "string" && options.downloadName.trim()) {
    el.dataset.imagePreviewDownloadName = options.downloadName.trim();
  }

  /** @type {HTMLDivElement | null} */
  let actionsHost = null;
  /** @type {HTMLButtonElement | null} */
  let downloadBtn = null;
  /** @type {HTMLParagraphElement | null} */
  let metaEl = null;
  /** @type {{ svg: SVGSVGElement, frameCount: number, durationSec: number | null } | null} */
  let animationInfo = null;
  /** @type {number | null} */
  let currentFrameIndex = null;
  /** @type {number | null} */
  let animationRafId = null;

  function revokeObjectUrl() {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }

  function showEmpty(empty) {
    if (emptyEl) setHidden(emptyEl, !empty);
  }

  function ensureActionsHost() {
    if (actionsHost?.isConnected) return actionsHost;
    actionsHost = el.querySelector(":scope > .surface-actions");
    if (!actionsHost) {
      actionsHost = document.createElement("div");
      actionsHost.className = "surface-actions";
      el.append(actionsHost);
    }
    const orphanExpand = el.querySelector(":scope > .expandable-surface__expand");
    if (orphanExpand) actionsHost.prepend(orphanExpand);
    return actionsHost;
  }

  function ensureDownloadButton() {
    if (!showDownload) return null;
    if (downloadBtn?.isConnected) return downloadBtn;
    const host = ensureActionsHost();
    downloadBtn = host.querySelector(".image-preview__download");
    if (!(downloadBtn instanceof HTMLButtonElement)) {
      downloadBtn = document.createElement("button");
      downloadBtn.type = "button";
      downloadBtn.className = "image-preview__download btn btn-slim btn-icon";
      downloadBtn.dataset.tooltip = "Download";
      downloadBtn.dataset.tooltipPosition = "top";
      downloadBtn.setAttribute("aria-label", "Download");
      downloadBtn.append(createIcon("download", { className: "btn-icon-svg" }));
      downloadBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        void handleDownload();
      });
      host.append(downloadBtn);
    }
    return downloadBtn;
  }

  function ensureMetaEl() {
    if (!hasMetaContent || metaVisibility === "never") {
      if (metaEl) setHidden(metaEl, true);
      return null;
    }
    if (metaEl?.isConnected) return metaEl;
    metaEl = el.querySelector(":scope > .image-preview__meta");
    if (!(metaEl instanceof HTMLParagraphElement)) {
      metaEl = document.createElement("p");
      metaEl.className = "image-preview__meta";
      el.append(metaEl);
    }
    return metaEl;
  }

  function stopAnimationMeta() {
    if (animationRafId !== null) {
      cancelAnimationFrame(animationRafId);
      animationRafId = null;
    }
    animationInfo = null;
    currentFrameIndex = null;
  }

  function tickAnimationMeta() {
    animationRafId = null;
    if (!animationInfo || !showFrames || animationInfo.frameCount < 2) return;
    const { svg, frameCount, durationSec } = animationInfo;
    if (typeof durationSec !== "number" || durationSec <= 0) return;
    if (typeof svg.getCurrentTime !== "function") return;

    const t = ((svg.getCurrentTime() % durationSec) + durationSec) % durationSec;
    const next = Math.min(frameCount - 1, Math.floor((t / durationSec) * frameCount));
    if (next !== currentFrameIndex) {
      currentFrameIndex = next;
      syncMeta();
    }
    animationRafId = requestAnimationFrame(tickAnimationMeta);
  }

  function startAnimationMeta(svg) {
    stopAnimationMeta();
    if (!(svg instanceof SVGSVGElement)) return;
    if (!showFrames && !showDuration) return;

    const inspected = inspectSvgAnimation(svg);
    if (inspected.frameCount < 2 && typeof inspected.durationSec !== "number") return;

    animationInfo = {
      svg,
      frameCount: inspected.frameCount,
      durationSec: inspected.durationSec,
    };
    currentFrameIndex = inspected.frameCount >= 2 ? 0 : null;
    syncMeta();
    if (showFrames && inspected.frameCount >= 2 && typeof inspected.durationSec === "number") {
      animationRafId = requestAnimationFrame(tickAnimationMeta);
    }
  }

  function syncChromeVisibility() {
    const hasContent = contentType !== null;
    if (downloadBtn) setHidden(downloadBtn, !hasContent);
    syncMeta();
  }

  function syncMeta() {
    const meta = ensureMetaEl();
    if (!meta) return;

    /** @type {string[]} */
    const parts = [];
    if (showDimensions && dimensions) {
      parts.push(`${formatDimensions(dimensions)} px`);
    }
    if (showFileSize && typeof byteLength === "number") {
      parts.push(formatFileSize(byteLength));
    }
    if (
      showFrames &&
      animationInfo &&
      animationInfo.frameCount >= 2 &&
      typeof currentFrameIndex === "number"
    ) {
      parts.push(`frame ${currentFrameIndex + 1}/${animationInfo.frameCount}`);
    }
    if (showDuration && animationInfo && typeof animationInfo.durationSec === "number") {
      parts.push(formatDuration(animationInfo.durationSec));
    }
    if (metaExtra) {
      parts.push(metaExtra);
    }

    if (parts.length === 0 || contentType === null) {
      meta.textContent = "";
      setHidden(meta, true);
      return;
    }

    meta.textContent = parts.join(" · ");
    setHidden(meta, false);
  }

  function resetSourceState() {
    stopAnimationMeta();
    svgMarkup = null;
    sourceBlob = null;
    sourceUrl = null;
    dimensions = null;
    byteLength = null;
  }

  function clearMedia() {
    contentGeneration += 1;
    revokeObjectUrl();
    removeMedia(el);
    contentType = null;
    resetSourceState();
    showEmpty(true);
    syncChromeVisibility();
  }

  function resolveDownloadName(fallbackExt) {
    return ensureFilename(el.dataset.imagePreviewDownloadName ?? "", fallbackExt);
  }

  async function handleDownload() {
    if (svgMarkup) {
      await downloadFile({
        filename: resolveDownloadName("svg"),
        content: svgMarkup,
        mimeType: "image/svg+xml",
      });
      return;
    }
    if (sourceBlob) {
      const ext =
        sourceBlob.type.includes("svg")
          ? "svg"
          : sourceBlob.type.includes("png")
            ? "png"
            : sourceBlob.type.includes("jpeg") || sourceBlob.type.includes("jpg")
              ? "jpg"
              : sourceBlob.type.includes("gif")
                ? "gif"
                : sourceBlob.type.includes("webp")
                  ? "webp"
                  : "bin";
      const name =
        sourceBlob instanceof File && sourceBlob.name
          ? sourceBlob.name
          : resolveDownloadName(ext);
      await downloadFile({
        filename: name,
        content: sourceBlob,
        mimeType: sourceBlob.type || "application/octet-stream",
      });
      return;
    }
    if (sourceUrl) {
      try {
        const response = await fetch(sourceUrl);
        if (!response.ok) return;
        const blob = await response.blob();
        const pathName = (() => {
          try {
            return new URL(sourceUrl, window.location.href).pathname.split("/").pop() || "";
          } catch {
            return "";
          }
        })();
        await downloadFile({
          filename: pathName.includes(".") ? pathName : resolveDownloadName("bin"),
          content: blob,
          mimeType: blob.type || "application/octet-stream",
        });
      } catch {
        // Cross-origin or network failure — no download
      }
    }
  }

  /**
   * @param {HTMLImageElement} img
   * @param {number} generation
   */
  function bindImageMeta(img, generation) {
    const apply = () => {
      if (generation !== contentGeneration) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        dimensions = { width: img.naturalWidth, height: img.naturalHeight };
      }
      syncMeta();
    };
    if (img.complete && img.naturalWidth > 0) {
      apply();
    } else {
      img.addEventListener("load", apply, { once: true });
    }
  }

  /**
   * @param {string} url
   * @param {number} generation
   */
  async function probeUrlByteLength(url, generation) {
    if (!showFileSize) return;
    try {
      const response = await fetch(url);
      if (!response.ok || generation !== contentGeneration) return;
      const blob = await response.blob();
      if (generation !== contentGeneration) return;
      byteLength = blob.size;
      syncMeta();
    } catch {
      // Ignore; meta stays without size
    }
  }

  if (!hasMediaChild(el)) {
    showEmpty(true);
    contentType = null;
  } else {
    showEmpty(false);
    const existingSvg = [...el.children].find(
      (node) => node instanceof SVGSVGElement && !isChromeChild(node)
    );
    const existingImg = [...el.children].find(
      (node) => node instanceof HTMLImageElement && !isChromeChild(node)
    );
    if (existingSvg instanceof SVGSVGElement) {
      contentType = "svg";
      dimensions = readSvgDimensions(existingSvg);
      svgMarkup = new XMLSerializer().serializeToString(existingSvg);
      byteLength = new TextEncoder().encode(svgMarkup).byteLength;
      startAnimationMeta(existingSvg);
    } else if (existingImg instanceof HTMLImageElement) {
      contentType = "img";
      sourceUrl = existingImg.currentSrc || existingImg.src || null;
      bindImageMeta(existingImg, contentGeneration);
      if (sourceUrl) {
        void probeUrlByteLength(sourceUrl, contentGeneration);
      }
    } else {
      contentType = null;
    }
  }

  if (options.pixelated === true) {
    el.dataset.imagePreviewPixelated = "";
  } else if (options.pixelated === false) {
    delete el.dataset.imagePreviewPixelated;
  }

  syncExpandableAttrs(el, options);
  ensureDownloadButton();
  ensureMetaEl();
  syncChromeVisibility();

  return {
    /** @returns {"svg" | "img" | null} */
    getContentType() {
      return contentType;
    },

    /**
     * Inject inline SVG markup (SMIL animation is preserved when clean).
     * Markup is sanitized before injection; returns false when nothing safe remains.
     * @param {string} markup
     * @returns {boolean}
     */
    setSvg(markup) {
      const safe = sanitizeSvgMarkup(markup);
      if (!safe) return false;
      const svg = parseSvgMarkup(safe);
      if (!svg) return false;
      contentGeneration += 1;
      revokeObjectUrl();
      removeMedia(el);
      resetSourceState();
      const imported = document.importNode(svg, true);
      el.append(imported);
      contentType = "svg";
      svgMarkup = safe;
      dimensions = readSvgDimensions(imported);
      byteLength = new TextEncoder().encode(svgMarkup).byteLength;
      showEmpty(false);
      startAnimationMeta(imported);
      syncChromeVisibility();
      return true;
    },

    /**
     * Show an image from a URL (GIF / APNG / WebP animate in the browser).
     * @param {string} url
     * @param {{ alt?: string, byteLength?: number }} [imgOptions]
     */
    setSrc(url, imgOptions = {}) {
      if (!url) {
        clearMedia();
        return;
      }
      contentGeneration += 1;
      const generation = contentGeneration;
      revokeObjectUrl();
      removeMedia(el);
      resetSourceState();
      const img = document.createElement("img");
      img.className = "image-preview__media";
      img.src = url;
      img.alt = imgOptions.alt ?? "";
      img.decoding = "async";
      el.append(img);
      contentType = "img";
      sourceUrl = url;
      if (typeof imgOptions.byteLength === "number") {
        byteLength = imgOptions.byteLength;
      } else {
        void probeUrlByteLength(url, generation);
      }
      bindImageMeta(img, generation);
      showEmpty(false);
      syncChromeVisibility();
    },

    /**
     * Show a Blob or File via an object URL (revoked on replace / clear / destroy).
     * @param {Blob} blob
     * @param {{ alt?: string }} [imgOptions]
     */
    setBlob(blob, imgOptions = {}) {
      if (!(blob instanceof Blob)) {
        clearMedia();
        return;
      }
      contentGeneration += 1;
      const generation = contentGeneration;
      revokeObjectUrl();
      removeMedia(el);
      resetSourceState();
      objectUrl = URL.createObjectURL(blob);
      const img = document.createElement("img");
      img.className = "image-preview__media";
      img.src = objectUrl;
      img.alt = imgOptions.alt ?? "";
      img.decoding = "async";
      el.append(img);
      contentType = "img";
      sourceBlob = blob;
      byteLength = blob.size;
      bindImageMeta(img, generation);
      showEmpty(false);
      syncChromeVisibility();
    },

    clear() {
      clearMedia();
    },

    /**
     * Set or clear app-specific text appended to the hover meta strip.
     * @param {string} text
     */
    setMetaExtra(text) {
      metaExtra = resolveMetaExtra(text);
      hasMetaContent = fixedMetaContent || metaExtra !== "";
      metaVisibility = hasMetaContent ? configuredMetaVisibility : "never";
      if (metaExtra) {
        el.dataset.imagePreviewMetaExtra = metaExtra;
        el.dataset.imagePreviewMeta = metaVisibility;
      } else {
        delete el.dataset.imagePreviewMetaExtra;
        if (fixedMetaContent) {
          el.dataset.imagePreviewMeta = metaVisibility;
        } else {
          delete el.dataset.imagePreviewMeta;
        }
      }
      syncMeta();
    },

    destroy() {
      clearMedia();
      downloadBtn?.remove();
      metaEl?.remove();
      if (actionsHost && !actionsHost.querySelector(".expandable-surface__expand")) {
        actionsHost.remove();
      }
      delete el.dataset.imagePreviewInit;
    },
  };
}

/** Wire every `.image-preview` in `root`. */
export function initImagePreviews(root = document) {
  const instances = [];
  for (const el of root.querySelectorAll(".image-preview")) {
    if (!(el instanceof HTMLElement)) continue;
    const instance = initImagePreview(el);
    if (instance) instances.push(instance);
  }
  return instances;
}
