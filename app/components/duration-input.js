/**
 * Duration input — hours / minutes (optional seconds) as a segmented control
 * with a shared time-picker popup in duration mode.
 * Focus/click selects the whole segment (parity with native `type="time"`).
 * Clicking the control background (padding / separators) focuses hours.
 *
 * Markup:
 *   <div class="duration-input" id="my-duration" data-duration-default="1:30">
 *     <span class="field-label" id="my-duration-label">Duration</span>
 *     <div class="duration-input-control" role="group" aria-labelledby="my-duration-label">
 *       <input type="text" class="input duration-input-hours" inputmode="numeric"
 *         aria-label="Hours" />
 *       <span class="duration-input-sep" aria-hidden="true">:</span>
 *       <input type="text" class="input duration-input-minutes" inputmode="numeric"
 *         aria-label="Minutes" maxlength="2" />
 *     </div>
 *     <input type="hidden" class="duration-input-value" name="duration" />
 *     <!-- Trigger and popup are created automatically when omitted. -->
 *   </div>
 *
 * Optional seconds field: `.duration-input-seconds` or `data-duration-seconds`.
 *
 * data-duration-default — `H:MM`, `HH:MM`, or `HH:MM:SS` (or total seconds as a number string)
 * data-duration-max-hours — cap for hours (default 99)
 * data-duration-seconds — include a seconds segment
 * data-duration-disabled — disable the control
 *
 * Popup quick actions: always **00:00** reset (duration mode — no **Now**). Not exposed as
 * showZero / showNow options (unlike standalone initTimePicker).
 */

import { parseBooleanAttr, setHidden } from "../utils/dom.js";
import {
  onDocumentClickOutside,
  onDocumentEscape,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../utils/document-listeners.js";
import { createIcon } from "../utils/icons.js";
import { mountTimePickerPanel } from "./time-picker/panel.js";

/**
 * @typedef {{ hours: number, minutes: number, seconds: number }} DurationParts
 */

/**
 * @param {string | number | null | undefined} value
 * @param {{ showSeconds?: boolean }} [options]
 * @returns {DurationParts | null}
 */
export function parseDurationValue(value, { showSeconds = false } = {}) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    const total = Math.max(0, Math.trunc(value));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return { hours, minutes, seconds: showSeconds ? seconds : 0 };
  }

  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    return parseDurationValue(Number(text), { showSeconds });
  }

  const match = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(text);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] !== undefined ? Number(match[3]) : 0;
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;

  return {
    hours,
    minutes,
    seconds: showSeconds ? seconds : 0,
  };
}

/**
 * @param {DurationParts} parts
 * @param {{ showSeconds?: boolean }} [options]
 */
export function formatDurationValue(parts, { showSeconds = false } = {}) {
  const hours = Math.max(0, Math.trunc(parts.hours || 0));
  const minutes = Math.min(59, Math.max(0, Math.trunc(parts.minutes || 0)));
  const seconds = Math.min(59, Math.max(0, Math.trunc(parts.seconds || 0)));
  const hh = String(hours);
  const mm = String(minutes).padStart(2, "0");
  if (showSeconds) {
    return `${hh}:${mm}:${String(seconds).padStart(2, "0")}`;
  }
  return `${hh}:${mm}`;
}

function partsToSeconds(parts, showSeconds) {
  return (
    Math.max(0, Math.trunc(parts.hours || 0)) * 3600 +
    Math.min(59, Math.max(0, Math.trunc(parts.minutes || 0))) * 60 +
    (showSeconds ? Math.min(59, Math.max(0, Math.trunc(parts.seconds || 0))) : 0)
  );
}

