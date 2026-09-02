/**
 * Colour picker panel — spectrum / channel UI that reacts to the active format.
 */

import {
  parseHexColor,
  isPartialHexInput,
  paintHexMirror,
  rgbToHex,
  hexToRgb,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  rgbToCmyk,
  cmykToRgb,
} from "../../utils/color.js";
import { setHidden } from "../../utils/dom.js";
import { initPopupMenu } from "../../utils/menu.js";
import { createIcon } from "../../utils/icons.js";
import { initSlider } from "../slider.js";

/** @typedef {"hex" | "rgb" | "hsl" | "hsv" | "cmyk"} ColorPickerFormat */
/** @typedef {{ r: number, g: number, b: number, a: number }} Rgba */

const FORMATS = /** @type {const} */ (["hex", "rgb", "hsl", "hsv", "cmyk"]);

/**
 * @param {string | null | undefined} raw
 * @returns {ColorPickerFormat}
 */
export function normalizeFormat(raw) {
  const value = String(raw ?? "hsv").toLowerCase();
  return FORMATS.includes(/** @type {ColorPickerFormat} */ (value))
    ? /** @type {ColorPickerFormat} */ (value)
    : "hsv";
}

/** Fallback when a default hex is missing or invalid. */
export const DEFAULT_PICKER_RGBA = /** @type {const} */ ({
  r: 9,
  g: 105,
  b: 218,
  a: 1,
});

/**
 * @param {string | null | undefined} hex
 * @param {{ alpha?: boolean }} [options]
 * @returns {Rgba | null}
 */
export function rgbaFromHex(hex, { alpha = false } = {}) {
  const parsed = parseHexColor(hex, { alpha: true });
  if (!parsed) return null;
  const rgb = hexToRgb(parsed);
  if (!rgb) return null;
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: alpha ? rgb.a : 1,
  };
}

/**
 * @param {string | null | undefined} hex
 * @param {{ alpha?: boolean }} [options]
 * @returns {Rgba}
 */
export function rgbaFromHexOrDefault(hex, { alpha = false } = {}) {
  return (
    rgbaFromHex(hex, { alpha }) ?? {
      ...DEFAULT_PICKER_RGBA,
      a: alpha ? DEFAULT_PICKER_RGBA.a : 1,
    }
  );
}

/**
 * @param {Rgba} rgba
 * @param {{ alpha?: boolean }} [options]
 */
