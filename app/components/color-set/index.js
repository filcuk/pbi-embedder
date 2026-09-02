/**
 * Colour set gallery — named palette swatches, popup or embedded.
 *
 * Markup (popup — default):
 *   <div class="color-set">
 *     <button type="button" class="btn color-set-trigger" aria-expanded="false"
 *       aria-label="Open colour set">Colour set</button>
 *     <div class="color-set-popup hidden" role="dialog" aria-label="Colour set" hidden>
 *       <div class="color-set-panel">
 *         <select id="my-color-set-select" class="input color-set-select"
 *           aria-label="Colour set"></select>
 *         <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Markup (embedded):
 *   <div class="color-set" data-color-set-embedded>
 *     <div class="color-set-panel">…</div>
 *   </div>
 *
 * data-color-set-embedded — always-visible panel (no popup)
 * data-color-set-sets — comma-separated set ids to show (default: all registered)
 * data-color-set-default — initial set id
 * data-color-set-value — initial selected hex
 * data-color-set-alpha — allow alpha hex in set entries / selection
 * data-color-set-close-on-select — close popup after pick (default true)
 */

import { parseBooleanAttr, setHidden } from "../../utils/dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../../utils/document-listeners.js";
import { parseHexColor } from "../../utils/color.js";
import { getColorSet, listColorSets } from "./registry.js";
import { ensureBuiltinColorSets } from "./sets/index.js";
import { renderColorSetPanel } from "./panel.js";

function resolveEmbedded(colorSetEl, embeddedOption) {
  if (typeof embeddedOption === "boolean") return embeddedOption;
  return (
    colorSetEl.hasAttribute("data-color-set-embedded") ||
    parseBooleanAttr(colorSetEl.dataset.colorSetEmbedded) === true
  );
}

function resolveAlpha(colorSetEl, alphaOption) {
  if (typeof alphaOption === "boolean") return alphaOption;
  return parseBooleanAttr(colorSetEl.dataset.colorSetAlpha) ?? false;
}

function resolveCloseOnSelect(colorSetEl, closeOnSelectOption, embedded) {
  if (embedded) return false;
  if (typeof closeOnSelectOption === "boolean") return closeOnSelectOption;
  const fromAttr = parseBooleanAttr(colorSetEl.dataset.colorSetCloseOnSelect);
  return fromAttr ?? true;
}

function parseSetsAttr(raw) {
  if (!raw || typeof raw !== "string") return null;
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return ids.length ? ids : null;
}

/**
 * @param {HTMLElement} colorSetEl
 * @param {object} [options]
 * @param {boolean} [options.embedded]
 * @param {string[] | string} [options.sets]
 * @param {string} [options.defaultSet]
 * @param {string | null} [options.value]
 * @param {boolean} [options.alpha]
 * @param {boolean} [options.closeOnSelect]
 * @param {(payload: object) => void} [options.onSelect]
 * @param {(payload: object) => void} [options.onChange]
 */
