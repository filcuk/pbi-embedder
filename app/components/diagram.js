/**
 * Diagram — thin host around vendored Mermaid (text → SVG).
 *
 * Markup:
 *   <div class="diagram" id="my-diagram" aria-label="Example flow">
 *     <pre class="diagram-source">flowchart TD
 *       A --> B</pre>
 *   </div>
 *
 * Source resolution (first non-empty wins):
 *   1. `options.source` (string)
 *   2. child `.diagram-source` text content
 *
 * Callers may pass `source` to `initDiagram` / `update` for dynamic diagrams.
 * `update({ source: "" })` clears the canvas and shows an empty-source error.
 * The host keeps `.diagram-source` in the DOM (hidden) when present so markup
 * remains the source of truth for static demos.
 *
 * Requires a local server or GitHub Pages (ESM + relative chunk imports).
 *
 * Refresh vendor (maintainer):
 *   `npm pack mermaid@11.16.1`
 *   copy `package/dist/mermaid.esm.min.mjs` → `app/vendor/mermaid/`
 *   copy `package/dist/chunks/mermaid.esm.min/*.mjs` →
 *     `app/vendor/mermaid/chunks/mermaid.esm.min/` (omit `.map` / `.d.ts`)
 */

import mermaid from "../vendor/mermaid/mermaid.esm.min.mjs";
import { APP_CONFIG } from "../config.js";
import { setHidden } from "../utils/dom.js";

/** @type {const} */
export const MERMAID_VERSION = "11.16.1";

export const EMPTY_DIAGRAM_SOURCE_MESSAGE = "Diagram source is empty";

const DEFAULT_ARIA_LABEL = "Diagram";
const SOURCE_SELECTOR = ".diagram-source";
const CANVAS_CLASS = "diagram-canvas";
const ERROR_CLASS = "diagram-error";

let renderSeq = 0;
let mermaidConfigured = false;

/**
 * @returns {"default" | "dark"}
 */
function resolveMermaidTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "default";
}

/**
 * @param {"default" | "dark"} [theme]
 */
function ensureMermaidConfig(theme = resolveMermaidTheme()) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme,
  });
  mermaidConfigured = true;
}

/**
 * @param {HTMLElement} el
 * @param {unknown} ariaLabelOption
 * @returns {string}
 */
export function resolveDiagramAriaLabel(el, ariaLabelOption) {
  if (typeof ariaLabelOption === "string" && ariaLabelOption.trim()) {
    return ariaLabelOption.trim();
  }
  const fromAttr = el.getAttribute("aria-label");
  if (fromAttr?.trim()) return fromAttr.trim();
  return DEFAULT_ARIA_LABEL;
}

/**
 * @param {HTMLElement} el
 * @param {unknown} sourceOption
 * @returns {string}
 */
export function resolveDiagramSource(el, sourceOption) {
  if (typeof sourceOption === "string" && sourceOption.trim()) {
    return sourceOption.trim();
  }
  const sourceEl = el.querySelector(SOURCE_SELECTOR);
  if (sourceEl) {
    const text = sourceEl.textContent?.trim() ?? "";
    if (text) return text;
  }
  return "";
}

/**
 * @param {HTMLElement} el
 * @returns {{ canvas: HTMLElement, error: HTMLElement }}
 */
function ensureChrome(el) {
  let canvas = el.querySelector(`:scope > .${CANVAS_CLASS}`);
  if (!(canvas instanceof HTMLElement)) {
    canvas = document.createElement("div");
    canvas.className = CANVAS_CLASS;
    el.append(canvas);
  }

  let error = el.querySelector(`:scope > .${ERROR_CLASS}`);
  if (!(error instanceof HTMLElement)) {
    error = document.createElement("p");
    error.className = ERROR_CLASS;
    error.setAttribute("role", "alert");
    el.append(error);
  }

  for (const sourceEl of el.querySelectorAll(SOURCE_SELECTOR)) {
    if (sourceEl instanceof HTMLElement) setHidden(sourceEl, true);
  }

  setHidden(error, true);
  return { canvas, error };
}

