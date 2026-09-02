/**
 * Progress bar — visual fill for a value between min and max.
 *
 * Markup:
 *   <div class="progress-bar" data-progress-bar-value="65" data-progress-bar-max="100"
 *     data-progress-bar-label="percent">
 *     <label class="field-label" id="upload-label">Upload progress</label>
 *     <div class="progress-bar-row">
 *       <div class="progress-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
 *         aria-valuenow="65" aria-labelledby="upload-label">
 *         <span class="progress-bar-fill"></span>
 *       </div>
 *       <span class="progress-bar-label" aria-hidden="true">65%</span>
 *     </div>
 *     <input type="hidden" class="progress-bar-value" value="65" />
 *   </div>
 *
 * data-progress-bar-value — current value
 * data-progress-bar-min / data-progress-bar-max — bounds (default 0 and 100)
 * data-progress-bar-label — "percent" or "fraction" when `.progress-bar-label` is present; omit label element for bar only
 * data-progress-bar-indeterminate — animated indeterminate state (ignores value)
 * data-progress-bar-indeterminate-mode — "sweep" (default, left→right loop) or "bounce" (left→right→left)
 * data-progress-bar-error — stuck/failed state (keeps value; red fill; mutually exclusive with indeterminate)
 * data-progress-bar-disabled — muted, non-animated display (hidden input disabled for forms)
 * data-progress-bar-shine — soft highlight sweeping left→right across the filled segment
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";

function parseConfigNumber(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function computePercent(value, min, max) {
  if (max <= min) return 0;
  return ((value - min) / (max - min)) * 100;
}

function resolveIndeterminateMode(mode) {
  return mode === "bounce" ? "bounce" : "sweep";
}

function resolveLabelFormat(progressBarEl, labelFormatOption, labelEl) {
  if (!labelEl) return null;
  const fromAttr = progressBarEl?.dataset.progressBarLabel;
  const format = labelFormatOption ?? fromAttr ?? "percent";
  if (format === "fraction" || format === "percent") return format;
  return null;
}

function formatLabelText(value, min, max, format) {
  if (format === "fraction") {
    return `${Math.round(value)}/${Math.round(max)}`;
  }
  return `${Math.round(computePercent(value, min, max))}%`;
}

function formatValueText(value, min, max, format, { isIndeterminate, isError }) {
  if (isIndeterminate) return "In progress";
  const base =
    format === "fraction"
      ? `${Math.round(value)} of ${Math.round(max)}`
      : `${Math.round(computePercent(value, min, max))} percent`;
  return isError ? `Error, stuck at ${base}` : base;
}

export function initProgressBar(
  progressBarEl,
  {
    value,
    min,
    max,
    labelFormat,
    indeterminate,
    indeterminateMode,
    error,
    disabled,
    onChange,
  } = {}
) {
  if (!progressBarEl) return null;

  const trackEl = progressBarEl.querySelector(".progress-bar-track");
  const fillEl = progressBarEl.querySelector(".progress-bar-fill");
  const labelEl = progressBarEl.querySelector(".progress-bar-label");
  const hiddenInput = progressBarEl.querySelector(".progress-bar-value");

  if (!trackEl || !fillEl) return null;

  const minValue = parseConfigNumber(min ?? progressBarEl.dataset.progressBarMin, 0);
  const maxValue = parseConfigNumber(max ?? progressBarEl.dataset.progressBarMax, 100);
  const resolvedLabelFormat = resolveLabelFormat(progressBarEl, labelFormat, labelEl);

  let currentValue = clamp(
    parseConfigNumber(value ?? progressBarEl.dataset.progressBarValue, minValue),
    minValue,
    maxValue
  );
  let isIndeterminate =
    typeof indeterminate === "boolean"
      ? indeterminate
      : parseBooleanAttr(progressBarEl?.dataset.progressBarIndeterminate) ?? false;
  let currentIndeterminateMode = resolveIndeterminateMode(
    indeterminateMode ?? progressBarEl.dataset.progressBarIndeterminateMode
  );
  let isError =
    typeof error === "boolean"
      ? error
      : parseBooleanAttr(progressBarEl?.dataset.progressBarError) ?? false;
  let isDisabled =
    typeof disabled === "boolean"
      ? disabled
      : parseBooleanAttr(progressBarEl?.dataset.progressBarDisabled) ?? false;

  if (isError) isIndeterminate = false;
  else if (isIndeterminate) isError = false;

  function syncDom({ emit = true, source = "init" } = {}) {
    const percent = computePercent(currentValue, minValue, maxValue);

    progressBarEl.classList.toggle("progress-bar--indeterminate", isIndeterminate);
    progressBarEl.classList.toggle("progress-bar--bounce", currentIndeterminateMode === "bounce");
    progressBarEl.classList.toggle("progress-bar--error", isError);
    progressBarEl.classList.toggle("progress-bar--disabled", isDisabled);
    trackEl.setAttribute("aria-disabled", isDisabled ? "true" : "false");

    if (isIndeterminate) {
      trackEl.removeAttribute("aria-valuenow");
      trackEl.setAttribute("aria-valuetext", "In progress");
      fillEl.style.width = "";
    } else {
      trackEl.setAttribute("aria-valuemin", String(minValue));
      trackEl.setAttribute("aria-valuemax", String(maxValue));
      trackEl.setAttribute("aria-valuenow", String(currentValue));
      trackEl.setAttribute(
        "aria-valuetext",
        formatValueText(currentValue, minValue, maxValue, resolvedLabelFormat, {
          isIndeterminate: false,
          isError,
        })
      );
      fillEl.style.width = `${percent}%`;
    }

    if (labelEl) {
      if (resolvedLabelFormat && !isIndeterminate) {
        labelEl.textContent = formatLabelText(
          currentValue,
          minValue,
          maxValue,
          resolvedLabelFormat
        );
        setHidden(labelEl, false);
      } else if (isIndeterminate) {
        labelEl.textContent = "…";
        setHidden(labelEl, false);
      } else {
        labelEl.textContent = "";
        setHidden(labelEl, true);
      }
    }

    if (hiddenInput) {
      hiddenInput.value = isIndeterminate ? "" : String(currentValue);
      hiddenInput.disabled = isDisabled;
    }

    if (emit) {
      onChange?.({
        progressBarEl,
        value: currentValue,
        min: minValue,
        max: maxValue,
        percent,
        indeterminate: isIndeterminate,
        indeterminateMode: currentIndeterminateMode,
        error: isError,
        disabled: isDisabled,
        source,
      });
    }
  }

  function setValue(nextValue, { emit = true, source = "api" } = {}) {
    isIndeterminate = false;
    isError = false;
    currentValue = clamp(parseConfigNumber(nextValue, minValue), minValue, maxValue);
    syncDom({ emit, source });
  }

  function setIndeterminate(nextIndeterminate, { emit = true, source = "api", mode } = {}) {
    isIndeterminate = Boolean(nextIndeterminate);
    if (isIndeterminate) isError = false;
    if (mode !== undefined) currentIndeterminateMode = resolveIndeterminateMode(mode);
    syncDom({ emit, source });
  }

  function setIndeterminateMode(nextMode, { emit = true, source = "api" } = {}) {
    currentIndeterminateMode = resolveIndeterminateMode(nextMode);
    syncDom({ emit, source });
  }

  function setError(nextError, { emit = true, source = "api" } = {}) {
    isError = Boolean(nextError);
    if (isError) isIndeterminate = false;
    syncDom({ emit, source });
  }

  function setDisabled(nextDisabled, { emit = true, source = "api" } = {}) {
    isDisabled = Boolean(nextDisabled);
    syncDom({ emit, source });
  }

  syncDom({ emit: Boolean(onChange) });

  return {
    getValue() {
      return currentValue;
    },
    setValue(nextValue) {
      setValue(nextValue);
    },
    getMin() {
      return minValue;
    },
    getMax() {
      return maxValue;
    },
    getPercent() {
      return computePercent(currentValue, minValue, maxValue);
    },
    setIndeterminate(nextIndeterminate, options) {
      setIndeterminate(nextIndeterminate, { mode: options?.mode });
    },
    isIndeterminate() {
      return isIndeterminate;
    },
    setIndeterminateMode(nextMode) {
      setIndeterminateMode(nextMode);
    },
    getIndeterminateMode() {
      return currentIndeterminateMode;
    },
    setError(nextError) {
      setError(nextError);
    },
    isError() {
      return isError;
    },
    setDisabled(nextDisabled) {
      setDisabled(nextDisabled);
    },
    isDisabled() {
      return isDisabled;
    },
  };
}

/** Wire every `.progress-bar` block in `root`. */
export function initProgressBars(root = document) {
  const instances = [];
  root.querySelectorAll(".progress-bar").forEach((progressBarEl) => {
    const instance = initProgressBar(progressBarEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
