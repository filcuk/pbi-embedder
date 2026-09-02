/**
 * Range slider with an editable value field.
 *
 * Markup:
 *   <div class="slider" data-slider-min="0" data-slider-max="100" data-slider-format="integer">
 *     <label class="field-label" for="my-slider-range">Volume</label>
 *     <div class="slider-row">
 *       <input type="range" id="my-slider-range" class="slider-range" />
 *       <div class="slider-input-wrap">
 *         <input type="text" class="input slider-input" inputmode="decimal" aria-label="Value" />
 *         <span class="slider-suffix hidden" aria-hidden="true">%</span>
 *       </div>
 *       <input type="hidden" class="slider-value" />
 *     </div>
 *   </div>
 *
 * data-slider-min / data-slider-max — numeric bounds
 * data-slider-step — increment (default: 1 for integer/percentage, 0.1 for decimal)
 * data-slider-default — initial value (falls back to range `value` or midpoint)
 * data-slider-format — "integer" (default), "decimal", or "percentage"
 * data-slider-disabled — disable slider and value field
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";

function parseConfigNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function decimalPlacesFromStep(step) {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function snapToStep(value, min, max, step) {
  if (!Number.isFinite(value)) return min;
  const steps = Math.round((value - min) / step);
  const snapped = min + steps * step;
  const precision = decimalPlacesFromStep(step);
  const rounded = Number(snapped.toFixed(precision));
  return Math.min(max, Math.max(min, rounded));
}

function parseInputText(text, format) {
  const trimmed = String(text).trim();
  if (!trimmed) return NaN;
  const normalized =
    format === "percentage" ? trimmed.replace(/%$/, "").trim() : trimmed;
  return Number(normalized);
}

function formatDisplayValue(value, { format, step }) {
  if (!Number.isFinite(value)) return "";
  if (format === "integer" || format === "percentage") {
    return String(Math.round(value));
  }
  const decimals = decimalPlacesFromStep(step);
  return value.toFixed(decimals);
}

function resolveFormat(sliderEl, formatOption) {
  const fromAttr = sliderEl?.dataset.sliderFormat;
  const format = formatOption ?? fromAttr ?? "integer";
  if (format === "decimal" || format === "percentage") return format;
  return "integer";
}

function defaultStepForFormat(format) {
  return format === "decimal" ? 0.1 : 1;
}

function resolveDisabled(sliderEl, disabledOption, rangeInput) {
  if (typeof disabledOption === "boolean") return disabledOption;
  if (parseBooleanAttr(sliderEl?.dataset.sliderDisabled)) return true;
  return rangeInput.disabled;
}

export function initSlider(
  sliderEl,
  { min, max, step, defaultValue, format, disabled, onChange, onInput } = {}
) {
  if (!sliderEl) return null;

  const rangeInput = sliderEl.querySelector(".slider-range");
  const valueInput = sliderEl.querySelector(".slider-input");
  const hiddenInput = sliderEl.querySelector(".slider-value");
  const suffixEl = sliderEl.querySelector(".slider-suffix");

  if (!rangeInput || !valueInput) return null;

  const resolvedFormat = resolveFormat(sliderEl, format);
  const minValue = parseConfigNumber(min ?? sliderEl.dataset.sliderMin, 0);
  const maxValue = parseConfigNumber(max ?? sliderEl.dataset.sliderMax, 100);
  const stepValue = parseConfigNumber(
    step ?? sliderEl.dataset.sliderStep,
    defaultStepForFormat(resolvedFormat)
  );

  const bounds =
    minValue <= maxValue
      ? { min: minValue, max: maxValue }
      : { min: maxValue, max: minValue };

  const config = {
    min: bounds.min,
    max: bounds.max,
    step: stepValue > 0 ? stepValue : defaultStepForFormat(resolvedFormat),
    format: resolvedFormat,
  };

  rangeInput.min = String(config.min);
  rangeInput.max = String(config.max);
  rangeInput.step = String(config.step);

  if (resolvedFormat === "percentage") {
    setHidden(suffixEl, false);
    sliderEl.classList.add("slider--percentage");
  } else {
    setHidden(suffixEl, true);
    sliderEl.classList.remove("slider--percentage");
  }

  const initialRaw =
    defaultValue ??
    sliderEl.dataset.sliderDefault ??
    rangeInput.value ??
    hiddenInput?.value;
  let parsedInitial = parseConfigNumber(initialRaw, NaN);
  if (!Number.isFinite(parsedInitial)) {
    parsedInitial = config.min + (config.max - config.min) / 2;
  }

  let currentValue = snapToStep(parsedInitial, config.min, config.max, config.step);
  let isEditing = false;
  let isDisabled = resolveDisabled(sliderEl, disabled, rangeInput);
  const controls = [rangeInput, valueInput];

  function applyDisabled(nextDisabled) {
    isDisabled = nextDisabled;
    sliderEl.classList.toggle("slider--disabled", nextDisabled);
    controls.forEach((control) => {
      control.disabled = nextDisabled;
    });
  }

  applyDisabled(isDisabled);

  function syncAria() {
    rangeInput.setAttribute("aria-valuemin", String(config.min));
    rangeInput.setAttribute("aria-valuemax", String(config.max));
    rangeInput.setAttribute("aria-valuenow", String(currentValue));
  }

  function syncProgress(value = currentValue) {
    const span = config.max - config.min;
    const pct = span <= 0 ? 100 : ((value - config.min) / span) * 100;
    const clamped = Math.min(100, Math.max(0, pct));
    rangeInput.style.setProperty("--slider-progress", `${clamped}%`);
  }

  function buildPayload(source) {
    return {
      sliderEl,
      value: currentValue,
      display: formatDisplayValue(currentValue, config),
      format: config.format,
      source,
    };
  }

  function syncDom({ emit = true, source = "init" } = {}) {
    rangeInput.value = String(currentValue);
    if (!isEditing) {
      valueInput.value = formatDisplayValue(currentValue, config);
    }
    if (hiddenInput) {
      hiddenInput.value = String(currentValue);
    }
    syncAria();
    syncProgress();

    if (emit) {
      onChange?.(buildPayload(source));
    }
  }

  function setValue(nextValue, { emit = true, source = "api" } = {}) {
    const parsed = typeof nextValue === "number" ? nextValue : Number(nextValue);
    currentValue = snapToStep(
      Number.isFinite(parsed) ? parsed : config.min,
      config.min,
      config.max,
      config.step
    );
    isEditing = false;
    syncDom({ emit, source });
  }

  function commitTypedValue({ emit = true } = {}) {
    const parsed = parseInputText(valueInput.value, config.format);
    if (!Number.isFinite(parsed)) {
      valueInput.value = formatDisplayValue(currentValue, config);
      valueInput.removeAttribute("aria-invalid");
      isEditing = false;
      return false;
    }

    const nextValue = snapToStep(parsed, config.min, config.max, config.step);
    currentValue = nextValue;
    isEditing = false;
    valueInput.removeAttribute("aria-invalid");
    syncDom({ emit, source: "input" });
    return true;
  }

  rangeInput.addEventListener("input", () => {
    const parsed = Number(rangeInput.value);
    if (!Number.isFinite(parsed)) return;
    currentValue = snapToStep(parsed, config.min, config.max, config.step);
    isEditing = false;
    valueInput.value = formatDisplayValue(currentValue, config);
    if (hiddenInput) hiddenInput.value = String(currentValue);
    syncAria();
    syncProgress();
    onInput?.(buildPayload("range"));
    onChange?.(buildPayload("range"));
  });

  valueInput.addEventListener("focus", () => {
    isEditing = true;
  });

  valueInput.addEventListener("input", () => {
    isEditing = true;
    const parsed = parseInputText(valueInput.value, config.format);
    if (!Number.isFinite(parsed)) {
      valueInput.setAttribute("aria-invalid", "true");
      return;
    }
    valueInput.removeAttribute("aria-invalid");
    const preview = snapToStep(parsed, config.min, config.max, config.step);
    rangeInput.value = String(preview);
    syncAria();
    syncProgress(preview);
    onInput?.({
      ...buildPayload("input"),
      value: preview,
      display: valueInput.value,
    });
  });

  valueInput.addEventListener("change", () => {
    commitTypedValue();
  });

  valueInput.addEventListener("blur", () => {
    commitTypedValue();
  });

  valueInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitTypedValue();
      valueInput.blur();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      isEditing = false;
      valueInput.value = formatDisplayValue(currentValue, config);
      valueInput.removeAttribute("aria-invalid");
      rangeInput.value = String(currentValue);
      syncAria();
      syncProgress();
      valueInput.blur();
    }
  });

  rangeInput.addEventListener("change", () => {
    const parsed = Number(rangeInput.value);
    if (!Number.isFinite(parsed)) return;
    const snapped = snapToStep(parsed, config.min, config.max, config.step);
    if (snapped !== currentValue) {
      currentValue = snapped;
      syncDom({ source: "range" });
    }
  });

  syncDom({ emit: Boolean(onChange) });

  return {
    getValue() {
      return currentValue;
    },
    setValue(nextValue, options = {}) {
      setValue(nextValue, options);
    },
    getConfig() {
      return { ...config };
    },
    commitInput() {
      commitTypedValue();
    },
    setDisabled(nextDisabled) {
      applyDisabled(Boolean(nextDisabled));
    },
    isDisabled() {
      return isDisabled;
    },
  };
}

/** Wire every `.slider` block in `root`. */
export function initSliders(root = document) {
  const instances = [];
  root.querySelectorAll(".slider").forEach((sliderEl) => {
    const instance = initSlider(sliderEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