/**
 * Mount Mermaid into a `.diagram` host.
 *
 * @param {HTMLElement | null | undefined} el
 * @param {{
 *   source?: string,
 *   ariaLabel?: string,
 * }} [options]
 * @returns {{
 *   update: (partial?: { source?: string, ariaLabel?: string }) => void,
 *   destroy: () => void,
 * } | null}
 */
export function initDiagram(el, options = {}) {
  if (!(el instanceof HTMLElement)) return null;
  if (!el.classList.contains("diagram")) return null;
  if (el.dataset.diagramInit !== undefined) return null;

  const initialSource = resolveDiagramSource(el, options.source);
  if (!initialSource) return null;

  el.dataset.diagramInit = "";

  let currentSource = initialSource;
  let currentAriaLabel = resolveDiagramAriaLabel(el, options.ariaLabel);
  el.setAttribute("aria-label", currentAriaLabel);

  const { canvas, error } = ensureChrome(el);
  let destroyed = false;
  let renderGeneration = 0;

  if (!mermaidConfigured) {
    ensureMermaidConfig();
  }

  function showEmptySource() {
    renderGeneration += 1;
    canvas.innerHTML = "";
    error.textContent = EMPTY_DIAGRAM_SOURCE_MESSAGE;
    setHidden(error, false);
  }

  /**
   * @returns {Promise<void>}
   */
  async function renderCurrent() {
    if (!currentSource) {
      showEmptySource();
      return;
    }

    const generation = ++renderGeneration;
    const theme = resolveMermaidTheme();
    ensureMermaidConfig(theme);

    setHidden(error, true);
    error.textContent = "";

    try {
      const id = `mermaid-${++renderSeq}`;
      const { svg, bindFunctions } = await mermaid.render(id, currentSource);
      if (destroyed || generation !== renderGeneration) return;
      canvas.innerHTML = svg;
      bindFunctions?.(canvas);
    } catch (err) {
      if (destroyed || generation !== renderGeneration) return;
      canvas.innerHTML = "";
      const message =
        err && typeof err === "object" && "str" in err && typeof err.str === "string"
          ? err.str
          : err instanceof Error
            ? err.message
            : "Failed to render diagram";
      error.textContent = message;
      setHidden(error, false);
    }
  }

  void renderCurrent();

  function onThemeChange() {
    void renderCurrent();
  }

  document.addEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);

  return {
    /**
     * @param {{ source?: string, ariaLabel?: string }} [partial]
     */
    update(partial = {}) {
      if (destroyed) return;
      if (partial.source !== undefined) {
        currentSource =
          typeof partial.source === "string" ? partial.source.trim() : "";
      }
      if (partial.ariaLabel !== undefined) {
        currentAriaLabel = resolveDiagramAriaLabel(el, partial.ariaLabel);
        el.setAttribute("aria-label", currentAriaLabel);
      }
      if (!currentSource) {
        showEmptySource();
        return;
      }
      void renderCurrent();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      renderGeneration += 1;
      document.removeEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);
      canvas.innerHTML = "";
      error.textContent = "";
      setHidden(error, true);
      delete el.dataset.diagramInit;
    },
  };
}

/**
 * Wire every `.diagram` host in `root` that has a resolvable source
 * (markup `.diagram-source` and/or `optionsById[id].source`).
 *
 * @param {ParentNode} [root]
 * @param {Record<string, { source?: string, ariaLabel?: string }>} [optionsById]
 * @returns {NonNullable<ReturnType<typeof initDiagram>>[]}
 */
export function initDiagrams(root = document, optionsById = {}) {
  const instances = [];
  for (const el of root.querySelectorAll(".diagram")) {
    if (!(el instanceof HTMLElement)) continue;
    const id = el.id;
    const options = id && optionsById[id] ? optionsById[id] : {};
    const instance = initDiagram(el, options);
    if (instance) instances.push(instance);
  }
  return instances;
}
