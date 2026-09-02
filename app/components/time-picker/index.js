/**
 * Time picker — editable field with an optional custom popup panel.
 *
 * The field keeps native `<input type="time">` habits via `field.js`: a click
 * selects the hour / minute / second block, Arrow Up / Down nudge it, and
 * Alt + Arrow Down opens the popup.
 *
 * The legacy native `<input type="time">` markup remains supported while
 * consumers migrate to `.time-picker-control` + `.time-picker-popup`.
 */

import { parseBooleanAttr, setHidden } from "../../utils/dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../../utils/document-listeners.js";
import {
  formatTimePickerParts,
  mountTimePickerPanel,
  normalizeTimePickerParts,
} from "./panel.js";
import { initTimeFieldSegments } from "./field.js";

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const DURATION_PATTERN = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/;

/**
 * @param {string} value
 * @returns {string | null} Normalized `HH:MM` or `HH:MM:SS`, or null when invalid.
 */
export function parseTimeValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const match = TIME_PATTERN.exec(text);
  if (!match) return null;
  const hours = String(Number(match[1])).padStart(2, "0");
  const minutes = match[2];
  const seconds = match[3];
  return seconds !== undefined && seconds !== null
    ? `${hours}:${minutes}:${seconds}`
    : `${hours}:${minutes}`;
}

/**
 * Lexicographic compare works for zero-padded `HH:MM` / `HH:MM:SS`.
 * @param {string} value
 * @param {string | null} min
 * @param {string | null} max
 */
export function isTimeWithinBounds(value, min, max) {
  if (!value) return true;
  if (min && value < min) return false;
  if (max && value > max) return false;
  return true;
}

function parseParts(value, { mode, maxHours, showSeconds }) {
  const text = String(value ?? "").trim();
  const match = (mode === "duration" ? DURATION_PATTERN : TIME_PATTERN).exec(text);
  if (!match) return null;
  return normalizeTimePickerParts(
    {
      hours: Number(match[1]),
      minutes: Number(match[2]),
      seconds: match[3] === undefined ? 0 : Number(match[3]),
    },
    { mode, maxHours, showSeconds }
  );
}

function resolveBoolean(element, option, datasetKey, fallback) {
  if (typeof option === "boolean") return option;
  return parseBooleanAttr(element?.dataset[datasetKey]) ?? fallback;
}

function resolveDisabled(pickerEl, disabledOption) {
  return resolveBoolean(
    pickerEl,
    disabledOption,
    "timePickerDisabled",
    false
  );
}

function initNativeTimePicker(
  pickerEl,
  input,
  valueInput,
  { defaultValue, min, max, step, disabled, onChange, onInput }
) {
  let isDisabled = resolveDisabled(pickerEl, disabled);
  const resolvedMin = parseTimeValue(min ?? pickerEl.dataset.timePickerMin);
  const resolvedMax = parseTimeValue(max ?? pickerEl.dataset.timePickerMax);
  const resolvedStep = step ?? pickerEl.dataset.timePickerStep;

  if (resolvedMin) input.min = resolvedMin;
  if (resolvedMax) input.max = resolvedMax;
  if (resolvedStep !== null && resolvedStep !== undefined && resolvedStep !== "") {
    input.step = String(resolvedStep);
  }

  function syncHidden() {
    if (valueInput) valueInput.value = input.value || "";
  }

  function syncValidity() {
    const valid = isTimeWithinBounds(input.value || "", resolvedMin, resolvedMax);
    if (valid) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
    return valid;
  }

  function buildDetail(source) {
    return {
      pickerEl,
      value: input.value || "",
      input: input.value || "",
      valid: isTimeWithinBounds(input.value || "", resolvedMin, resolvedMax),
      source,
    };
  }

  function setValue(next, { emitEvent = true, source = "api" } = {}) {
    input.value = parseTimeValue(next) ?? "";
    syncHidden();
    syncValidity();
    if (emitEvent) onChange?.(buildDetail(source));
  }

  function setDisabled(next) {
    isDisabled = Boolean(next);
    input.disabled = isDisabled;
    if (valueInput) valueInput.disabled = isDisabled;
    pickerEl.classList.toggle("time-picker--disabled", isDisabled);
  }

  const onInputEvent = () => {
    syncHidden();
    syncValidity();
    onInput?.(buildDetail("input"));
  };
  const onChangeEvent = () => {
    syncHidden();
    syncValidity();
    onChange?.(buildDetail("change"));
  };

  const initial =
    parseTimeValue(defaultValue) ??
    parseTimeValue(pickerEl.dataset.timePickerDefault) ??
    parseTimeValue(valueInput?.value) ??
    parseTimeValue(input.value);
  if (initial) input.value = initial;
  syncHidden();
  syncValidity();
  setDisabled(isDisabled);

  input.addEventListener("input", onInputEvent);
  input.addEventListener("change", onChangeEvent);

  return {
    open() {},
    close() {},
    getValue: () => input.value || "",
    setValue(value) {
      setValue(value);
    },
    setDisabled,
    destroy() {
      input.removeEventListener("input", onInputEvent);
      input.removeEventListener("change", onChangeEvent);
    },
  };
}

