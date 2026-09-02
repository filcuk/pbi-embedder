/**
 * Colour picker — spectrum / channel selector, popup or embedded.
 *
 * Markup (popup — default):
 *   <div class="color-picker" data-color-picker-default="#0969da">
 *     <button type="button" class="btn color-picker-trigger" aria-expanded="false"
 *       aria-label="Open colour picker">Colour picker</button>
 *     <div class="color-picker-popup hidden" role="dialog" aria-label="Colour picker" hidden>
 *       <div class="color-picker-shell">
 *         <div class="color-picker-panel"></div>
 *         <div class="color-set color-picker-sets hidden" data-color-set-embedded hidden>
 *           <div class="color-set-panel">
 *             <select id="…" class="input color-set-select" aria-label="Colour set"></select>
 *             <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
 *           </div>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 *
 * Markup (embedded):
 *   <div class="color-picker" data-color-picker-embedded data-color-picker-default="#0969da">
 *     <div class="color-picker-shell">
 *       <div class="color-picker-panel"></div>
 *     </div>
 *   </div>
 *
 * data-color-picker-embedded — always-visible panel
 * data-color-picker-default — initial hex
 * data-color-picker-alpha — enable alpha channel
 * data-color-picker-format — hex | rgb | hsl | hsv | cmyk (default hsv)
 * data-color-picker-color-set — enable adjacent colour-set panel (requires `.color-picker-sets`)
 */

import { parseBooleanAttr, setHidden } from "../../utils/dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../../utils/document-listeners.js";
import { initColorSet } from "../color-set/index.js";
import {
  DEFAULT_PICKER_RGBA,
  FORMATS,
  hexFromRgba,
  mountColorPickerPanel,
  normalizeFormat,
  rgbaFromHex,
  rgbaFromHexOrDefault,
} from "./panel.js";

function resolveEmbedded(pickerEl, embeddedOption) {
  if (typeof embeddedOption === "boolean") return embeddedOption;
  return (
    pickerEl.hasAttribute("data-color-picker-embedded") ||
    parseBooleanAttr(pickerEl.dataset.colorPickerEmbedded) === true
  );
}

function resolveAlpha(pickerEl, alphaOption) {
  if (typeof alphaOption === "boolean") return alphaOption;
  return parseBooleanAttr(pickerEl.dataset.colorPickerAlpha) ?? false;
}

function resolveColorSet(pickerEl, colorSetOption) {
  if (typeof colorSetOption === "boolean") return colorSetOption;
  if (colorSetOption && typeof colorSetOption === "object") return true;
  return (
    pickerEl.hasAttribute("data-color-picker-color-set") ||
    parseBooleanAttr(pickerEl.dataset.colorPickerColorSet) === true
  );
}

/**
 * @param {HTMLElement} pickerEl
 * @param {object} [options]
 * @param {boolean} [options.embedded]
 * @param {string} [options.defaultValue]
 * @param {boolean} [options.alpha]
 * @param {string} [options.format]
 * @param {boolean | object} [options.colorSet]
 * @param {(payload: object) => void} [options.onChange]
 * @param {(payload: object) => void} [options.onInput]
 */
