/**
 * Hex color input with an inline swatch preview.
 *
 * Markup:
 *   <div class="color-input" data-color-input-default="#0969da">
 *     <label class="field-label" for="my-color-input">Colour</label>
 *     <div class="color-input-control">
 *       <span class="color-input-swatch" aria-hidden="true"></span>
 *       <input type="text" id="my-color-input" class="input color-input-field"
 *         autocomplete="off" spellcheck="false" aria-label="Hex colour" />
 *       <input type="hidden" class="color-input-value" name="color" />
 *     </div>
 *   </div>
 *
 * Optional open target (nest a `.color-set` and/or `.color-picker`, or pass APIs):
 *   data-color-input-open="none" | "picker" | "set" | "both"
 * Optional open trigger (when open is not none):
 *   data-color-input-open-trigger="either" | "swatch" | "input"  (default either)
 *
 * data-color-input-default — initial hex value (#RGB / #RRGGBB; with alpha also #RGBA / #RRGGBBAA)
 * data-color-input-alpha — allow 4- and 8-digit hex with alpha
 * data-color-input-disabled — disable the control
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";
import { openPopupGroup } from "../utils/document-listeners.js";
import { isPartialHexInput, paintHexMirror, parseHexColor } from "../utils/color.js";
import { initColorSet } from "./color-set/index.js";
import { initColorPicker } from "./color-picker/index.js";

export { parseHexColor };

const OPEN_MODES = new Set(["none", "picker", "set", "both"]);
const OPEN_TRIGGERS = new Set(["either", "swatch", "input"]);

function formatDisplayValue(value) {
  return value ?? "";
}

function resolveDisabled(colorInputEl, disabledOption) {
  if (typeof disabledOption === "boolean") return disabledOption;
  return parseBooleanAttr(colorInputEl?.dataset.colorInputDisabled) ?? false;
}

function resolveAlpha(colorInputEl, alphaOption) {
  if (typeof alphaOption === "boolean") return alphaOption;
  return parseBooleanAttr(colorInputEl?.dataset.colorInputAlpha) ?? false;
}

/**
 * @param {unknown} raw
 * @returns {"none" | "picker" | "set" | "both"}
 */
function resolveOpenOnClick(colorInputEl, openOnClickOption) {
  const raw =
    openOnClickOption ?? colorInputEl?.dataset.colorInputOpen ?? "none";
  const value = String(raw).trim().toLowerCase();
  return OPEN_MODES.has(value) ? /** @type {"none" | "picker" | "set" | "both"} */ (value) : "none";
}

/**
 * @param {unknown} raw
 * @returns {"either" | "swatch" | "input"}
 */
function resolveOpenTrigger(colorInputEl, openTriggerOption) {
  const raw =
    openTriggerOption ?? colorInputEl?.dataset.colorInputOpenTrigger ?? "either";
  const value = String(raw).trim().toLowerCase();
  if (value === "image") return "swatch";
  if (value === "field") return "input";
  return OPEN_TRIGGERS.has(value)
    ? /** @type {"either" | "swatch" | "input"} */ (value)
    : "either";
}

function syncSwatch(swatchEl, color) {
  if (!swatchEl) return;
  swatchEl.classList.toggle("is-empty", !color);
  if (color) {
    swatchEl.style.setProperty("--color-input-preview", color);
  } else {
    swatchEl.style.removeProperty("--color-input-preview");
  }
}

function isPartnerApi(value) {
  return Boolean(value && typeof value === "object" && typeof value.open === "function");
}

/**
 * @param {HTMLElement} hostEl
 */
function hidePartnerTrigger(hostEl) {
  const trigger =
    hostEl.querySelector(".color-set-trigger") ||
    hostEl.querySelector(".color-picker-trigger");
  if (trigger instanceof HTMLElement) setHidden(trigger, true);
}

/**
 * @param {HTMLElement} colorInputEl
 * @param {string} selector
 */
function findNestedPartner(colorInputEl, selector) {
  return (
    colorInputEl.querySelector(`.color-input-control > ${selector}`) ||
    colorInputEl.querySelector(`:scope > ${selector}`)
  );
}

