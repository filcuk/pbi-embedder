import { setHidden } from "../../utils/dom.js";
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
} from "../time-picker/panel.js";
import { parseTimeValue } from "../time-picker/index.js";
import { initTimeFieldSegments } from "../time-picker/field.js";
import {
  buildMonthCells,
  ensureWeekdayLabels,
  getYearWindowStart,
  monthLabel,
} from "./calendar.js";
import {
  formatDisplayDate,
  formatResult,
  getTodayDate,
  isAfterDay,
  isBeforeDay,
  parseInputDate,
  parseISODate,
  sameDay,
  toISODate,
} from "./parse.js";

/**
 * Custom calendar popup with optional side-by-side time panel.
 *
 * Markup:
 *   <div class="date-picker" data-date-picker-time>
 *     <div class="date-picker-row">
 *       <div class="date-picker-control">…</div>
 *       <input type="text" class="input date-picker-time" />
 *     </div>
 *     <div class="date-picker-popup hidden" role="dialog" …>
 *       <!-- calendar contents; init wraps into a shell with a time panel -->
 *     </div>
 *   </div>
 *
 * data-date-picker-time — pair a time field + mount the time panel beside the calendar
 * data-date-picker-seconds — include seconds in the paired time panel
 * data-date-min / data-date-max — ISO date strings (YYYY-MM-DD)
 */

/** @typedef {"days" | "months" | "years"} DatePickerView */

function partsFromTimeString(value, { showSeconds = false } = {}) {
  const parsed = parseTimeValue(value);
  if (!parsed) {
    return normalizeTimePickerParts(
      { hours: 0, minutes: 0, seconds: 0 },
      { mode: "time", showSeconds }
    );
  }
  const [hours, minutes, seconds] = parsed.split(":").map(Number);
  return normalizeTimePickerParts(
    { hours, minutes, seconds: seconds || 0 },
    { mode: "time", showSeconds }
  );
}

