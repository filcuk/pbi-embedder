export function pad(value) {
  return String(value).padStart(2, "0");
}

export function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildLocalDate(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function parseISODate(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return buildLocalDate(year, month, day);
}

export function parseInputDate(text) {
  const trimmed = text.trim();
  if (!trimmed) return { date: null, valid: true };

  const isoDate = parseISODate(trimmed);
  if (isoDate) return { date: isoDate, valid: true };

  const parts = trimmed.split(/[./\-,\s]+/).filter(Boolean);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const date = buildLocalDate(Number(parts[0]), Number(parts[1]), Number(parts[2]));
      if (date) return { date, valid: true };
    }

    if (parts[2].length === 4) {
      const first = Number(parts[0]);
      const second = Number(parts[1]);
      const year = Number(parts[2]);
      let date = null;

      if (first > 12) date = buildLocalDate(year, second, first);
      else if (second > 12) date = buildLocalDate(year, first, second);
      else date = buildLocalDate(year, first, second);

      if (date) return { date, valid: true };
    }
  }

  const parsedMs = Date.parse(trimmed);
  if (!Number.isNaN(parsedMs)) {
    const parsed = new Date(parsedMs);
    const date = buildLocalDate(
      parsed.getFullYear(),
      parsed.getMonth() + 1,
      parsed.getDate()
    );
    if (date) return { date, valid: true };
  }

  return { date: null, valid: false };
}

export function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isBeforeDay(a, b) {
  return toISODate(a) < toISODate(b);
}

export function isAfterDay(a, b) {
  return toISODate(a) > toISODate(b);
}

export function formatDisplayDate(date, locale) {
  return date.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatResult(date, timeValue, hasTime) {
  const dateLabel = formatDisplayDate(date, undefined);
  if (!hasTime || !timeValue) return dateLabel;
  return `${dateLabel} at ${timeValue}`;
}

export function formatClockTime(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getTodayDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