export function initColorSet(
  colorSetEl,
  {
    embedded,
    sets,
    defaultSet,
    value,
    alpha,
    closeOnSelect,
    onSelect,
    onChange,
  } = {}
) {
  if (!(colorSetEl instanceof HTMLElement)) return null;
  if (colorSetEl.dataset.colorSetInit !== undefined) return null;

  ensureBuiltinColorSets();

  const allowAlpha = resolveAlpha(colorSetEl, alpha);
  const isEmbedded = resolveEmbedded(colorSetEl, embedded);
  const shouldCloseOnSelect = resolveCloseOnSelect(
    colorSetEl,
    closeOnSelect,
    isEmbedded
  );

  const trigger = colorSetEl.querySelector(".color-set-trigger");
  const popup = colorSetEl.querySelector(".color-set-popup");
  const panel =
    colorSetEl.querySelector(".color-set-panel") ||
    popup?.querySelector(".color-set-panel");
  const selectEl = panel?.querySelector(".color-set-select") ?? null;
  const gridEl = panel?.querySelector(".color-set-grid") ?? null;

  if (!panel || !gridEl) return null;
  if (!isEmbedded && (!trigger || !popup)) return null;

  colorSetEl.dataset.colorSetInit = "";
  colorSetEl.classList.toggle("color-set--embedded", isEmbedded);

  const setIdsOption =
    (Array.isArray(sets) ? sets : parseSetsAttr(sets)) ??
    parseSetsAttr(colorSetEl.dataset.colorSetSets);

  function resolveAvailableSets() {
    const all = listColorSets();
    if (!setIdsOption?.length) return all;
    /** @type {import('./registry.js').ColorSet[]} */
    const picked = [];
    for (const id of setIdsOption) {
      const set = getColorSet(id);
      if (set) picked.push(set);
    }
    return picked.length ? picked : all;
  }

  let availableSets = resolveAvailableSets();
  let activeSetId =
    defaultSet ??
    colorSetEl.dataset.colorSetDefault ??
    availableSets[0]?.id ??
    "";
  if (!availableSets.some((set) => set.id === activeSetId)) {
    activeSetId = availableSets[0]?.id ?? "";
  }

  let selectedHex = parseHexColor(
    value ?? colorSetEl.dataset.colorSetValue ?? "",
    { alpha: allowAlpha }
  );
  let isOpen = false;

  if (popup) {
    const popupId = popup.id || `color-set-popup-${Math.random().toString(36).slice(2, 9)}`;
    if (!popup.id) popup.id = popupId;
    trigger?.setAttribute("aria-controls", popupId);
    if (isEmbedded) {
      setHidden(popup, true);
    }
  }

  function buildPayload(source) {
    const active = availableSets.find((set) => set.id === activeSetId) ?? null;
    const swatch = active?.colors.find(
      (color) => color.hex.toUpperCase() === selectedHex?.toUpperCase()
    );
    return {
      colorSetEl,
      value: selectedHex,
      name: swatch?.name,
      setId: activeSetId,
      source,
    };
  }

  function refreshPanel() {
    availableSets = resolveAvailableSets();
    if (!availableSets.some((set) => set.id === activeSetId)) {
      activeSetId = availableSets[0]?.id ?? "";
    }
    renderColorSetPanel({
      selectEl,
      gridEl,
      sets: availableSets,
      activeSetId,
      selectedHex,
      onSetChange(nextId) {
        activeSetId = nextId;
        refreshPanel();
        onChange?.(buildPayload("set"));
      },
      onSwatchSelect({ hex, name: _name, setId }) {
        selectedHex = hex;
        activeSetId = setId;
        refreshPanel();
        const payload = buildPayload("select");
        onSelect?.(payload);
        onChange?.(payload);
        if (shouldCloseOnSelect) close();
      },
    });
  }

  /**
   * @param {{ focus?: boolean }} [options]
   */
  function open({ focus = true } = {}) {
    if (isEmbedded || isOpen || !popup) return;
    registerOpenPopup(close);
    isOpen = true;
    setHidden(popup, false);
    trigger?.setAttribute("aria-expanded", "true");
    if (focus) selectEl?.focus();
  }

  function close() {
    if (isEmbedded) return;
    unregisterOpenPopup(close);
    if (!isOpen || !popup) return;
    isOpen = false;
    setHidden(popup, true);
    trigger?.setAttribute("aria-expanded", "false");
  }

  function toggle() {
    if (isOpen) close();
    else open();
  }

  trigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggle();
  });

  popup?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  const removeOutside = onDocumentClickOutside((event) => {
    if (!isOpen) return;
    if (colorSetEl.contains(event.target)) return;
    const hostInput = colorSetEl.closest(".color-input");
    if (hostInput?.contains(event.target)) return;
    close();
  });

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    close();
    trigger?.focus();
    return true;
  }, { priority: 50 });

  refreshPanel();

  if (isEmbedded) {
    setHidden(popup, true);
    trigger && setHidden(trigger, true);
  } else if (popup) {
    setHidden(popup, true);
    trigger?.setAttribute("aria-expanded", "false");
  }

  return {
    open,
    close,
    isOpen() {
      return isOpen;
    },
    isEmbedded() {
      return isEmbedded;
    },
    getValue() {
      return selectedHex;
    },
    setValue(nextValue, { emit = true } = {}) {
      const parsed =
        nextValue === "" || nextValue === null || nextValue === undefined
          ? null
          : parseHexColor(nextValue, { alpha: allowAlpha });
      if (nextValue && !parsed) return false;
      selectedHex = parsed;
      refreshPanel();
      if (emit) onChange?.(buildPayload("api"));
      return true;
    },
    getSetId() {
      return activeSetId;
    },
    setSetId(nextId, { emit = true } = {}) {
      if (!availableSets.some((set) => set.id === nextId)) return false;
      activeSetId = nextId;
      refreshPanel();
      if (emit) onChange?.(buildPayload("api"));
      return true;
    },
    destroy() {
      removeOutside();
      removeEscape();
      close();
      delete colorSetEl.dataset.colorSetInit;
    },
  };
}

/** Wire every `.color-set` block in `root`. */
export function initColorSets(root = document) {
  const instances = [];
  root.querySelectorAll(".color-set").forEach((el) => {
    const instance = initColorSet(el);
    if (instance) instances.push(instance);
  });
  return instances;
}

export {
  registerColorSet,
  getColorSet,
  listColorSets,
  clearColorSets,
  normalizeColorEntry,
} from "./registry.js";
export { ensureBuiltinColorSets } from "./sets/index.js";
