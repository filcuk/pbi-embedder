/**
 * Shared time-picker panel — segmented hours / minutes / optional seconds.
 * Used by the standalone picker and, in duration mode, by duration inputs.
 */

import { createIcon } from "../../utils/icons.js";

const SEGMENTS = ["hours", "minutes", "seconds"];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Math.trunc(Number(value) || 0)));
}

function segmentMax(segment, { mode, maxHours }) {
  if (segment === "hours") return mode === "duration" ? maxHours : 23;
  return 59;
}

/**
 * Wrap one field independently without carrying into adjacent fields.
 *
 * @param {{ hours: number, minutes: number, seconds?: number }} parts
 * @param {"hours" | "minutes" | "seconds"} segment
 * @param {number} delta
 * @param {{ mode?: "time" | "duration", maxHours?: number, showSeconds?: boolean }} [options]
 */
export function wrapTimePickerSegment(
  parts,
  segment,
  delta,
  { mode = "time", maxHours = 99, showSeconds = false } = {}
) {
  const next = normalizeTimePickerParts(parts, { mode, maxHours, showSeconds });
  if (!SEGMENTS.includes(segment) || (segment === "seconds" && !showSeconds)) {
    return next;
  }

  const max = segmentMax(segment, { mode, maxHours });
  const range = max + 1;
  next[segment] = ((next[segment] + Math.trunc(delta || 0)) % range + range) % range;
  return next;
}

/**
 * @param {{ hours?: number, minutes?: number, seconds?: number }} parts
 * @param {{ mode?: "time" | "duration", maxHours?: number, showSeconds?: boolean }} [options]
 */
export function normalizeTimePickerParts(
  parts,
  { mode = "time", maxHours = 99, showSeconds = false } = {}
) {
  const resolvedMaxHours = mode === "duration" ? Math.max(0, Math.trunc(maxHours)) : 23;
  return {
    hours: clamp(parts?.hours, 0, resolvedMaxHours),
    minutes: clamp(parts?.minutes, 0, 59),
    seconds: showSeconds ? clamp(parts?.seconds, 0, 59) : 0,
  };
}

/**
 * @param {{ hours: number, minutes: number, seconds?: number }} parts
 * @param {{ mode?: "time" | "duration", showSeconds?: boolean }} [options]
 */
export function formatTimePickerParts(
  parts,
  { mode = "time", showSeconds = false } = {}
) {
  const hours =
    mode === "duration"
      ? String(Math.max(0, Math.trunc(parts.hours || 0)))
      : String(Math.max(0, Math.trunc(parts.hours || 0))).padStart(2, "0");
  const minutes = String(Math.max(0, Math.trunc(parts.minutes || 0))).padStart(2, "0");
  const seconds = String(Math.max(0, Math.trunc(parts.seconds || 0))).padStart(2, "0");
  return showSeconds ? `${hours}:${minutes}:${seconds}` : `${hours}:${minutes}`;
}