export function initColorInput(
  colorInputEl,
  {
    defaultValue,
    alpha,
    disabled,
    openOnClick,
    openTrigger,
    colorSet,
    picker,
    onChange,
    onInput,
  } = {}
) {
  if (!colorInputEl) return null;

  const textInput = colorInputEl.querySelector(".color-input-field");
  const hiddenInput = colorInputEl.querySelector(".color-input-value");
  const swatchEl = colorInputEl.querySelector(".color-input-swatch");

  if (!textInput || !swatchEl) return null;

  // Drop the old static hash prefix if present.
  colorInputEl.querySelector(".color-input-hash")?.remove();

  let fieldShell = textInput.closest(".color-input-field-shell");
  if (!fieldShell) {
    fieldShell = document.createElement("div");
    fieldShell.className = "color-input-field-shell";
    textInput.before(fieldShell);
    fieldShell.append(textInput);
  }
  let mirrorEl = fieldShell.querySelector(".color-input-mirror");
  if (!mirrorEl) {
    mirrorEl = document.createElement("div");
    mirrorEl.className = "color-input-mirror";
    mirrorEl.setAttribute("aria-hidden", "true");
    textInput.before(mirrorEl);
  }

  const allowAlpha = resolveAlpha(colorInputEl, alpha);
  const openMode = resolveOpenOnClick(colorInputEl, openOnClick);
  const triggerMode =
    openMode === "none" ? "either" : resolveOpenTrigger(colorInputEl, openTrigger);
  const swatchOpens = openMode !== "none" && (triggerMode === "swatch" || triggerMode === "either");
  const inputOpens = openMode !== "none" && (triggerMode === "input" || triggerMode === "either");

  colorInputEl.classList.toggle("color-input--open", openMode !== "none");
  colorInputEl.classList.toggle("color-input--open-swatch", swatchOpens);
  colorInputEl.classList.toggle("color-input--open-input", inputOpens);
  colorInputEl.classList.toggle("color-input--alpha", allowAlpha);

  const parse = (value) => parseHexColor(value, { alpha: allowAlpha });

  const initialRaw =
    defaultValue ??
    colorInputEl.dataset.colorInputDefault ??
    hiddenInput?.value ??
    textInput.value;
  let currentValue = parse(initialRaw);
  let isEditing = false;
  let isDisabled = resolveDisabled(colorInputEl, disabled);
  let syncingFromPartner = false;

  /** @type {ReturnType<typeof initColorSet> | null} */
  let colorSetApi = null;
  /** @type {ReturnType<typeof initColorPicker> | null} */
  let pickerApi = null;

  function buildPayload(source) {
    return {
      colorInputEl,
      value: currentValue,
      display: formatDisplayValue(currentValue),
      source,
    };
  }

  function applyDisabled(nextDisabled) {
    isDisabled = nextDisabled;
    colorInputEl.classList.toggle("color-input--disabled", nextDisabled);
    textInput.disabled = nextDisabled;
    if (nextDisabled) {
      colorSetApi?.close?.();
      pickerApi?.close?.();
    }
  }

  applyDisabled(isDisabled);

  function syncPartnersFromInput(nextValue = currentValue) {
    if (syncingFromPartner) return;
    colorSetApi?.setValue?.(nextValue, { emit: false });
    if (nextValue) {
      pickerApi?.setValue?.(nextValue, { emit: false });
    }
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    if (!isEditing) {
      textInput.value = formatDisplayValue(currentValue);
    }
    paintHexMirror(mirrorEl, textInput.value);
    if (hiddenInput) {
      hiddenInput.value = currentValue ?? "";
    }
    syncSwatch(swatchEl, currentValue);
    syncPartnersFromInput();

    if (emit) {
      onChange?.(buildPayload(source));
    }
  }

  function setValue(nextValue, { emit = true, source = "api" } = {}) {
    const parsed =
      nextValue === "" || nextValue === null || nextValue === undefined
        ? null
        : parse(nextValue);
    if (nextValue && !parsed) return false;
    currentValue = parsed;
    isEditing = false;
    textInput.removeAttribute("aria-invalid");
    syncDom({ emit, source });
    return true;
  }

  function applyFromPartner(nextValue, source) {
    syncingFromPartner = true;
    setValue(nextValue, { emit: true, source });
    syncingFromPartner = false;
  }

  function commitTypedValue({ emit = true } = {}) {
    const raw = String(textInput.value).trim();
    if (!raw) {
      currentValue = null;
      isEditing = false;
      textInput.removeAttribute("aria-invalid");
      syncDom({ emit, source: "input" });
      return true;
    }

    const parsed = parse(raw);
    if (!parsed) {
      textInput.value = formatDisplayValue(currentValue);
      paintHexMirror(mirrorEl, textInput.value);
      textInput.removeAttribute("aria-invalid");
      isEditing = false;
      syncSwatch(swatchEl, currentValue);
      return false;
    }

    currentValue = parsed;
    isEditing = false;
    textInput.removeAttribute("aria-invalid");
    syncDom({ emit, source: "input" });
    return true;
  }

  function openTargets({ focus = true } = {}) {
    // `both` shows the set and the picker side by side — keep them as one unit.
    openPopupGroup(() => {
      if (openMode === "set" || openMode === "both") colorSetApi?.open?.({ focus });
      if (openMode === "picker" || openMode === "both") pickerApi?.open?.({ focus });
    });
  }

  function closeTargets() {
    colorSetApi?.close?.();
    pickerApi?.close?.();
  }

  function toggleTargets() {
    const setOpen = Boolean(colorSetApi?.isOpen?.());
    const pickerOpen = Boolean(pickerApi?.isOpen?.());
    if (
      (openMode === "set" && setOpen) ||
      (openMode === "picker" && pickerOpen) ||
      (openMode === "both" && (setOpen || pickerOpen))
    ) {
      closeTargets();
      return;
    }
    openTargets();
  }

  if (openMode === "set" || openMode === "both") {
    if (isPartnerApi(colorSet)) {
      colorSetApi = /** @type {ReturnType<typeof initColorSet>} */ (colorSet);
    } else {
      const host =
        colorSet instanceof HTMLElement
          ? colorSet
          : findNestedPartner(colorInputEl, ".color-set");
      if (host instanceof HTMLElement) {
        colorSetApi = initColorSet(host, {
          value: currentValue,
          alpha: allowAlpha,
          onSelect: ({ value }) => {
            if (!value) return;
            applyFromPartner(value, "color-set");
          },
        });
        hidePartnerTrigger(host);
        host.classList.add("color-input-partner");
      }
    }
  }

  if (openMode === "picker" || openMode === "both") {
    if (isPartnerApi(picker)) {
      pickerApi = /** @type {ReturnType<typeof initColorPicker>} */ (picker);
    } else {
      const host =
        picker instanceof HTMLElement
          ? picker
          : findNestedPartner(colorInputEl, ".color-picker");
      if (host instanceof HTMLElement) {
        pickerApi = initColorPicker(host, {
          defaultValue: currentValue ?? undefined,
          alpha: allowAlpha,
          onChange: ({ value, source }) => {
            if (source === "api") return;
            if (!value) return;
            applyFromPartner(value, "color-picker");
          },
        });
        hidePartnerTrigger(host);
        host.classList.add("color-input-partner");
      }
    }
  }

  if (openMode !== "none") {
    const openLabel =
      openMode === "set"
        ? "Open colour set"
        : openMode === "picker"
          ? "Open colour picker"
          : "Open colour set and picker";

    if (swatchOpens) {
      swatchEl.setAttribute("role", "button");
      swatchEl.setAttribute("aria-label", openLabel);
      swatchEl.tabIndex = 0;
      swatchEl.removeAttribute("aria-hidden");

      const onSwatchActivate = (event) => {
        if (isDisabled) return;
        event.preventDefault();
        event.stopPropagation();
        toggleTargets();
      };

      swatchEl.addEventListener("click", onSwatchActivate);
      swatchEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") onSwatchActivate(event);
      });
    }
  }

  textInput.addEventListener("focus", () => {
    isEditing = true;
    if (isDisabled || !inputOpens) return;
    // Defer so the focusing click is not treated as an outside click by the popup.
    window.setTimeout(() => {
      if (isDisabled || document.activeElement !== textInput) return;
      // Keep caret in the hex field — popup open must not steal focus.
      openTargets({ focus: false });
    }, 0);
  });

  textInput.addEventListener("input", () => {
    if (isDisabled) return;
    isEditing = true;
    const raw = String(textInput.value).trim();
    paintHexMirror(mirrorEl, textInput.value);

    if (!raw) {
      textInput.removeAttribute("aria-invalid");
      syncSwatch(swatchEl, null);
      syncPartnersFromInput(null);
      onInput?.({
        ...buildPayload("input"),
        value: null,
        display: "",
      });
      return;
    }

    if (!isPartialHexInput(raw, allowAlpha)) {
      textInput.setAttribute("aria-invalid", "true");
      syncSwatch(swatchEl, null);
      return;
    }

    textInput.removeAttribute("aria-invalid");
    const preview = parse(raw);
    syncSwatch(swatchEl, preview);
    if (preview) {
      // Live-update open picker / set; set clears swatch selection when hex is not in the palette.
      syncPartnersFromInput(preview);
    }
    onInput?.({
      ...buildPayload("input"),
      value: preview,
      display: raw,
    });
  });

  textInput.addEventListener("change", () => {
    commitTypedValue();
  });

  textInput.addEventListener("blur", () => {
    commitTypedValue();
  });

  textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTypedValue();
      textInput.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      isEditing = false;
      textInput.value = formatDisplayValue(currentValue);
      paintHexMirror(mirrorEl, textInput.value);
      textInput.removeAttribute("aria-invalid");
      syncSwatch(swatchEl, currentValue);
      textInput.blur();
    }
  });

  syncDom({ emit: Boolean(onChange) });

  return {
    getValue() {
      return currentValue;
    },
    setValue(nextValue, options) {
      return setValue(nextValue, options);
    },
    commitInput() {
      return commitTypedValue();
    },
    setDisabled(nextDisabled) {
      applyDisabled(Boolean(nextDisabled));
    },
    isDisabled() {
      return isDisabled;
    },
    allowsAlpha() {
      return allowAlpha;
    },
    getOpenOnClick() {
      return openMode;
    },
    getOpenTrigger() {
      return openMode === "none" ? null : triggerMode;
    },
    open() {
      openTargets();
    },
    close() {
      closeTargets();
    },
    getColorSet() {
      return colorSetApi;
    },
    getPicker() {
      return pickerApi;
    },
  };
}

/** Wire every `.color-input` block in `root`. */
export function initColorInputs(root = document) {
  const instances = [];
  root.querySelectorAll(".color-input").forEach((colorInputEl) => {
    const instance = initColorInput(colorInputEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