export function hexFromRgba(rgba, { alpha = false } = {}) {
  return rgbToHex(rgba, { alpha });
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function round(n, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function normalizeRgba(next) {
  return {
    r: clamp(Math.round(next.r), 0, 255),
    g: clamp(Math.round(next.g), 0, 255),
    b: clamp(Math.round(next.b), 0, 255),
    a: clamp(next.a, 0, 1),
  };
}

/**
 * @param {HTMLElement} panelEl
 * @param {object} options
 * @param {Rgba} options.rgba
 * @param {ColorPickerFormat} options.format
 * @param {boolean} options.alpha
 * @param {(next: Rgba, meta: { source: string }) => void} options.onRgbaChange
 * @param {(format: ColorPickerFormat) => void} options.onFormatChange
 * @param {boolean} [options.showSetsToggle]
 * @param {() => void} [options.onSetsToggle]
 * @param {boolean} [options.setsOpen]
 */
export function mountColorPickerPanel(
  panelEl,
  {
    rgba: initialRgba,
    format: initialFormat,
    alpha,
    onRgbaChange,
    onFormatChange,
    showSetsToggle = false,
    onSetsToggle,
    setsOpen: initialSetsOpen = false,
  }
) {
  /** @type {Rgba} */
  let rgba = normalizeRgba(initialRgba);
  /** @type {{ h: number, s: number, v: number }} */
  let hsvState = rgbToHsv(rgba);
  /** @type {{ h: number, s: number, l: number }} */
  let hslState = rgbToHsl(rgba);
  /** @type {ColorPickerFormat} */
  let format = normalizeFormat(initialFormat);
  let setsOpen = Boolean(initialSetsOpen);
  /** @type {string} */
  let spectrumMode = "";
  /** @type {Map<string, NonNullable<ReturnType<typeof initSlider>>>} */
  const channelSliders = new Map();
  /** @type {NonNullable<ReturnType<typeof initSlider>> | null} */
  let alphaSlider = null;

  /**
   * Re-derive HSV/HSL from RGB while preserving hue/saturation when the
   * round-trip would collapse them (black / white / grey).
   * @param {Rgba} nextRgba
   */
  function syncPolarFromRgba(nextRgba) {
    const nextHsv = rgbToHsv(nextRgba);
    if (nextHsv.v <= 0) {
      nextHsv.h = hsvState.h;
      nextHsv.s = hsvState.s;
    } else if (nextHsv.s <= 0) {
      nextHsv.h = hsvState.h;
    }
    hsvState = nextHsv;

    const nextHsl = rgbToHsl(nextRgba);
    if (nextHsl.l <= 0 || nextHsl.l >= 100) {
      nextHsl.h = hslState.h;
      nextHsl.s = hslState.s;
    } else if (nextHsl.s <= 0) {
      nextHsl.h = hslState.h;
    }
    hslState = nextHsl;
  }

  panelEl.replaceChildren();
  panelEl.classList.add("color-picker-panel");

  const spectrum = document.createElement("div");
  spectrum.className = "color-picker-spectrum";

  const fields = document.createElement("div");
  fields.className = "color-picker-fields";

  const valueRow = document.createElement("div");
  valueRow.className = "color-picker-value-row";

  const preview = document.createElement("div");
  preview.className = "color-picker-preview";
  preview.setAttribute("aria-hidden", "true");

  const hexField = document.createElement("div");
  hexField.className = "color-picker-hex-field";

  const hexMirror = document.createElement("div");
  hexMirror.className = "color-picker-hex-mirror";
  hexMirror.setAttribute("aria-hidden", "true");

  const hexInput = document.createElement("input");
  hexInput.type = "text";
  hexInput.className = "input color-picker-hex";
  hexInput.spellcheck = false;
  hexInput.autocomplete = "off";
  hexInput.placeholder = alpha ? "#RRGGBBAA" : "#RRGGBB";
  hexInput.setAttribute("aria-label", "Hex");

  hexInput.addEventListener("input", () => {
    const raw = String(hexInput.value).trim();
    paintHexMirror(hexMirror, hexInput.value);
    if (!raw) {
      hexInput.removeAttribute("aria-invalid");
      return;
    }
    if (!isPartialHexInput(raw, alpha)) {
      hexInput.setAttribute("aria-invalid", "true");
      return;
    }
    hexInput.removeAttribute("aria-invalid");
    const parsed = parseHexColor(raw, { alpha });
    if (!parsed) return;
    const next = rgbaFromHex(parsed, { alpha });
    if (next) emit(next, "hex");
  });
  hexInput.addEventListener("change", () => {
    const parsed = parseHexColor(hexInput.value, { alpha });
    if (!parsed) {
      hexInput.value = hexFromRgba(rgba, { alpha });
      paintHexMirror(hexMirror, hexInput.value);
      hexInput.removeAttribute("aria-invalid");
      return;
    }
    const next = rgbaFromHex(parsed, { alpha });
    if (next) emit(next, "hex");
  });
  hexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      hexInput.blur();
    }
  });

  const formatSlot = document.createElement("div");
  formatSlot.className = "color-picker-format-slot dropdown";
  const formatMenuId = `color-picker-format-${Math.random().toString(36).slice(2, 9)}`;

  const formatTrigger = document.createElement("button");
  formatTrigger.type = "button";
  formatTrigger.className = "btn color-picker-format-trigger dropdown-trigger";
  formatTrigger.setAttribute("aria-label", "Colour format");
  formatTrigger.setAttribute("aria-haspopup", "menu");
  formatTrigger.setAttribute("aria-expanded", "false");
  formatTrigger.setAttribute("aria-controls", formatMenuId);

  const formatLabelEl = document.createElement("span");
  formatLabelEl.className = "color-picker-format-label";
  formatTrigger.append(
    formatLabelEl,
    createIcon("chevron-down", { className: "color-picker-format-chevron" })
  );

  const formatMenu = document.createElement("ul");
  formatMenu.id = formatMenuId;
  formatMenu.className = "dropdown-menu color-picker-format-menu hidden";
  formatMenu.setAttribute("role", "menu");
  setHidden(formatMenu, true);

  for (const id of FORMATS) {
    const li = document.createElement("li");
    li.setAttribute("role", "none");
    const item = document.createElement("button");
    item.type = "button";
    item.className = "dropdown-menu-item color-picker-format-item";
    item.setAttribute("role", "menuitem");
    item.dataset.value = id;
    const itemLabel = document.createElement("span");
    itemLabel.className = "dropdown-menu-item-label";
    itemLabel.textContent = id.toUpperCase();
    item.append(itemLabel);
    if (id === format) item.classList.add("is-selected");
    li.append(item);
    formatMenu.append(li);
  }

  formatSlot.append(formatTrigger, formatMenu);
  hexField.append(hexMirror, hexInput);

  const valueColor = document.createElement("div");
  valueColor.className = "color-picker-value-color";
  valueColor.append(preview, hexField);
  valueRow.append(valueColor, formatSlot);

  const footer = document.createElement("div");
  footer.className = "color-picker-footer";

  /** @type {HTMLButtonElement | null} */
  let setsBtn = null;
  if (showSetsToggle) {
    setsBtn = document.createElement("button");
    setsBtn.type = "button";
    setsBtn.className = "btn btn-icon btn-toggle color-picker-sets-toggle";
    setsBtn.setAttribute("aria-label", "Colour sets");
    setsBtn.setAttribute("aria-pressed", setsOpen ? "true" : "false");
    setsBtn.dataset.tooltip = "Colour sets";
    setsBtn.append(createIcon("palette", { className: "btn-icon-svg" }));
    setsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      onSetsToggle?.();
    });
    valueRow.append(setsBtn);
  }

  panelEl.append(spectrum, fields, valueRow, footer);

  const formatMenuApi = initPopupMenu({
    containerEl: formatSlot,
    menuEl: formatMenu,
    toggleEl: formatTrigger,
    itemSelector: ".dropdown-menu-item",
    fixed: true,
    fixedAlign: "end",
    // This menu belongs to the picker popup and must not close its parent.
    registerPopup: false,
    onSelect: ({ value }) => {
      onFormatChange(normalizeFormat(value));
    },
  });

  function emit(next, source) {
    const normalised = normalizeRgba(next);
    if (!alpha) normalised.a = 1;
    onRgbaChange(normalised, { source });
  }

  /**
   * @param {HTMLElement} planeEl
   * @param {(event: PointerEvent) => void} readPoint
   */
  function bindPlaneDrag(planeEl, readPoint) {
    planeEl.addEventListener("pointerdown", (event) => {
      if (!(event instanceof PointerEvent)) return;
      event.preventDefault();
      event.stopPropagation();
      planeEl.setPointerCapture(event.pointerId);
      readPoint(event);
      const onMove = (moveEvent) => {
        if (moveEvent instanceof PointerEvent) readPoint(moveEvent);
      };
      const onUp = (upEvent) => {
        if (upEvent instanceof PointerEvent) {
          try {
            planeEl.releasePointerCapture(upEvent.pointerId);
          } catch {
            /* already released */
          }
        }
        planeEl.removeEventListener("pointermove", onMove);
        planeEl.removeEventListener("pointerup", onUp);
        planeEl.removeEventListener("pointercancel", onUp);
      };
      planeEl.addEventListener("pointermove", onMove);
      planeEl.addEventListener("pointerup", onUp);
      planeEl.addEventListener("pointercancel", onUp);
    });
  }

  /**
   * @param {"hsl" | "hsv"} mode
   * @param {number} saturation 0–100
   * @param {number} vertical 0–100 (lightness for HSL, value for HSV)
   */
  function applyPlaneChannels(mode, saturation, vertical) {
    const s = clamp(saturation, 0, 100);
    const vOrL = clamp(vertical, 0, 100);
    if (mode === "hsl") {
      hslState = { h: hslState.h, s, l: vOrL };
      const next = hslToRgb(hslState);
      hsvState = rgbToHsv(next);
      if (hsvState.v <= 0) {
        hsvState.h = hslState.h;
        hsvState.s = hslState.s;
      } else if (hsvState.s <= 0) {
        hsvState.h = hslState.h;
      }
      emit({ ...next, a: rgba.a }, "plane");
      return;
    }
    hsvState = { h: hsvState.h, s, v: vOrL };
    const next = hsvToRgb(hsvState);
    hslState = rgbToHsl(next);
    if (hslState.l <= 0 || hslState.l >= 100) {
      hslState.h = hsvState.h;
      hslState.s = hsvState.s;
    } else if (hslState.s <= 0) {
      hslState.h = hsvState.h;
    }
    emit({ ...next, a: rgba.a }, "plane");
  }

  /**
   * @param {HTMLElement} planeEl
   * @param {"hsl" | "hsv"} mode
   */
  function syncPlaneAria(planeEl, mode) {
    const s = Math.round(mode === "hsl" ? hslState.s : hsvState.s);
    const vertical = Math.round(mode === "hsl" ? hslState.l : hsvState.v);
    const verticalLabel = mode === "hsl" ? "lightness" : "value";
    planeEl.setAttribute("aria-valuemin", "0");
    planeEl.setAttribute("aria-valuemax", "100");
    planeEl.setAttribute("aria-valuenow", String(s));
    planeEl.setAttribute(
      "aria-valuetext",
      `Saturation ${s}, ${verticalLabel} ${vertical}`
    );
  }

  /**
   * @param {HTMLElement} planeEl
   * @param {"hsl" | "hsv"} mode
   */
  function bindPlaneKeyboard(planeEl, mode) {
    planeEl.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 10 : 1;
      const s = mode === "hsl" ? hslState.s : hsvState.s;
      const vertical = mode === "hsl" ? hslState.l : hsvState.v;
      let nextS = s;
      let nextVertical = vertical;
      let handled = true;
      switch (event.key) {
        case "ArrowLeft":
          nextS = s - step;
          break;
        case "ArrowRight":
          nextS = s + step;
          break;
        case "ArrowUp":
          nextVertical = vertical + step;
          break;
        case "ArrowDown":
          nextVertical = vertical - step;
          break;
        case "Home":
          nextS = 0;
          break;
        case "End":
          nextS = 100;
          break;
        default:
          handled = false;
      }
      if (!handled) return;
      event.preventDefault();
      applyPlaneChannels(mode, nextS, nextVertical);
    });
  }

  function syncPreview() {
    preview.style.setProperty("--color-picker-preview", hexFromRgba(rgba, { alpha: true }));
  }

  function syncSetsToggle() {
    if (!setsBtn) return;
    setsBtn.setAttribute("aria-pressed", setsOpen ? "true" : "false");
    setsBtn.classList.toggle("is-active", setsOpen);
  }

  function syncFormatMenu() {
    formatLabelEl.textContent = format.toUpperCase();
    formatMenu.querySelectorAll(".dropdown-menu-item").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.value === format);
    });
  }

  function syncHexInput() {
    if (document.activeElement === hexInput) return;
    hexInput.value = hexFromRgba(rgba, { alpha });
    paintHexMirror(hexMirror, hexInput.value);
  }

  function renderPlaneAndHue(mode) {
    const needed = `plane:${mode}`;
    const hue = mode === "hsl" ? hslState.h : hsvState.h;
    const hueColor = rgbToHex(hsvToRgb({ h: hue, s: 100, v: 100 }));

    if (spectrumMode !== needed) {
      spectrumMode = needed;
      channelSliders.clear();
      spectrum.replaceChildren();

      const stack = document.createElement("div");
      stack.className = "color-picker-sv";

      const plane = document.createElement("div");
      plane.className = `color-picker-plane color-picker-plane--${mode}`;
      plane.setAttribute("role", "slider");
      plane.tabIndex = 0;
      plane.setAttribute(
        "aria-label",
        mode === "hsl" ? "Saturation and lightness" : "Saturation and value"
      );
      plane.setAttribute("aria-valuemin", "0");
      plane.setAttribute("aria-valuemax", "100");

      const thumb = document.createElement("span");
      thumb.className = "color-picker-thumb";
      thumb.setAttribute("aria-hidden", "true");
      plane.append(thumb);

      bindPlaneDrag(plane, (event) => {
        const rect = plane.getBoundingClientRect();
        const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);
        applyPlaneChannels(mode, x * 100, (1 - y) * 100);
      });
      bindPlaneKeyboard(plane, mode);

      const hueSlider = document.createElement("input");
      hueSlider.type = "range";
      hueSlider.className = "color-picker-hue";
      hueSlider.min = "0";
      hueSlider.max = "360";
      hueSlider.step = "1";
      hueSlider.setAttribute("aria-label", "Hue");
      hueSlider.addEventListener("input", () => {
        const h = Number(hueSlider.value);
        if (mode === "hsl") {
          hslState = { ...hslState, h };
          const next = hslToRgb(hslState);
          hsvState = { ...rgbToHsv(next), h };
          if (hsvState.v <= 0) hsvState.s = hslState.s;
          emit({ ...next, a: rgba.a }, "hue");
        } else {
          hsvState = { ...hsvState, h };
          const next = hsvToRgb(hsvState);
          hslState = { ...rgbToHsl(next), h };
          if (hslState.l <= 0 || hslState.l >= 100) hslState.s = hsvState.s;
          emit({ ...next, a: rgba.a }, "hue");
        }
      });

      stack.append(plane, hueSlider);
      spectrum.append(stack);
    }

    const plane = spectrum.querySelector(".color-picker-plane");
    const thumb = spectrum.querySelector(".color-picker-thumb");
    const hueSlider = spectrum.querySelector(".color-picker-hue");
    if (!(plane instanceof HTMLElement) || !(thumb instanceof HTMLElement)) return;

    plane.style.setProperty("--color-picker-hue", hueColor);
    thumb.style.setProperty("--color-picker-thumb", hexFromRgba(rgba, { alpha: false }));
    if (mode === "hsl") {
      thumb.style.left = `${hslState.s}%`;
      thumb.style.top = `${100 - hslState.l}%`;
    } else {
      thumb.style.left = `${hsvState.s}%`;
      thumb.style.top = `${100 - hsvState.v}%`;
    }
    syncPlaneAria(plane, mode);
    if (hueSlider instanceof HTMLInputElement && document.activeElement !== hueSlider) {
      hueSlider.value = String(Math.round(hue));
    }
  }

  /**
   * @param {string} modeId
   * @param {Array<{ id: string, label: string, min: number, max: number, step?: number, format?: "integer" | "decimal", read: () => number, write: (n: number) => void }>} channels
   */
  function renderChannelSliders(modeId, channels) {
    if (spectrumMode !== modeId) {
      spectrumMode = modeId;
      channelSliders.clear();
      spectrum.replaceChildren();
      const list = document.createElement("div");
      list.className = "color-picker-channels";

      for (const channel of channels) {
        const sliderId = `color-picker-${channel.id}-${Math.random().toString(36).slice(2, 8)}`;
        const sliderEl = document.createElement("div");
        sliderEl.className = "slider color-picker-channel-slider";
        sliderEl.dataset.channelId = channel.id;
        sliderEl.dataset.sliderMin = String(channel.min);
        sliderEl.dataset.sliderMax = String(channel.max);
        sliderEl.dataset.sliderStep = String(channel.step ?? 1);
        sliderEl.dataset.sliderFormat = channel.format ?? "integer";
        sliderEl.dataset.sliderDefault = String(channel.read());

        const label = document.createElement("label");
        label.className = "field-label";
        label.htmlFor = `${sliderId}-range`;
        label.textContent = channel.label;

        const row = document.createElement("div");
        row.className = "slider-row";

        const range = document.createElement("input");
        range.type = "range";
        range.id = `${sliderId}-range`;
        range.className = "slider-range";

        const wrap = document.createElement("div");
        wrap.className = "slider-input-wrap";
        const valueInput = document.createElement("input");
        valueInput.type = "text";
        valueInput.className = "input slider-input";
        valueInput.inputMode = channel.format === "decimal" ? "decimal" : "numeric";
        valueInput.setAttribute("aria-label", `${channel.label} value`);
        const suffix = document.createElement("span");
        suffix.className = "slider-suffix hidden";
        suffix.setAttribute("aria-hidden", "true");
        wrap.append(valueInput, suffix);

        row.append(range, wrap);
        sliderEl.append(label, row);
        list.append(sliderEl);

        const api = initSlider(sliderEl, {
          min: channel.min,
          max: channel.max,
          step: channel.step ?? 1,
          format: channel.format ?? "integer",
          defaultValue: channel.read(),
          onChange: ({ value, source }) => {
            if (source === "api") return;
            channel.write(value);
          },
          onInput: ({ value, source }) => {
            if (source === "api") return;
            channel.write(value);
          },
        });
        if (api) channelSliders.set(channel.id, api);
      }

      spectrum.append(list);
    }

    for (const channel of channels) {
      const api = channelSliders.get(channel.id);
      api?.setValue(channel.read(), { emit: false });
    }
  }

  function renderFields() {
    fields.replaceChildren();
    alphaSlider = null;

    if (format === "hsl") {
      appendNumberFields([
        {
          label: "H",
          value: round(hslState.h),
          min: 0,
          max: 360,
          onCommit: (h) => {
            hslState = { ...hslState, h };
            emit({ ...hslToRgb(hslState), a: rgba.a }, "hsl");
          },
        },
        {
          label: "S",
          value: round(hslState.s),
          min: 0,
          max: 100,
          onCommit: (s) => {
            hslState = { ...hslState, s };
            emit({ ...hslToRgb(hslState), a: rgba.a }, "hsl");
          },
        },
        {
          label: "L",
          value: round(hslState.l),
          min: 0,
          max: 100,
          onCommit: (l) => {
            hslState = { ...hslState, l };
            emit({ ...hslToRgb(hslState), a: rgba.a }, "hsl");
          },
        },
      ]);
    } else if (format === "hsv") {
      appendNumberFields([
        {
          label: "H",
          value: round(hsvState.h),
          min: 0,
          max: 360,
          onCommit: (h) => {
            hsvState = { ...hsvState, h };
            emit({ ...hsvToRgb(hsvState), a: rgba.a }, "hsv");
          },
        },
        {
          label: "S",
          value: round(hsvState.s),
          min: 0,
          max: 100,
          onCommit: (s) => {
            hsvState = { ...hsvState, s };
            emit({ ...hsvToRgb(hsvState), a: rgba.a }, "hsv");
          },
        },
        {
          label: "V",
          value: round(hsvState.v),
          min: 0,
          max: 100,
          onCommit: (v) => {
            hsvState = { ...hsvState, v };
            emit({ ...hsvToRgb(hsvState), a: rgba.a }, "hsv");
          },
        },
      ]);
    }

    if (alpha) {
      const sliderId = `color-picker-alpha-${Math.random().toString(36).slice(2, 8)}`;
      const sliderEl = document.createElement("div");
      sliderEl.className = "slider color-picker-channel-slider color-picker-alpha";
      sliderEl.dataset.sliderMin = "0";
      sliderEl.dataset.sliderMax = "1";
      sliderEl.dataset.sliderStep = "0.01";
      sliderEl.dataset.sliderFormat = "decimal";
      sliderEl.dataset.sliderDefault = String(round(rgba.a, 2));

      const label = document.createElement("label");
      label.className = "field-label";
      label.htmlFor = `${sliderId}-range`;
      label.textContent = "A";

      const row = document.createElement("div");
      row.className = "slider-row";

      const range = document.createElement("input");
      range.type = "range";
      range.id = `${sliderId}-range`;
      range.className = "slider-range";

      const wrap = document.createElement("div");
      wrap.className = "slider-input-wrap";
      const valueInput = document.createElement("input");
      valueInput.type = "text";
      valueInput.className = "input slider-input";
      valueInput.inputMode = "decimal";
      valueInput.setAttribute("aria-label", "Alpha value");
      const suffix = document.createElement("span");
      suffix.className = "slider-suffix hidden";
      suffix.setAttribute("aria-hidden", "true");
      wrap.append(valueInput, suffix);

      row.append(range, wrap);
      sliderEl.append(label, row);
      fields.append(sliderEl);

      alphaSlider = initSlider(sliderEl, {
        min: 0,
        max: 1,
        step: 0.01,
        format: "decimal",
        defaultValue: rgba.a,
        onChange: ({ value, source }) => {
          if (source === "api") return;
          emit({ ...rgba, a: value }, "alpha");
        },
        onInput: ({ value, source }) => {
          if (source === "api") return;
          emit({ ...rgba, a: value }, "alpha");
        },
      });
    }
  }

  function syncAlphaSlider() {
    if (!alpha || !alphaSlider) return;
    alphaSlider.setValue(rgba.a, { emit: false });
  }

  /**
   * @param {Array<{ label: string, value: number, min: number, max: number, onCommit: (n: number) => void }>} items
   */
  function appendNumberFields(items) {
    const row = document.createElement("div");
    row.className = "color-picker-number-row";
    for (const item of items) {
      const label = document.createElement("label");
      label.className = "color-picker-number";
      const caption = document.createElement("span");
      caption.className = "color-picker-channel-label";
      caption.textContent = item.label;
      const input = document.createElement("input");
      input.type = "text";
      input.className = "input color-picker-number-input";
      input.dataset.colorPickerField = item.label;
      input.inputMode = "numeric";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.value = String(item.value);
      input.setAttribute("aria-label", item.label);
      input.setAttribute("aria-valuemin", String(item.min));
      input.setAttribute("aria-valuemax", String(item.max));
      const commit = () => {
        const n = clamp(Number(input.value), item.min, item.max);
        if (Number.isNaN(n)) {
          input.value = String(item.value);
          return;
        }
        input.value = String(n);
        item.onCommit(n);
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      });
      label.append(caption, input);
      row.append(label);
    }
    fields.append(row);
  }

  function syncNumberFields() {
    /** @param {string} key @param {number} value */
    const setField = (key, value) => {
      const input = fields.querySelector(`[data-color-picker-field="${key}"]`);
      if (!(input instanceof HTMLInputElement)) return;
      if (document.activeElement === input) return;
      input.value = String(value);
    };

    if (format === "hsl") {
      setField("H", round(hslState.h));
      setField("S", round(hslState.s));
      setField("L", round(hslState.l));
    } else if (format === "hsv") {
      setField("H", round(hsvState.h));
      setField("S", round(hsvState.s));
      setField("V", round(hsvState.v));
    }
  }

  function renderSpectrum() {
    if (format === "rgb") {
      renderChannelSliders("channels:rgb", [
        {
          id: "r",
          label: "R",
          min: 0,
          max: 255,
          read: () => rgba.r,
          write: (r) => emit({ ...rgba, r }, "rgb"),
        },
        {
          id: "g",
          label: "G",
          min: 0,
          max: 255,
          read: () => rgba.g,
          write: (g) => emit({ ...rgba, g }, "rgb"),
        },
        {
          id: "b",
          label: "B",
          min: 0,
          max: 255,
          read: () => rgba.b,
          write: (b) => emit({ ...rgba, b }, "rgb"),
        },
      ]);
    } else if (format === "cmyk") {
      renderChannelSliders("channels:cmyk", [
        {
          id: "c",
          label: "C",
          min: 0,
          max: 100,
          read: () => round(rgbToCmyk(rgba).c),
          write: (c) => {
            const current = rgbToCmyk(rgba);
            emit(
              { ...cmykToRgb({ c, m: current.m, y: current.y, k: current.k }), a: rgba.a },
              "cmyk"
            );
          },
        },
        {
          id: "m",
          label: "M",
          min: 0,
          max: 100,
          read: () => round(rgbToCmyk(rgba).m),
          write: (m) => {
            const current = rgbToCmyk(rgba);
            emit(
              { ...cmykToRgb({ c: current.c, m, y: current.y, k: current.k }), a: rgba.a },
              "cmyk"
            );
          },
        },
        {
          id: "y",
          label: "Y",
          min: 0,
          max: 100,
          read: () => round(rgbToCmyk(rgba).y),
          write: (y) => {
            const current = rgbToCmyk(rgba);
            emit(
              { ...cmykToRgb({ c: current.c, m: current.m, y, k: current.k }), a: rgba.a },
              "cmyk"
            );
          },
        },
        {
          id: "k",
          label: "K",
          min: 0,
          max: 100,
          read: () => round(rgbToCmyk(rgba).k),
          write: (k) => {
            const current = rgbToCmyk(rgba);
            emit(
              { ...cmykToRgb({ c: current.c, m: current.m, y: current.y, k }), a: rgba.a },
              "cmyk"
            );
          },
        },
      ]);
    } else if (format === "hsl") {
      renderPlaneAndHue("hsl");
    } else {
      renderPlaneAndHue("hsv");
    }
  }

  function paint({ rebuildFields = false } = {}) {
    syncPreview();
    syncHexInput();
    syncFormatMenu();
    syncSetsToggle();
    renderSpectrum();
    if (rebuildFields) {
      renderFields();
    } else {
      syncNumberFields();
      syncAlphaSlider();
    }
  }

  paint({ rebuildFields: true });

  return {
    /**
     * @param {object} next
     * @param {Rgba} [next.rgba]
     * @param {ColorPickerFormat} [next.format]
     * @param {boolean} [next.setsOpen]
     * @param {boolean} [next.syncPolar] Re-derive HSV/HSL from RGB (default true).
     *   Pass false when RGB already came from plane / hue / polar fields.
     */
    update(next = {}) {
      const formatChanged = next.format !== undefined && next.format !== format;
      if (next.rgba) {
        rgba = normalizeRgba(next.rgba);
        if (next.syncPolar !== false) syncPolarFromRgba(rgba);
      }
      if (next.format !== undefined) format = normalizeFormat(next.format);
      if (next.setsOpen !== undefined) setsOpen = Boolean(next.setsOpen);
      if (formatChanged) spectrumMode = "";
      paint({ rebuildFields: formatChanged });
    },
    closeMenu(options) {
      formatMenuApi?.closeMenu(options);
    },
    destroy() {
      formatMenuApi?.destroy();
      channelSliders.clear();
      alphaSlider = null;
      panelEl.replaceChildren();
    },
  };
}

export { FORMATS };