function createNudgeButton(segment, delta) {
  const direction = delta > 0 ? "up" : "down";
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn btn-icon time-picker-nudge time-picker-nudge-${direction}`;
  button.dataset.timePickerSegment = segment;
  button.dataset.timePickerDelta = String(delta);
  button.setAttribute(
    "aria-label",
    `${delta > 0 ? "Increase" : "Decrease"} ${segment}`
  );
  button.append(
    createIcon(delta > 0 ? "chevron-up" : "chevron-down", {
      className: "time-picker-nudge-icon",
    })
  );
  return button;
}

/**
 * Mount an always-visible time control body into `panelEl`.
 *
 * @param {HTMLElement | null} panelEl
 * @param {{
 *   parts?: { hours?: number, minutes?: number, seconds?: number },
 *   mode?: "time" | "duration",
 *   maxHours?: number,
 *   showSeconds?: boolean,
 *   showZero?: boolean,
 *   showNow?: boolean,
 *   disabled?: boolean,
 *   onInput?: (detail: object) => void,
 *   onChange?: (detail: object) => void,
 * }} [options]
 */
export function mountTimePickerPanel(
  panelEl,
  {
    parts: initialParts = { hours: 0, minutes: 0, seconds: 0 },
    mode = "time",
    maxHours = 99,
    showSeconds = false,
    showZero = true,
    showNow = mode === "time",
    disabled = false,
    onInput,
    onChange,
  } = {}
) {
  if (!(panelEl instanceof HTMLElement)) return null;

  const resolvedMode = mode === "duration" ? "duration" : "time";
  const resolvedMaxHours = Math.max(0, Math.trunc(Number(maxHours) || 0));
  let parts = normalizeTimePickerParts(initialParts, {
    mode: resolvedMode,
    maxHours: resolvedMaxHours,
    showSeconds,
  });
  let isDisabled = Boolean(disabled);
  const cleanups = [];
  /** @type {Partial<Record<"hours" | "minutes" | "seconds", HTMLInputElement>>} */
  const inputs = {};

  panelEl.replaceChildren();
  panelEl.classList.add("time-picker-panel");
  panelEl.dataset.timePickerMode = resolvedMode;

  const fields = document.createElement("div");
  fields.className = "time-picker-fields";
  fields.setAttribute("role", "group");
  fields.setAttribute(
    "aria-label",
    resolvedMode === "duration" ? "Choose duration" : "Choose time"
  );

  function buildDetail(source) {
    return {
      panelEl,
      parts: { ...parts },
      value: formatTimePickerParts(parts, {
        mode: resolvedMode,
        showSeconds,
      }),
      mode: resolvedMode,
      source,
    };
  }

  function syncInputs() {
    for (const segment of SEGMENTS) {
      const input = inputs[segment];
      if (!input) continue;
      input.value =
        segment === "hours" && resolvedMode === "duration"
          ? String(parts[segment])
          : String(parts[segment]).padStart(2, "0");
    }
  }

  function emit(source, { commit = false } = {}) {
    const detail = buildDetail(source);
    onInput?.(detail);
    if (commit) onChange?.(detail);
  }

  function setParts(next, { emitEvent = false, source = "api", commit = false } = {}) {
    parts = normalizeTimePickerParts(next, {
      mode: resolvedMode,
      maxHours: resolvedMaxHours,
      showSeconds,
    });
    syncInputs();
    if (emitEvent) emit(source, { commit });
  }

  function addSegment(segment, label) {
    const column = document.createElement("div");
    column.className = `time-picker-field time-picker-field-${segment}`;

    const up = createNudgeButton(segment, 1);
    const input = document.createElement("input");
    input.type = "text";
    input.className = "input time-picker-segment";
    input.inputMode = "numeric";
    input.maxLength =
      segment === "hours" && resolvedMode === "duration"
        ? String(resolvedMaxHours).length
        : 2;
    input.setAttribute("aria-label", label);
    input.dataset.timePickerSegment = segment;
    inputs[segment] = input;
    const down = createNudgeButton(segment, -1);

    const onNudge = (event) => {
      event.stopPropagation();
      if (isDisabled) return;
      const delta = Number(event.currentTarget.dataset.timePickerDelta);
      setParts(
        wrapTimePickerSegment(parts, segment, delta, {
          mode: resolvedMode,
          maxHours: resolvedMaxHours,
          showSeconds,
        }),
        { emitEvent: true, source: "nudge", commit: true }
      );
      input.focus();
      input.select();
    };
    up.addEventListener("click", onNudge);
    down.addEventListener("click", onNudge);
    cleanups.push(() => up.removeEventListener("click", onNudge));
    cleanups.push(() => down.removeEventListener("click", onNudge));

    const onFocus = () => input.select();
    const onInputEvent = () => {
      input.value = input.value.replace(/\D+/g, "");
      const max = segmentMax(segment, {
        mode: resolvedMode,
        maxHours: resolvedMaxHours,
      });
      parts[segment] = clamp(input.value, 0, max);
      emit("input");
    };
    const onChangeEvent = () => {
      setParts(parts, { emitEvent: true, source: "change", commit: true });
    };
    const onKeydown = (event) => {
      if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
      event.preventDefault();
      setParts(
        wrapTimePickerSegment(parts, segment, event.key === "ArrowUp" ? 1 : -1, {
          mode: resolvedMode,
          maxHours: resolvedMaxHours,
          showSeconds,
        }),
        { emitEvent: true, source: "keyboard", commit: true }
      );
      input.select();
    };
    input.addEventListener("focus", onFocus);
    input.addEventListener("click", onFocus);
    input.addEventListener("input", onInputEvent);
    input.addEventListener("change", onChangeEvent);
    input.addEventListener("keydown", onKeydown);
    cleanups.push(() => input.removeEventListener("focus", onFocus));
    cleanups.push(() => input.removeEventListener("click", onFocus));
    cleanups.push(() => input.removeEventListener("input", onInputEvent));
    cleanups.push(() => input.removeEventListener("change", onChangeEvent));
    cleanups.push(() => input.removeEventListener("keydown", onKeydown));

    column.append(up, input, down);
    fields.append(column);
  }

  addSegment("hours", "Hours");
  addSegment("minutes", "Minutes");
  if (showSeconds) addSegment("seconds", "Seconds");
  // Drives the fixed popup width so it does not track the host field.
  panelEl.style.setProperty("--time-picker-columns", showSeconds ? "3" : "2");
  panelEl.append(fields);

  if (showZero || (showNow && resolvedMode === "time")) {
    const actions = document.createElement("div");
    actions.className = "time-picker-actions";

    function addAction(label, source, getParts) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-slim time-picker-quick-btn";
      button.textContent = label;
      const onClick = (event) => {
        event.stopPropagation();
        if (isDisabled) return;
        setParts(getParts(), { emitEvent: true, source, commit: true });
      };
      button.addEventListener("click", onClick);
      cleanups.push(() => button.removeEventListener("click", onClick));
      actions.append(button);
    }

    if (showZero) {
      addAction(showSeconds ? "00:00:00" : "00:00", "zero", () => ({
        hours: 0,
        minutes: 0,
        seconds: 0,
      }));
    }
    if (showNow && resolvedMode === "time") {
      addAction("Now", "now", () => {
        const now = new Date();
        return {
          hours: now.getHours(),
          minutes: now.getMinutes(),
          seconds: showSeconds ? now.getSeconds() : 0,
        };
      });
    }
    panelEl.append(actions);
  }

  const controls = Array.from(panelEl.querySelectorAll("button, input"));

  function setDisabled(next) {
    isDisabled = Boolean(next);
    controls.forEach((control) => {
      control.disabled = isDisabled;
    });
    panelEl.classList.toggle("time-picker-panel--disabled", isDisabled);
  }

  syncInputs();
  setDisabled(isDisabled);

  return {
    getParts: () => ({ ...parts }),
    getValue: () =>
      formatTimePickerParts(parts, {
        mode: resolvedMode,
        showSeconds,
      }),
    setParts,
    setDisabled,
    focus() {
      inputs.hours?.focus();
    },
    destroy() {
      cleanups.forEach((cleanup) => cleanup());
      panelEl.replaceChildren();
      panelEl.classList.remove("time-picker-panel", "time-picker-panel--disabled");
      panelEl.style.removeProperty("--time-picker-columns");
      delete panelEl.dataset.timePickerMode;
    },
  };
}