export function initDatePicker(
  pickerEl,
  { locale, min, max, defaultDate, defaultTime, onChange, onError } = {}
) {
  if (!pickerEl) return null;

  const valueInput = pickerEl.querySelector(".date-picker-value");
  const displayInput = pickerEl.querySelector(".date-picker-input");
  const trigger = pickerEl.querySelector(".date-picker-trigger");
  const popup = pickerEl.querySelector(".date-picker-popup");
  const captionEl =
    pickerEl.querySelector(".date-picker-caption") ||
    pickerEl.querySelector(".date-picker-month");
  const weekdaysEl = pickerEl.querySelector(".date-picker-weekdays");
  const grid = pickerEl.querySelector(".date-picker-grid");
  const prevBtn = pickerEl.querySelector("[data-date-picker-prev]");
  const nextBtn = pickerEl.querySelector("[data-date-picker-next]");
  let timeInput = pickerEl.querySelector(".date-picker-time");

  if (!displayInput || !popup || !grid || !captionEl) return null;

  ensureWeekdayLabels(weekdaysEl);

  const hasTime =
    pickerEl.hasAttribute("data-date-picker-time") ||
    pickerEl.dataset.datePickerTime === "true";
  const showSeconds =
    pickerEl.hasAttribute("data-date-picker-seconds") ||
    pickerEl.dataset.datePickerSeconds === "true";

  const minDate = parseISODate(min ?? pickerEl.dataset.dateMin);
  const maxDate = parseISODate(max ?? pickerEl.dataset.dateMax);

  /** @type {ReturnType<typeof mountTimePickerPanel> | null} */
  let timePanelApi = null;
  /** @type {HTMLElement | null} */
  let timePanelHost = null;
  /** @type {HTMLElement | null} */
  let timePanelEl = null;

  function getTimeValue() {
    if (!hasTime) return "";
    if (timePanelApi) return timePanelApi.getValue();
    return timeInput?.value || "";
  }

  function setTimeValue(next, { emitEvent = false } = {}) {
    if (!hasTime) return;
    const parts = partsFromTimeString(next, { showSeconds });
    const value = formatTimePickerParts(parts, {
      mode: "time",
      showSeconds,
    });
    if (timeInput) timeInput.value = value;
    timePanelApi?.setParts(parts);
    if (emitEvent && selectedDate) emitChange();
  }

  function ensureTimeField() {
    if (!hasTime) return;

    const row =
      pickerEl.querySelector(".date-picker-row") ||
      displayInput.closest(".date-picker-control")?.parentElement;

    if (!timeInput) {
      timeInput = document.createElement("input");
      timeInput.type = "text";
      timeInput.className = "input date-picker-time";
      timeInput.inputMode = "numeric";
      timeInput.autocomplete = "off";
      timeInput.setAttribute("aria-label", "Time");
      (row || pickerEl).append(timeInput);
    } else if (timeInput.type === "time") {
      timeInput.type = "text";
      timeInput.inputMode = "numeric";
      timeInput.autocomplete = "off";
      timeInput.classList.add("input", "date-picker-time");
    }

    timeInput.removeAttribute("hidden");
    setHidden(timeInput, false);
    if (!timeInput.value) {
      timeInput.value = parseTimeValue(defaultTime) ?? (showSeconds ? "00:00:00" : "00:00");
    }
  }

  function ensureTimeShell() {
    if (!hasTime) return;

    pickerEl.classList.add("date-picker--with-time");
    ensureTimeField();

    let shell = popup.querySelector(":scope > .date-picker-shell");
    if (!shell) {
      const calendar = document.createElement("div");
      calendar.className = "date-picker-calendar";
      while (popup.firstChild) {
        calendar.append(popup.firstChild);
      }

      const divider = document.createElement("div");
      divider.className = "date-picker-time-divider";
      divider.setAttribute("aria-hidden", "true");
      divider.setAttribute("role", "presentation");

      timePanelHost = document.createElement("div");
      timePanelHost.className = "date-picker-time-panel";

      shell = document.createElement("div");
      shell.className = "date-picker-shell";
      shell.append(calendar, divider, timePanelHost);
      popup.append(shell);
    } else {
      timePanelHost = shell.querySelector(".date-picker-time-panel");
      if (!timePanelHost) {
        timePanelHost = document.createElement("div");
        timePanelHost.className = "date-picker-time-panel";
        shell.append(timePanelHost);
      }
    }

    if (!timePanelEl) {
      timePanelEl = timePanelHost.querySelector(":scope > .time-picker-panel");
      if (!timePanelEl) {
        timePanelEl = document.createElement("div");
        timePanelHost.append(timePanelEl);
      }
    }

    // One shared action bar under both columns — the time panel keeps none.
    actionsEl = popup.querySelector(".date-picker-actions");
    if (actionsEl && actionsEl.parentElement !== popup) {
      popup.append(actionsEl);
    }
    todayBtn = actionsEl?.querySelector("[data-date-picker-today]") ?? null;
    nowBtn = actionsEl?.querySelector("[data-date-picker-now]") ?? null;

    if (!timePanelApi && timePanelEl) {
      timePanelApi = mountTimePickerPanel(timePanelEl, {
        parts: partsFromTimeString(timeInput?.value || defaultTime, {
          showSeconds,
        }),
        mode: "time",
        showSeconds,
        showZero: false,
        showNow: false,
        onInput({ value }) {
          if (timeInput) timeInput.value = value;
          if (selectedDate) emitChange();
        },
        onChange({ value }) {
          if (timeInput) timeInput.value = value;
          if (selectedDate) emitChange();
        },
      });
      if (timeInput) {
        timeInput.value = timePanelApi.getValue();
      }
    }
  }

  const popupId = popup.id || `date-picker-popup-${Math.random().toString(36).slice(2, 9)}`;
  if (!popup.id) popup.id = popupId;
  trigger?.setAttribute("aria-controls", popupId);

  let viewDate = parseISODate(defaultDate ?? valueInput?.value) ?? new Date();
  let selectedDate = parseISODate(defaultDate ?? valueInput?.value);
  /** @type {DatePickerView} */
  let viewMode = "days";
  let isOpen = false;
  let actionsEl = popup.querySelector(".date-picker-actions");
  let todayBtn = actionsEl?.querySelector("[data-date-picker-today]") ?? null;
  let nowBtn = actionsEl?.querySelector("[data-date-picker-now]") ?? null;

  ensureTimeShell();
  actionsEl = popup.querySelector(".date-picker-actions");
  todayBtn = actionsEl?.querySelector("[data-date-picker-today]") ?? null;
  nowBtn = actionsEl?.querySelector("[data-date-picker-now]") ?? null;

  function isDisabledDate(date) {
    if (minDate && isBeforeDay(date, minDate)) return true;
    if (maxDate && isAfterDay(date, maxDate)) return true;
    return false;
  }

  function isMonthDisabled(year, month) {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    if (minDate && isBeforeDay(last, minDate)) return true;
    if (maxDate && isAfterDay(first, maxDate)) return true;
    return false;
  }

  function isYearDisabled(year) {
    const first = new Date(year, 0, 1);
    const last = new Date(year, 11, 31);
    if (minDate && isBeforeDay(last, minDate)) return true;
    if (maxDate && isAfterDay(first, maxDate)) return true;
    return false;
  }

  function emitChange() {
    onChange?.({
      pickerEl,
      date: selectedDate,
      isoDate: selectedDate ? toISODate(selectedDate) : "",
      time: hasTime ? getTimeValue() : "",
      display: selectedDate
        ? formatResult(selectedDate, getTimeValue(), hasTime)
        : "",
    });
  }

  function syncInputs() {
    const isoDate = selectedDate ? toISODate(selectedDate) : "";
    if (valueInput) valueInput.value = isoDate;
    displayInput.value = selectedDate ? formatDisplayDate(selectedDate, locale) : "";
    emitChange();
  }

  function restoreDisplayValue() {
    displayInput.value = selectedDate ? formatDisplayDate(selectedDate, locale) : "";
  }

  function commitInputValue() {
    const { date, valid } = parseInputDate(displayInput.value);

    if (!displayInput.value.trim()) {
      selectedDate = null;
      displayInput.removeAttribute("aria-invalid");
      syncInputs();
      if (isOpen) render();
      return true;
    }

    if (!valid || !date) {
      restoreDisplayValue();
      displayInput.setAttribute("aria-invalid", "true");
      onError?.({ pickerEl, message: "Enter a valid date.", value: displayInput.value });
      return false;
    }

    if (isDisabledDate(date)) {
      restoreDisplayValue();
      displayInput.setAttribute("aria-invalid", "true");
      onError?.({ pickerEl, message: "Date is outside the allowed range.", value: displayInput.value });
      return false;
    }

    selectedDate = date;
    viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
    displayInput.removeAttribute("aria-invalid");
    syncInputs();
    if (isOpen) render();
    return true;
  }

  function applyQuickSelect({ useNow = false } = {}) {
    const today = getTodayDate();

    if (isDisabledDate(today)) {
      onError?.({ pickerEl, message: "Today is outside the allowed range." });
      return;
    }

    selectedDate = today;
    viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
    viewMode = "days";

    if (hasTime) {
      const now = new Date();
      setTimeValue(
        useNow
          ? formatTimePickerParts(
              {
                hours: now.getHours(),
                minutes: now.getMinutes(),
                seconds: now.getSeconds(),
              },
              { mode: "time", showSeconds }
            )
          : showSeconds
            ? "00:00:00"
            : "00:00"
      );
    }

    displayInput.removeAttribute("aria-invalid");
    syncInputs();
    render();
    closePopup();
    displayInput.focus();
  }

  function ensureQuickActions() {
    if (!actionsEl) {
      actionsEl = document.createElement("div");
      actionsEl.className = "date-picker-actions";
      popup.append(actionsEl);
    }

    if (!todayBtn) {
      todayBtn = document.createElement("button");
      todayBtn.type = "button";
      todayBtn.className = "btn btn-slim date-picker-quick-btn";
      todayBtn.dataset.datePickerToday = "";
      todayBtn.textContent = "Today";
      actionsEl.append(todayBtn);
    }

    if (!todayBtn.dataset.datePickerBound) {
      todayBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        applyQuickSelect({ useNow: false });
      });
      todayBtn.dataset.datePickerBound = "true";
    }

    if (hasTime) {
      if (!nowBtn) {
        nowBtn = document.createElement("button");
        nowBtn.type = "button";
        nowBtn.className = "btn btn-slim date-picker-quick-btn";
        nowBtn.dataset.datePickerNow = "";
        nowBtn.textContent = "Now";
        actionsEl.append(nowBtn);
      }

      setHidden(nowBtn, false);

      if (!nowBtn.dataset.datePickerBound) {
        nowBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          applyQuickSelect({ useNow: true });
        });
        nowBtn.dataset.datePickerBound = "true";
      }
    } else if (nowBtn) {
      setHidden(nowBtn, true);
    }
  }

  function setQuickActionsVisible(visible) {
    if (actionsEl) setHidden(actionsEl, !visible);
  }

  function updateQuickActions() {
    if (!todayBtn) return;

    const todayDisabled = isDisabledDate(getTodayDate());
    todayBtn.disabled = todayDisabled;
    if (nowBtn && !nowBtn.hidden) nowBtn.disabled = todayDisabled;
  }

  function createCaptionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "date-picker-caption-part";
    button.textContent = label;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      onClick();
    });
    return button;
  }

  function renderHeader() {
    captionEl.replaceChildren();
    captionEl.classList.remove("date-picker-caption-range");

    if (viewMode === "days") {
      prevBtn?.setAttribute("aria-label", "Previous month");
      nextBtn?.setAttribute("aria-label", "Next month");
      captionEl.append(
        createCaptionButton(monthLabel(viewDate, locale, "long"), () => {
          viewMode = "months";
          render();
        }),
        createCaptionButton(String(viewDate.getFullYear()), () => {
          viewMode = "years";
          render();
        })
      );
      return;
    }

    if (viewMode === "months") {
      prevBtn?.setAttribute("aria-label", "Previous year");
      nextBtn?.setAttribute("aria-label", "Next year");
      captionEl.append(
        createCaptionButton(String(viewDate.getFullYear()), () => {
          viewMode = "years";
          render();
        })
      );
      return;
    }

    const startYear = getYearWindowStart(viewDate.getFullYear());
    const endYear = startYear + 11;
    prevBtn?.setAttribute("aria-label", "Previous years");
    nextBtn?.setAttribute("aria-label", "Next years");
    captionEl.classList.add("date-picker-caption-range");
    captionEl.textContent = `${startYear} - ${endYear}`;
  }

  function renderDays() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const today = new Date();

    if (weekdaysEl) setHidden(weekdaysEl, false);
    grid.classList.remove("is-choice-grid");
    grid.setAttribute("role", "grid");

    grid.replaceChildren();

    buildMonthCells(year, month).forEach(({ date, outside }) => {
      const dayBtn = document.createElement("button");
      dayBtn.type = "button";
      dayBtn.className = "date-picker-day";
      dayBtn.setAttribute("role", "gridcell");
      dayBtn.dataset.date = toISODate(date);
      dayBtn.textContent = String(date.getDate());

      if (outside) dayBtn.classList.add("is-outside");
      if (sameDay(date, today)) dayBtn.classList.add("is-today");
      if (selectedDate && sameDay(date, selectedDate)) {
        dayBtn.classList.add("is-selected");
        dayBtn.setAttribute("aria-selected", "true");
      } else {
        dayBtn.setAttribute("aria-selected", "false");
      }

      if (isDisabledDate(date)) {
        dayBtn.disabled = true;
      }

      dayBtn.addEventListener("click", () => {
        selectedDate = date;
        viewDate = new Date(date.getFullYear(), date.getMonth(), 1);
        syncInputs();
        viewMode = "days";
        render();
        if (hasTime && timePanelApi) {
          timePanelApi.focus();
        } else {
          closePopup();
          displayInput.focus();
        }
      });

      grid.append(dayBtn);
    });
  }

  function renderMonths() {
    const year = viewDate.getFullYear();

    if (weekdaysEl) setHidden(weekdaysEl, true);
    grid.classList.add("is-choice-grid");
    grid.setAttribute("role", "listbox");
    grid.replaceChildren();

    for (let month = 0; month < 12; month += 1) {
      const monthBtn = document.createElement("button");
      monthBtn.type = "button";
      monthBtn.className = "date-picker-choice";
      monthBtn.setAttribute("role", "option");
      monthBtn.textContent = monthLabel(new Date(year, month, 1), locale, "short");

      if (month === viewDate.getMonth()) {
        monthBtn.classList.add("is-selected");
        monthBtn.setAttribute("aria-selected", "true");
      } else {
        monthBtn.setAttribute("aria-selected", "false");
      }

      if (isMonthDisabled(year, month)) {
        monthBtn.disabled = true;
      }

      monthBtn.addEventListener("click", () => {
        viewDate = new Date(year, month, 1);
        viewMode = "days";
        render();
      });

      grid.append(monthBtn);
    }
  }

  function renderYears() {
    const startYear = getYearWindowStart(viewDate.getFullYear());

    if (weekdaysEl) setHidden(weekdaysEl, true);
    grid.classList.add("is-choice-grid");
    grid.setAttribute("role", "listbox");
    grid.replaceChildren();

    for (let year = startYear; year < startYear + 12; year += 1) {
      const yearBtn = document.createElement("button");
      yearBtn.type = "button";
      yearBtn.className = "date-picker-choice";
      yearBtn.setAttribute("role", "option");
      yearBtn.textContent = String(year);

      if (year === viewDate.getFullYear()) {
        yearBtn.classList.add("is-selected");
        yearBtn.setAttribute("aria-selected", "true");
      } else {
        yearBtn.setAttribute("aria-selected", "false");
      }

      if (isYearDisabled(year)) {
        yearBtn.disabled = true;
      }

      yearBtn.addEventListener("click", () => {
        viewDate = new Date(year, viewDate.getMonth(), 1);
        viewMode = "months";
        render();
      });

      grid.append(yearBtn);
    }
  }

  function render() {
    renderHeader();

    if (viewMode === "months") {
      setQuickActionsVisible(false);
      renderMonths();
      return;
    }

    if (viewMode === "years") {
      setQuickActionsVisible(false);
      renderYears();
      return;
    }

    setQuickActionsVisible(true);
    updateQuickActions();
    renderDays();
  }

  function openPopup() {
    if (isOpen) return;
    registerOpenPopup(closePopup);
    isOpen = true;
    viewMode = "days";
    const viewFrom = selectedDate ?? parseInputDate(displayInput.value).date;
    if (viewFrom) {
      viewDate = new Date(viewFrom.getFullYear(), viewFrom.getMonth(), 1);
    }
    render();
    setHidden(popup, false);
    trigger?.setAttribute("aria-expanded", "true");
    prevBtn?.focus();
  }

  function closePopup() {
    unregisterOpenPopup(closePopup);
    if (!isOpen) return;
    isOpen = false;
    viewMode = "days";
    setHidden(popup, true);
    trigger?.setAttribute("aria-expanded", "false");
  }

  function togglePopup() {
    if (isOpen) closePopup();
    else openPopup();
  }

  function shiftView(delta) {
    if (viewMode === "days") {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1);
    } else if (viewMode === "months") {
      viewDate = new Date(viewDate.getFullYear() + delta, viewDate.getMonth(), 1);
    } else {
      const startYear = getYearWindowStart(viewDate.getFullYear()) + delta * 12;
      viewDate = new Date(startYear, viewDate.getMonth(), 1);
    }
    render();
  }

  function stepBackView() {
    if (viewMode === "years") {
      viewMode = "months";
      render();
      return true;
    }
    if (viewMode === "months") {
      viewMode = "days";
      render();
      return true;
    }
    return false;
  }

  displayInput.removeAttribute("readonly");
  if (!displayInput.placeholder) {
    displayInput.placeholder = "Jun 20, 2026";
  }

  displayInput.addEventListener("blur", (event) => {
    const next = event.relatedTarget;
    if (
      next &&
      (next === trigger ||
        next.closest?.(".date-picker-popup") ||
        next.closest?.(".date-picker-trigger"))
    ) {
      return;
    }
    commitInputValue();
  });

  displayInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitInputValue();
      closePopup();
      return;
    }

    if (event.key === "ArrowDown" && !isOpen) {
      event.preventDefault();
      openPopup();
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.stopPropagation();
    }
  });

  displayInput.addEventListener("focus", () => {
    displayInput.removeAttribute("aria-invalid");
  });

  trigger?.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePopup();
  });

  prevBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    shiftView(-1);
  });

  nextBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    shiftView(1);
  });

  popup.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  timeInput?.addEventListener("change", () => {
    const parsed = parseTimeValue(timeInput.value);
    if (!parsed) {
      timeInput.setAttribute("aria-invalid", "true");
      return;
    }
    timeInput.removeAttribute("aria-invalid");
    setTimeValue(parsed);
    if (selectedDate) emitChange();
  });

  timeInput?.addEventListener("focus", () => {
    timeInput.removeAttribute("aria-invalid");
  });

  const timeSegments = hasTime
    ? initTimeFieldSegments(timeInput, {
        showSeconds,
        getParts: () => partsFromTimeString(timeInput?.value, { showSeconds }),
        applyParts(parts) {
          setTimeValue(
            formatTimePickerParts(parts, { mode: "time", showSeconds }),
            { emitEvent: true }
          );
        },
      })
    : null;

  const removeClickOutside = onDocumentClickOutside((event) => {
    if (!pickerEl.contains(event.target)) {
      commitInputValue();
      closePopup();
    }
  });

  const removeEscape = onDocumentEscape(() => {
    if (!isOpen) return false;
    if (stepBackView()) return true;
    closePopup();
    trigger?.focus();
    return true;
  }, { priority: 50 });

  if (defaultTime && hasTime) {
    setTimeValue(defaultTime);
  }

  ensureQuickActions();

  if (selectedDate) {
    syncInputs();
  } else {
    emitChange();
  }

  return {
    open: openPopup,
    close: closePopup,
    getValue: () => ({
      date: selectedDate,
      isoDate: selectedDate ? toISODate(selectedDate) : "",
      time: hasTime ? getTimeValue() : "",
    }),
    setValue: ({ date, isoDate, time } = {}) => {
      const nextDate = date ?? parseISODate(isoDate);
      selectedDate = nextDate;
      if (nextDate) {
        viewDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), 1);
      }
      if (time !== undefined && hasTime) setTimeValue(time);
      syncInputs();
      if (isOpen) render();
    },
    destroy: () => {
      removeClickOutside();
      removeEscape();
      timeSegments?.destroy();
      timePanelApi?.destroy();
      timePanelApi = null;
      closePopup();
    },
  };
}

/** Wire every `.date-picker` block in `root`. */
export function initDatePickers(root = document) {
  const instances = [];
  root.querySelectorAll(".date-picker").forEach((pickerEl) => {
    const instance = initDatePicker(pickerEl);
    if (instance) instances.push(instance);
  });
  return instances;
}