/**
 * @param {HTMLElement | null} pickerEl
 * @param {{
 *   defaultValue?: string,
 *   min?: string,
 *   max?: string,
 *   step?: number | string,
 *   disabled?: boolean,
 *   showSeconds?: boolean,
 *   showZero?: boolean,
 *   showNow?: boolean,
 *   mode?: "time" | "duration",
 *   maxHours?: number,
 *   onChange?: (detail: object) => void,
 *   onInput?: (detail: object) => void,
 * }} [options]
 */
export function initTimePicker(
  pickerEl,
  {
    defaultValue,
    min,
    max,
    step,
    disabled,
    showSeconds,
    showZero,
    showNow,
    mode,
    maxHours,
    onChange,
    onInput,
  } = {}
) {
  if (!(pickerEl instanceof HTMLElement)) return null;
  if (pickerEl.dataset.timePickerInit !== undefined) return null;

  const input =
    pickerEl.querySelector(".time-picker-input") ||
    pickerEl.querySelector("input.date-picker-time") ||
    pickerEl.querySelector('input[type="time"]');
  const valueInput = pickerEl.querySelector(".time-picker-value");
  if (!(input instanceof HTMLInputElement)) return null;

  const popup = pickerEl.querySelector(".time-picker-popup");
  const trigger = pickerEl.querySelector(".time-picker-trigger");
  const panelEl = popup?.querySelector(".time-picker-panel") || popup;

  pickerEl.dataset.timePickerInit = "";

  // Preserve the previous native field contract until markup is migrated.
  if (input.type === "time" && !popup) {
    const nativeApi = initNativeTimePicker(pickerEl, input, valueInput, {
      defaultValue,
      min,
      max,
      step,
      disabled,
      onChange,
      onInput,
    });
    return {
      ...nativeApi,
      destroy() {
        nativeApi.destroy();
        delete pickerEl.dataset.timePickerInit;
      },
    };
  }

  if (!(popup instanceof HTMLElement) || !(panelEl instanceof HTMLElement)) {
    delete pickerEl.dataset.timePickerInit;
    return null;
  }

  const resolvedMode =
    (mode ?? pickerEl.dataset.timePickerMode) === "duration"
      ? "duration"
      : "time";
  const resolvedMaxHours = (() => {
    const candidate = Number(maxHours ?? pickerEl.dataset.timePickerMaxHours);
    return Number.isFinite(candidate) && candidate >= 0
      ? Math.trunc(candidate)
      : 99;
  })();
  const initialText =
    defaultValue ??
    pickerEl.dataset.timePickerDefault ??
    valueInput?.value ??
    input.value ??
    "";
  const secondsFromValue = String(initialText).split(":").length === 3;
  const withSeconds = resolveBoolean(
    pickerEl,
    showSeconds,
    "timePickerSeconds",
    secondsFromValue
  );
  const includeZero = resolveBoolean(
    pickerEl,
    showZero,
    "timePickerZero",
    true
  );
  const includeNow = resolveBoolean(
    pickerEl,
    showNow,
    "timePickerNow",
    resolvedMode === "time"
  );
  const resolvedMin =
    resolvedMode === "time"
      ? parseTimeValue(min ?? pickerEl.dataset.timePickerMin)
      : null;
  const resolvedMax =
    resolvedMode === "time"
      ? parseTimeValue(max ?? pickerEl.dataset.timePickerMax)
      : null;
  let isDisabled = resolveDisabled(pickerEl, disabled);
  let isOpen = false;
  let currentParts =
    parseParts(initialText, {
      mode: resolvedMode,
      maxHours: resolvedMaxHours,
      showSeconds: withSeconds,
    }) ?? { hours: 0, minutes: 0, seconds: 0 };

  const popupId =
    popup.id || `time-picker-popup-${Math.random().toString(36).slice(2, 9)}`;
  if (!popup.id) popup.id = popupId;
  trigger?.setAttribute("aria-controls", popupId);

  function currentValue() {
    return formatTimePickerParts(currentParts, {
      mode: resolvedMode,
      showSeconds: withSeconds,
    });
  }

  function isValid(value = currentValue()) {
    return (
      resolvedMode === "duration" ||
      isTimeWithinBounds(value, resolvedMin, resolvedMax)
    );
  }

  function buildDetail(source) {
    return {
      pickerEl,
      value: currentValue(),
      input: currentValue(),
      parts: { ...currentParts },
      mode: resolvedMode,
      valid: isValid(),
      source,
    };
  }

  function syncHost() {
    const value = currentValue();
    input.value = value;
    if (valueInput) valueInput.value = value;
    if (isValid(value)) input.removeAttribute("aria-invalid");
    else input.setAttribute("aria-invalid", "true");
  }

  const panelApi = mountTimePickerPanel(panelEl, {
    parts: currentParts,
    mode: resolvedMode,
    maxHours: resolvedMaxHours,
    showSeconds: withSeconds,
    showZero: includeZero,
    showNow: includeNow,
    disabled: isDisabled,
    onInput(detail) {
      currentParts = { ...detail.parts };
      syncHost();
      onInput?.(buildDetail(detail.source));
    },
    onChange(detail) {
      currentParts = { ...detail.parts };
      syncHost();
      onChange?.(buildDetail(detail.source));
      // Quick actions pick a final value — dismiss like the date picker does.
      if (detail.source === "zero" || detail.source === "now") {
        closePopup();
        input.focus();
      }
    },
  });
  if (!panelApi) {
    delete pickerEl.dataset.timePickerInit;
    return null;
  }

  function openPopup({ focus = true } = {}) {
    if (isOpen || isDisabled) return;
    registerOpenPopup(closePopup);
    isOpen = true;
    panelApi.setParts(currentParts);
    setHidden(popup, false);
    trigger?.setAttribute("aria-expanded", "true");
    if (focus) panelApi.focus();
  }

  function closePopup() {
    unregisterOpenPopup(closePopup);
    if (!isOpen) return;
    isOpen = false;
    setHidden(popup, true);
    trigger?.setAttribute("aria-expanded", "false");
  }

  function setValue(next, { emitEvent = true, source = "api" } = {}) {
    const parsed = parseParts(next, {
      mode: resolvedMode,
      maxHours: resolvedMaxHours,
      showSeconds: withSeconds,
    });
    if (!parsed) return false;
    currentParts = parsed;
    panelApi.setParts(currentParts);
    syncHost();
    if (emitEvent) onChange?.(buildDetail(source));
    return true;
  }

  function commitInput({ emitEvent = true } = {}) {
    const raw = input.value.trim();
    if (!raw) {
      syncHost();
      return false;
    }
    const parsed = parseParts(raw, {
      mode: resolvedMode,
      maxHours: resolvedMaxHours,
      showSeconds: withSeconds,
    });
    if (!parsed) {
      input.setAttribute("aria-invalid", "true");
      return false;
    }
    currentParts = parsed;
    panelApi.setParts(currentParts);
    syncHost();
    if (emitEvent) onChange?.(buildDetail("change"));
    return true;
  }

  function setDisabled(next) {
    isDisabled = Boolean(next);
    input.disabled = isDisabled;
    if (trigger) trigger.disabled = isDisabled;
    if (valueInput) valueInput.disabled = isDisabled;
    panelApi.setDisabled(isDisabled);
    pickerEl.classList.toggle("time-picker--disabled", isDisabled);
    if (isDisabled) closePopup();
  }

  const onTriggerClick = (event) => {
    event.stopPropagation();
    if (isOpen) closePopup();
    else openPopup();
  };
  const onPopupClick = (event) => event.stopPropagation();
  const onInputFocus = () => input.removeAttribute("aria-invalid");
  const onInputChange = () => commitInput();
  const onInputKeydown = (event) => {
    // Arrow Up / Down nudge the selected block, so the popup opens on Alt+Down.
    if (event.altKey && event.key === "ArrowDown" && !isOpen) {
      event.preventDefault();
      openPopup();
    } else if (event.key === "Enter") {
      event.preventDefault();
      commitInput();
      closePopup();
    }
  };

  const segments = initTimeFieldSegments(input, {
    mode: resolvedMode,
    maxHours: resolvedMaxHours,
    showSeconds: withSeconds,
    getParts: () => currentParts,
    applyParts(parts, { source }) {
      currentParts = { ...parts };
      panelApi.setParts(currentParts);
      syncHost();
      onChange?.(buildDetail(source));
    },
    commit: () => commitInput({ emitEvent: false }),
    isDisabled: () => isDisabled,
  });

  trigger?.addEventListener("click", onTriggerClick);
  popup.addEventListener("click", onPopupClick);
  input.addEventListener("focus", onInputFocus);
  input.addEventListener("change", onInputChange);
  input.addEventListener("keydown", onInputKeydown);

  const removeClickOutside = onDocumentClickOutside((event) => {
    if (!pickerEl.contains(event.target)) {
      commitInput();
      closePopup();
    }
  });
  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    closePopup();
    trigger?.focus();
    return true;
  }, { priority: 50 });

  syncHost();
  setDisabled(isDisabled);
  setHidden(popup, true);
  trigger?.setAttribute("aria-expanded", "false");

  return {
    open: openPopup,
    close: closePopup,
    getValue: currentValue,
    getParts: () => ({ ...currentParts }),
    setValue,
    setDisabled,
    destroy() {
      removeClickOutside();
      removeEscape();
      trigger?.removeEventListener("click", onTriggerClick);
      popup.removeEventListener("click", onPopupClick);
      input.removeEventListener("focus", onInputFocus);
      input.removeEventListener("change", onInputChange);
      input.removeEventListener("keydown", onInputKeydown);
      segments?.destroy();
      panelApi.destroy();
      closePopup();
      delete pickerEl.dataset.timePickerInit;
    },
  };
}

/** Wire every `.time-picker` block in `root`. */
export function initTimePickers(root = document) {
  const instances = [];
  root.querySelectorAll(".time-picker").forEach((pickerEl) => {
    const instance = initTimePicker(pickerEl);
    if (instance) instances.push(instance);
  });
  return instances;
}

export {
  formatTimePickerParts,
  mountTimePickerPanel,
  normalizeTimePickerParts,
  wrapTimePickerSegment,
} from "./panel.js";