function secondsToParts(totalSeconds, showSeconds) {
  const total = Math.max(0, Math.trunc(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = showSeconds ? total % 60 : 0;
  return { hours, minutes, seconds };
}

function maxDurationSeconds(maxHours, showSeconds) {
  return Math.max(0, Math.trunc(maxHours)) * 3600 + 59 * 60 + (showSeconds ? 59 : 0);
}

/**
 * Nudge one duration segment by `delta`, carrying across minutes/seconds and
 * saturating at 0 and max (no wrap past the bounds).
 *
 * @param {DurationParts} parts
 * @param {"hours" | "minutes" | "seconds"} segment
 * @param {number} delta
 * @param {{ maxHours?: number, showSeconds?: boolean }} [options]
 * @returns {DurationParts}
 */
export function nudgeDuration(
  parts,
  segment,
  delta,
  { maxHours = 99, showSeconds = false } = {}
) {
  const step =
    segment === "hours" ? 3600 : segment === "minutes" ? 60 : 1;
  if (segment === "seconds" && !showSeconds) {
    return secondsToParts(partsToSeconds(parts, false), false);
  }

  const maxTotal = maxDurationSeconds(maxHours, showSeconds);
  const next = partsToSeconds(parts, showSeconds) + Math.trunc(delta || 0) * step;
  return secondsToParts(Math.min(maxTotal, Math.max(0, next)), showSeconds);
}

function clampHours(hours, maxHours) {
  return Math.min(maxHours, Math.max(0, Math.trunc(hours || 0)));
}

function resolveDisabled(durationEl, disabledOption) {
  if (typeof disabledOption === "boolean") return disabledOption;
  return parseBooleanAttr(durationEl?.dataset.durationDisabled) ?? false;
}

function resolveShowSeconds(durationEl, showSecondsOption) {
  if (typeof showSecondsOption === "boolean") return showSecondsOption;
  if (durationEl?.querySelector(".duration-input-seconds")) return true;
  return parseBooleanAttr(durationEl?.dataset.durationSeconds) ?? false;
}

/**
 * @param {HTMLElement | null} durationEl
 * @param {{
 *   defaultValue?: string | number,
 *   maxHours?: number,
 *   showSeconds?: boolean,
 *   disabled?: boolean,
 *   onChange?: (detail: object) => void,
 *   onInput?: (detail: object) => void,
 * }} [options]
 */
export function initDurationInput(
  durationEl,
  { defaultValue, maxHours, showSeconds, disabled, onChange, onInput } = {}
) {
  if (!durationEl) return null;

  const control = durationEl.querySelector(".duration-input-control");
  const hoursInput = durationEl.querySelector(".duration-input-hours");
  const minutesInput = durationEl.querySelector(".duration-input-minutes");
  let secondsInput = durationEl.querySelector(".duration-input-seconds");
  const valueInput = durationEl.querySelector(".duration-input-value");
  let trigger = durationEl.querySelector(".duration-input-trigger");
  let popup = durationEl.querySelector(".duration-input-popup");
  let panelEl = popup?.querySelector(".time-picker-panel");

  if (!control || !hoursInput || !minutesInput) return null;

  const withSeconds = resolveShowSeconds(durationEl, showSeconds);
  let isDisabled = resolveDisabled(durationEl, disabled);

  const resolvedMaxHours = (() => {
    const fromOption = Number(maxHours);
    if (Number.isFinite(fromOption) && fromOption >= 0) return Math.trunc(fromOption);
    const fromAttr = Number(durationEl.dataset.durationMaxHours);
    return Number.isFinite(fromAttr) && fromAttr >= 0 ? Math.trunc(fromAttr) : 99;
  })();

  const createdTrigger = !trigger;
  if (!trigger) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "duration-input-trigger";
    trigger.setAttribute("aria-label", "Open duration picker");
    trigger.setAttribute("aria-expanded", "false");
    trigger.append(createIcon("clock", { className: "duration-input-icon" }));
    control.append(trigger);
  }

  const createdPopup = !popup;
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "time-picker-popup duration-input-popup hidden";
    popup.setAttribute("role", "dialog");
    popup.setAttribute("aria-label", "Choose duration");
    popup.hidden = true;
    panelEl = document.createElement("div");
    panelEl.className = "time-picker-panel";
    popup.append(panelEl);
    durationEl.append(popup);
  } else if (!panelEl) {
    panelEl = document.createElement("div");
    panelEl.className = "time-picker-panel";
    popup.append(panelEl);
  }

  const popupId =
    popup.id || `duration-input-popup-${Math.random().toString(36).slice(2, 9)}`;
  if (!popup.id) popup.id = popupId;
  trigger.setAttribute("aria-controls", popupId);

  if (withSeconds && !secondsInput) {
    const sep = document.createElement("span");
    sep.className = "duration-input-sep";
    sep.setAttribute("aria-hidden", "true");
    sep.textContent = ":";

    secondsInput = document.createElement("input");
    secondsInput.type = "text";
    secondsInput.className = "input duration-input-seconds";
    secondsInput.inputMode = "numeric";
    secondsInput.maxLength = 2;
    secondsInput.setAttribute("aria-label", "Seconds");

    control.append(sep, secondsInput);
  }

  /** @type {DurationParts} */
  let parts = { hours: 0, minutes: 0, seconds: 0 };
  let isOpen = false;
  /** @type {ReturnType<typeof mountTimePickerPanel> | null} */
  let panelApi = null;

  function syncFields({ padMinutes = false } = {}) {
    hoursInput.value = String(parts.hours);
    minutesInput.value = padMinutes
      ? String(parts.minutes).padStart(2, "0")
      : String(parts.minutes);
    if (secondsInput) {
      secondsInput.value = padMinutes
        ? String(parts.seconds).padStart(2, "0")
        : String(parts.seconds);
    }
  }

  function syncHidden() {
    if (valueInput) {
      valueInput.value = formatDurationValue(parts, { showSeconds: withSeconds });
    }
  }

  function emit(handler, source) {
    handler?.({
      durationEl,
      value: formatDurationValue(parts, { showSeconds: withSeconds }),
      hours: parts.hours,
      minutes: parts.minutes,
      seconds: withSeconds ? parts.seconds : 0,
      totalSeconds: partsToSeconds(parts, withSeconds),
      source,
    });
  }

  function applyParts(next, { emitEvent = true, source = "api", padMinutes = true } = {}) {
    parts = {
      hours: clampHours(next.hours, resolvedMaxHours),
      minutes: Math.min(59, Math.max(0, Math.trunc(next.minutes || 0))),
      seconds: withSeconds
        ? Math.min(59, Math.max(0, Math.trunc(next.seconds || 0)))
        : 0,
    };
    syncFields({ padMinutes });
    syncHidden();
    hoursInput.removeAttribute("aria-invalid");
    minutesInput.removeAttribute("aria-invalid");
    secondsInput?.removeAttribute("aria-invalid");
    panelApi?.setParts(parts);
    if (emitEvent) emit(onChange, source);
  }

  function readField(inputEl, { max, allowEmpty = true } = {}) {
    const raw = inputEl.value.trim();
    if (raw === "") return allowEmpty ? 0 : null;
    if (!/^\d+$/.test(raw)) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    return Math.min(max, Math.max(0, Math.trunc(num)));
  }

  function commitFields({ emitEvent = true, source = "commit" } = {}) {
    const hours = readField(hoursInput, { max: resolvedMaxHours });
    const minutes = readField(minutesInput, { max: 59 });
    const seconds = withSeconds ? readField(secondsInput, { max: 59 }) : 0;

    if (hours === null || minutes === null || seconds === null) {
      if (hours === null) hoursInput.setAttribute("aria-invalid", "true");
      else hoursInput.removeAttribute("aria-invalid");
      if (minutes === null) minutesInput.setAttribute("aria-invalid", "true");
      else minutesInput.removeAttribute("aria-invalid");
      if (secondsInput) {
        if (seconds === null) secondsInput.setAttribute("aria-invalid", "true");
        else secondsInput.removeAttribute("aria-invalid");
      }
      syncFields({ padMinutes: true });
      return false;
    }

    applyParts({ hours, minutes, seconds }, { emitEvent, source, padMinutes: true });
    return true;
  }

  function readDraftParts() {
    return {
      hours: readField(hoursInput, { max: resolvedMaxHours }) ?? 0,
      minutes: readField(minutesInput, { max: 59 }) ?? 0,
      seconds: withSeconds ? (readField(secondsInput, { max: 59 }) ?? 0) : 0,
    };
  }

  function emitInput(source = "input") {
    const draft = readDraftParts();
    if (valueInput) {
      valueInput.value = formatDurationValue(draft, { showSeconds: withSeconds });
    }
    onInput?.({
      durationEl,
      value: formatDurationValue(draft, { showSeconds: withSeconds }),
      hours: draft.hours,
      minutes: draft.minutes,
      seconds: withSeconds ? draft.seconds : 0,
      totalSeconds: partsToSeconds(draft, withSeconds),
      source,
      draft: true,
    });
  }

  function selectSegment(inputEl) {
    if (!(inputEl instanceof HTMLInputElement) || isDisabled) return;
    inputEl.select();
  }

  function onFieldFocus(event) {
    selectSegment(event.target);
  }

  // Click re-selects after mouseup would otherwise collapse the focus selection
  // (matches native `type="time"` segment highlight).
  function onFieldClick(event) {
    selectSegment(event.target);
  }

  // Native `type="time"` selects hours when the field background is clicked.
  function onControlClick(event) {
    if (isDisabled) return;
    if (event.target.closest?.(".duration-input-trigger")) return;
    if (event.target instanceof HTMLInputElement && fields.includes(event.target)) {
      return;
    }
    hoursInput.focus();
    selectSegment(hoursInput);
  }

  function onFieldInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    target.value = target.value.replace(/\D+/g, "");
    emitInput("input");
  }

  function onFieldBlur() {
    commitFields({ source: "blur" });
  }

  function onFieldKeydown(event) {
    if (isDisabled) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (event.key === "Enter") {
      event.preventDefault();
      commitFields({ source: "enter" });
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      commitFields({ emitEvent: false, source: "nudge" });
      const delta = event.key === "ArrowUp" ? 1 : -1;
      const segment =
        target === hoursInput
          ? "hours"
          : target === minutesInput
            ? "minutes"
            : target === secondsInput
              ? "seconds"
              : null;
      if (segment) {
        applyParts(
          nudgeDuration(parts, segment, delta, {
            maxHours: resolvedMaxHours,
            showSeconds: withSeconds,
          }),
          { source: "nudge" }
        );
      }
      target.select();
      return;
    }

    if (event.key === ":" || event.key === "ArrowRight") {
      const atEnd =
        target.selectionStart === target.selectionEnd &&
        target.selectionEnd === target.value.length;
      if (event.key === ":" || (event.key === "ArrowRight" && atEnd)) {
        const order = [hoursInput, minutesInput, secondsInput].filter(Boolean);
        const index = order.indexOf(target);
        if (index >= 0 && index < order.length - 1) {
          event.preventDefault();
          order[index + 1].focus();
          order[index + 1].select();
        }
      }
    }

    if (event.key === "ArrowLeft" || event.key === "Backspace") {
      const atStart =
        target.selectionStart === 0 && target.selectionEnd === 0;
      if (atStart && (event.key === "ArrowLeft" || (event.key === "Backspace" && target.value === ""))) {
        const order = [hoursInput, minutesInput, secondsInput].filter(Boolean);
        const index = order.indexOf(target);
        if (index > 0) {
          event.preventDefault();
          order[index - 1].focus();
          order[index - 1].select();
        }
      }
    }
  }

  function setDisabled(next) {
    isDisabled = Boolean(next);
    for (const el of [hoursInput, minutesInput, secondsInput]) {
      if (el) el.disabled = isDisabled;
    }
    trigger.disabled = isDisabled;
    if (valueInput) valueInput.disabled = isDisabled;
    panelApi?.setDisabled(isDisabled);
    durationEl.classList.toggle("duration-input--disabled", isDisabled);
    if (isDisabled) closePopup();
  }

  const initial =
    parseDurationValue(defaultValue, { showSeconds: withSeconds }) ??
    parseDurationValue(durationEl.dataset.durationDefault, { showSeconds: withSeconds }) ??
    parseDurationValue(valueInput?.value, { showSeconds: withSeconds }) ??
    { hours: 0, minutes: 0, seconds: 0 };

  applyParts(initial, { emitEvent: false, padMinutes: true });

  const fields = [hoursInput, minutesInput, secondsInput].filter(Boolean);
  panelApi = mountTimePickerPanel(panelEl, {
    parts,
    mode: "duration",
    maxHours: resolvedMaxHours,
    showSeconds: withSeconds,
    showZero: true,
    showNow: false,
    disabled: isDisabled,
    onInput(detail) {
      parts = { ...detail.parts };
      syncFields({ padMinutes: true });
      syncHidden();
      emit(onInput, detail.source);
    },
    onChange(detail) {
      applyParts(detail.parts, { source: detail.source });
      if (detail.source === "zero") {
        closePopup();
        hoursInput.focus();
        hoursInput.select();
      }
    },
  });
  if (!panelApi) {
    if (createdTrigger) trigger.remove();
    if (createdPopup) popup.remove();
    return null;
  }

  function openPopup() {
    if (isOpen || isDisabled) return;
    registerOpenPopup(closePopup);
    isOpen = true;
    commitFields({ emitEvent: false, source: "open" });
    panelApi.setParts(parts);
    setHidden(popup, false);
    trigger.setAttribute("aria-expanded", "true");
    panelApi.focus();
  }

  function closePopup() {
    unregisterOpenPopup(closePopup);
    if (!isOpen) return;
    isOpen = false;
    setHidden(popup, true);
    trigger.setAttribute("aria-expanded", "false");
  }

  function onTriggerClick(event) {
    event.stopPropagation();
    if (isOpen) closePopup();
    else openPopup();
  }

  function onPopupClick(event) {
    event.stopPropagation();
  }

  setDisabled(isDisabled);
  control.addEventListener("click", onControlClick);
  trigger.addEventListener("click", onTriggerClick);
  popup.addEventListener("click", onPopupClick);
  for (const field of fields) {
    field.addEventListener("focus", onFieldFocus);
    field.addEventListener("click", onFieldClick);
    field.addEventListener("input", onFieldInput);
    field.addEventListener("blur", onFieldBlur);
    field.addEventListener("keydown", onFieldKeydown);
  }

  const removeClickOutside = onDocumentClickOutside((event) => {
    if (!durationEl.contains(event.target)) {
      commitFields({ source: "outside" });
      closePopup();
    }
  });
  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    closePopup();
    trigger.focus();
    return true;
  }, { priority: 50 });

  return {
    getValue() {
      return formatDurationValue(parts, { showSeconds: withSeconds });
    },
    getSeconds() {
      return partsToSeconds(parts, withSeconds);
    },
    getParts() {
      return { ...parts, seconds: withSeconds ? parts.seconds : 0 };
    },
    setValue(value) {
      const parsed = parseDurationValue(value, { showSeconds: withSeconds });
      if (!parsed) {
        applyParts({ hours: 0, minutes: 0, seconds: 0 });
        return;
      }
      applyParts(parsed);
    },
    setSeconds(totalSeconds) {
      const parsed = parseDurationValue(totalSeconds, { showSeconds: withSeconds });
      applyParts(parsed ?? { hours: 0, minutes: 0, seconds: 0 });
    },
    setDisabled,
    open: openPopup,
    close: closePopup,
    destroy() {
      removeClickOutside();
      removeEscape();
      closePopup();
      control.removeEventListener("click", onControlClick);
      trigger.removeEventListener("click", onTriggerClick);
      popup.removeEventListener("click", onPopupClick);
      for (const field of fields) {
        field.removeEventListener("focus", onFieldFocus);
        field.removeEventListener("click", onFieldClick);
        field.removeEventListener("input", onFieldInput);
        field.removeEventListener("blur", onFieldBlur);
        field.removeEventListener("keydown", onFieldKeydown);
      }
      panelApi?.destroy();
      panelApi = null;
      if (createdTrigger) trigger.remove();
      if (createdPopup) popup.remove();
    },
  };
}

/** Wire every `.duration-input` block in `root`. */
export function initDurationInputs(root = document) {
  const instances = [];
  root.querySelectorAll(".duration-input").forEach((durationEl) => {
    const instance = initDurationInput(durationEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
