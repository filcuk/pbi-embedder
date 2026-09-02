export const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function getWeekStartOffset(date) {
  return (date.getDay() + 6) % 7;
}

/** @param {HTMLElement | null} weekdaysEl */
export function ensureWeekdayLabels(weekdaysEl) {
  if (!weekdaysEl) return;

  const labels = [...weekdaysEl.querySelectorAll("span")].map((span) => span.textContent.trim());
  if (
    labels.length === WEEKDAY_LABELS.length &&
    labels.every((label, index) => label === WEEKDAY_LABELS[index])
  ) {
    return;
  }

  weekdaysEl.replaceChildren(
    ...WEEKDAY_LABELS.map((label) => {
      const span = document.createElement("span");
      span.textContent = label;
      return span;
    })
  );
}

export function buildMonthCells(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startOffset = getWeekStartOffset(firstOfMonth);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells = [];

  for (let index = startOffset - 1; index >= 0; index -= 1) {
    cells.push({
      date: new Date(year, month - 1, daysInPrevMonth - index),
      outside: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), outside: false });
  }

  while (cells.length < 42) {
    const day = cells.length - startOffset - daysInMonth + 1;
    cells.push({ date: new Date(year, month + 1, day), outside: true });
  }

  return cells;
}

export function getYearWindowStart(year) {
  return Math.floor(year / 12) * 12;
}

export function monthLabel(date, locale, style = "long") {
  return date.toLocaleDateString(locale, { month: style });
}
