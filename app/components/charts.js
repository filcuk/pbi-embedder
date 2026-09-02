/**
 * Charts — thin host around vendored TanStack Charts (`mountChart`).
 *
 * Markup:
 *   <div class="charts" id="my-chart" data-charts-height="320"
 *     aria-label="Example sales"></div>
 *
 * data-charts-height — chart height in CSS pixels (default `320`)
 *
 * Callers author the TanStack definition (`defineChart`, marks, scales) and
 * pass it to `initChart`. Prefer narrow vendor entry files over the root
 * barrel so unused marks stay out of the module graph, e.g.:
 *   ../vendor/tanstack-charts/scene.js
 *   ../vendor/tanstack-charts/bar.js
 *   ../vendor/tanstack-charts/tooltip.js
 *   ../vendor/tanstack-charts/scales/band.js
 *   ../vendor/tanstack-charts/scales/linear.js
 *
 * Pages that use marks which bare-import `d3-scale` or `d3-shape`
 * (including `barY` / `barX`, which pull `stack-internal`) must include an
 * import map before any `type="module"` script:
 *   {
 *     "imports": {
 *       "d3-scale": "./app/vendor/d3-scale/d3-scale.esm.js",
 *       "d3-shape": "./app/vendor/d3-shape/d3-shape.esm.js"
 *     }
 *   }
 *
 * Refresh vendor (maintainer):
 *   1. `npm pack @tanstack/charts@0.9.0` — copy `package/dist/*.js` and
 *      `package/dist/scales/*.js` into `app/vendor/tanstack-charts/` (omit
 *      framework adapter folders and `.d.ts`).
 *   2. Download self-contained bundles:
 *      `https://esm.sh/d3-scale@4.0.2/es2022/d3-scale.bundle.mjs`
 *        → `app/vendor/d3-scale/d3-scale.esm.js`
 *      `https://esm.sh/d3-shape@3.2.0/es2022/d3-shape.bundle.mjs`
 *        → `app/vendor/d3-shape/d3-shape.esm.js`
 */

import { mountChart } from "../vendor/tanstack-charts/dom.js";
import { APP_CONFIG } from "../config.js";

/** @type {const} */
export const TANSTACK_CHARTS_VERSION = "0.9.0";

/** @type {const} */
export const D3_SCALE_VERSION = "4.0.2";

/** @type {const} */
export const D3_SHAPE_VERSION = "3.2.0";

const DEFAULT_HEIGHT = 320;
const DEFAULT_ARIA_LABEL = "Chart";

/**
 * @param {HTMLElement} el
 * @param {unknown} heightOption
 * @returns {number}
 */
function resolveHeight(el, heightOption) {
  if (typeof heightOption === "number" && Number.isFinite(heightOption) && heightOption > 0) {
    return heightOption;
  }
  const fromAttr = el.dataset.chartsHeight;
  if (fromAttr !== undefined && fromAttr !== "") {
    const parsed = Number(fromAttr);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_HEIGHT;
}

/**
 * @param {HTMLElement} el
 * @param {unknown} ariaLabelOption
 * @returns {string}
 */
function resolveAriaLabel(el, ariaLabelOption) {
  if (typeof ariaLabelOption === "string" && ariaLabelOption.trim()) {
    return ariaLabelOption.trim();
  }
  const fromAttr = el.getAttribute("aria-label");
  if (fromAttr?.trim()) return fromAttr.trim();
  return DEFAULT_ARIA_LABEL;
}

/**
 * Mount a TanStack Charts definition into a `.charts` host.
 *
 * @param {HTMLElement | null | undefined} el
 * @param {{
 *   definition?: unknown,
 *   height?: number,
 *   ariaLabel?: string,
 *   onFocusChange?: ((point: unknown) => void) | null,
 * }} [options]
 * @returns {{
 *   update: (partial?: object) => void,
 *   getHost: () => ReturnType<typeof mountChart>,
 *   destroy: () => void,
 * } | null}
 */
export function initChart(el, options = {}) {
  if (!(el instanceof HTMLElement)) return null;
  if (!el.classList.contains("charts")) return null;
  if (el.dataset.chartsInit !== undefined) return null;

  const { definition, height, ariaLabel, onFocusChange } = options;
  if (!definition) return null;

  el.dataset.chartsInit = "";

  /** @type {unknown} */
  let currentDefinition = definition;
  let currentHeight = resolveHeight(el, height);
  let currentAriaLabel = resolveAriaLabel(el, ariaLabel);
  /** @type {((point: unknown) => void) | null | undefined} */
  let currentOnFocusChange = onFocusChange;

  function buildMountOptions() {
    const mountOptions = {
      definition: currentDefinition,
      height: currentHeight,
      ariaLabel: currentAriaLabel,
    };
    if (typeof currentOnFocusChange === "function") {
      mountOptions.onFocusChange = currentOnFocusChange;
    }
    return mountOptions;
  }

  const host = mountChart(el, buildMountOptions());

  function onThemeChange() {
    host.update(buildMountOptions());
  }

  document.addEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);

  let destroyed = false;

  return {
    /**
     * Update mount options and/or replace the chart definition.
     * @param {{
     *   definition?: unknown,
     *   height?: number,
     *   ariaLabel?: string,
     *   onFocusChange?: ((point: unknown) => void) | null,
     * }} [partial]
     */
    update(partial = {}) {
      if (destroyed) return;
      if (partial.definition !== undefined) currentDefinition = partial.definition;
      if (partial.height !== undefined) {
        currentHeight = resolveHeight(el, partial.height);
      }
      if (partial.ariaLabel !== undefined) {
        currentAriaLabel = resolveAriaLabel(el, partial.ariaLabel);
      }
      if ("onFocusChange" in partial) {
        currentOnFocusChange = partial.onFocusChange;
      }
      host.update(buildMountOptions());
    },

    getHost() {
      return host;
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      document.removeEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);
      host.destroy();
      delete el.dataset.chartsInit;
    },
  };
}

/**
 * Wire every `.charts` host in `root`.
 * Pass `optionsById` (element `id` → options including `definition`) for hosts
 * that need a chart definition. Hosts without a matching entry are skipped.
 *
 * @param {ParentNode} [root]
 * @param {Record<string, {
 *   definition?: unknown,
 *   height?: number,
 *   ariaLabel?: string,
 *   onFocusChange?: ((point: unknown) => void) | null,
 * }>} [optionsById]
 * @returns {NonNullable<ReturnType<typeof initChart>>[]}
 */
export function initCharts(root = document, optionsById = {}) {
  const instances = [];
  for (const el of root.querySelectorAll(".charts")) {
    if (!(el instanceof HTMLElement)) continue;
    const id = el.id;
    const options = id && optionsById[id] ? optionsById[id] : null;
    if (!options?.definition) continue;
    const instance = initChart(el, options);
    if (instance) instances.push(instance);
  }
  return instances;
}