export function initColorPicker(
  pickerEl,
  {
    embedded,
    defaultValue,
    alpha,
    format,
    colorSet,
    onChange,
    onInput,
  } = {}
) {
  if (!(pickerEl instanceof HTMLElement)) return null;
  if (pickerEl.dataset.colorPickerInit !== undefined) return null;

  const allowAlpha = resolveAlpha(pickerEl, alpha);
  const isEmbedded = resolveEmbedded(pickerEl, embedded);
  const enableColorSet = resolveColorSet(pickerEl, colorSet);
  const colorSetOptions =
    colorSet && typeof colorSet === "object" && !Array.isArray(colorSet) ? colorSet : {};

  const trigger = pickerEl.querySelector(".color-picker-trigger");
  const popup = pickerEl.querySelector(".color-picker-popup");
  const shell =
    pickerEl.querySelector(".color-picker-shell") ||
    popup?.querySelector(".color-picker-shell");
  const panelEl =
    pickerEl.querySelector(".color-picker-panel") ||
    shell?.querySelector(".color-picker-panel");
  const setsHost =
    pickerEl.querySelector(".color-picker-sets") ||
    shell?.querySelector(".color-picker-sets");

  if (!panelEl) return null;
  if (!isEmbedded && (!trigger || !popup || !shell)) return null;
  if (isEmbedded && !shell) return null;

  pickerEl.dataset.colorPickerInit = "";
  pickerEl.classList.toggle("color-picker--embedded", isEmbedded);
  pickerEl.classList.toggle("color-picker--alpha", allowAlpha);

  let currentFormat = normalizeFormat(
    format ?? pickerEl.dataset.colorPickerFormat ?? "hsv"
  );
  let rgba = rgbaFromHexOrDefault(
    defaultValue ?? pickerEl.dataset.colorPickerDefault ?? "#0969DA",
    { alpha: allowAlpha }
  );
  let isOpen = false;
  let setsOpen = false;

  /** @type {ReturnType<typeof mountColorPickerPanel> | null} */
  let panelApi = null;
  /** @type {ReturnType<typeof initColorSet> | null} */
  let colorSetApi = null;

  if (popup) {
    const popupId =
      popup.id || `color-picker-popup-${Math.random().toString(36).slice(2, 9)}`;
    if (!popup.id) popup.id = popupId;
    trigger?.setAttribute("aria-controls", popupId);
  }

  function buildPayload(source) {
    return {
      colorPickerEl: pickerEl,
      value: hexFromRgba(rgba, { alpha: allowAlpha }),
      rgba: { ...rgba },
      format: currentFormat,
      source,
    };
  }

  /** @type {HTMLElement | null} */
  let setsDivider = null;

  function syncSetsVisibility() {
    pickerEl.classList.toggle("color-picker--sets-open", setsOpen);
    if (setsHost) setHidden(setsHost, !setsOpen);
    panelApi?.update({ setsOpen });
  }

  function mountPanel() {
    panelApi?.destroy();
    panelApi = mountColorPickerPanel(panelEl, {
      rgba,
      format: currentFormat,
      alpha: allowAlpha,
      showSetsToggle: Boolean(enableColorSet && setsHost),
      setsOpen,
      onSetsToggle() {
        setsOpen = !setsOpen;
        syncSetsVisibility();
        if (setsOpen) {
          colorSetApi?.setValue(hexFromRgba(rgba, { alpha: allowAlpha }), {
            emit: false,
          });
        }
      },
      onFormatChange(nextFormat) {
        currentFormat = nextFormat;
        panelApi?.update({ format: currentFormat, rgba });
        onChange?.(buildPayload("format"));
      },
      onRgbaChange(next, { source }) {
        rgba = next;
        const syncPolar =
          source !== "plane" &&
          source !== "hue" &&
          source !== "hsl" &&
          source !== "hsv" &&
          source !== "alpha";
        panelApi?.update({ rgba, syncPolar });
        if (setsOpen) {
          colorSetApi?.setValue(hexFromRgba(rgba, { alpha: allowAlpha }), {
            emit: false,
          });
        }
        const payload = buildPayload(source);
        onInput?.(payload);
        onChange?.(payload);
      },
    });
  }

  if (enableColorSet && setsHost) {
    const dividerHost = shell || setsHost.parentElement;
    setsDivider =
      dividerHost?.querySelector(":scope > .color-picker-sets-divider") || null;
    if (setsDivider && setsDivider.tagName === "HR") {
      const replacement = document.createElement("div");
      replacement.className = "color-picker-sets-divider";
      replacement.setAttribute("aria-hidden", "true");
      replacement.setAttribute("role", "presentation");
      setsDivider.replaceWith(replacement);
      setsDivider = replacement;
    }
    if (!setsDivider && dividerHost) {
      setsDivider = document.createElement("div");
      setsDivider.className = "color-picker-sets-divider";
      setsDivider.setAttribute("aria-hidden", "true");
      setsDivider.setAttribute("role", "presentation");
      dividerHost.insertBefore(setsDivider, setsHost);
    }
    // Visibility is driven by `.color-picker--sets-open` CSS (keeps grid stretch reliable).

    colorSetApi = initColorSet(setsHost, {
      embedded: true,
      alpha: allowAlpha,
      closeOnSelect: false,
      value: hexFromRgba(rgba, { alpha: allowAlpha }),
      ...colorSetOptions,
      onSelect: ({ value }) => {
        if (!value) return;
        const next = rgbaFromHex(value, { alpha: allowAlpha });
        if (!next) return;
        rgba = next;
        panelApi?.update({ rgba });
        const payload = buildPayload("color-set");
        onInput?.(payload);
        onChange?.(payload);
      },
    });
    setHidden(setsHost, true);
  } else if (setsHost) {
    setHidden(setsHost, true);
  }

  mountPanel();
  syncSetsVisibility();

  /**
   * @param {{ focus?: boolean }} [options]
   */
  function open({ focus = true } = {}) {
    if (isEmbedded || isOpen || !popup) return;
    registerOpenPopup(close);
    isOpen = true;
    setHidden(popup, false);
    trigger?.setAttribute("aria-expanded", "true");
    if (focus) panelEl.querySelector("select, input, button")?.focus?.();
  }

  function close({ restoreFocus = false } = {}) {
    if (isEmbedded) return;
    panelApi?.closeMenu?.({ restoreFocus });
    unregisterOpenPopup(close);
    if (setsOpen) {
      setsOpen = false;
      syncSetsVisibility();
    }
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
    if (pickerEl.contains(event.target)) return;
    const hostInput = pickerEl.closest(".color-input");
    if (hostInput?.contains(event.target)) return;
    close();
  });

  const removeEscape = onDocumentEscape(
    () => {
      if (!isOpen && !isEmbedded) return false;
      if (setsOpen) {
        setsOpen = false;
        syncSetsVisibility();
        return true;
      }
      if (!isEmbedded && isOpen) {
        close();
        trigger?.focus();
        return true;
      }
      return false;
    },
    { priority: 50 }
  );

  if (isEmbedded) {
    if (popup) setHidden(popup, true);
    if (trigger) setHidden(trigger, true);
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
      return hexFromRgba(rgba, { alpha: allowAlpha });
    },
    getRgba() {
      return { ...rgba };
    },
    setValue(nextValue, { emit = true } = {}) {
      const parsed =
        nextValue === "" || nextValue === null || nextValue === undefined
          ? null
          : rgbaFromHex(String(nextValue), { alpha: allowAlpha });
      if (nextValue && !parsed) return false;
      if (!parsed) return false;
      rgba = parsed;
      panelApi?.update({ rgba });
      if (setsOpen) {
        colorSetApi?.setValue(hexFromRgba(rgba, { alpha: allowAlpha }), {
          emit: false,
        });
      }
      if (emit) onChange?.(buildPayload("api"));
      return true;
    },
    getFormat() {
      return currentFormat;
    },
    setFormat(nextFormat, { emit = true } = {}) {
      currentFormat = normalizeFormat(nextFormat);
      panelApi?.update({ format: currentFormat });
      if (emit) onChange?.(buildPayload("api"));
    },
    openColorSet() {
      if (!enableColorSet || !setsHost) return;
      setsOpen = true;
      syncSetsVisibility();
      colorSetApi?.setValue(hexFromRgba(rgba, { alpha: allowAlpha }), {
        emit: false,
      });
    },
    closeColorSet() {
      setsOpen = false;
      syncSetsVisibility();
    },
    destroy() {
      removeOutside();
      removeEscape();
      colorSetApi?.destroy();
      panelApi?.destroy();
      close();
      delete pickerEl.dataset.colorPickerInit;
    },
  };
}

/** Wire every `.color-picker` block in `root`. */
export function initColorPickers(root = document) {
  const instances = [];
  root.querySelectorAll(".color-picker").forEach((el) => {
    const instance = initColorPicker(el);
    if (instance) instances.push(instance);
  });
  return instances;
}

export {
  FORMATS,
  normalizeFormat,
  hexFromRgba,
  rgbaFromHex,
  rgbaFromHexOrDefault,
  DEFAULT_PICKER_RGBA,
};
