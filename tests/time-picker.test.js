import test from "node:test";
import assert from "node:assert/strict";
import { parseTimeValue, isTimeWithinBounds } from "../app/components/time-picker.js";
import {
  formatTimePickerParts,
  normalizeTimePickerParts,
  wrapTimePickerSegment,
} from "../app/components/time-picker/panel.js";

test("parseTimeValue normalises HH:MM and HH:MM:SS", () => {
  assert.equal(parseTimeValue("14:30"), "14:30");
  assert.equal(parseTimeValue("9:05"), "09:05");
  assert.equal(parseTimeValue("14:30:05"), "14:30:05");
  assert.equal(parseTimeValue("0:00"), "00:00");
});

test("parseTimeValue rejects invalid input", () => {
  assert.equal(parseTimeValue(""), null);
  assert.equal(parseTimeValue(null), null);
  assert.equal(parseTimeValue("25:00"), null);
  assert.equal(parseTimeValue("12:60"), null);
  assert.equal(parseTimeValue("12:30:99"), null);
  assert.equal(parseTimeValue("noon"), null);
});

test("isTimeWithinBounds respects min and max", () => {
  assert.equal(isTimeWithinBounds("14:30", "09:00", "17:00"), true);
  assert.equal(isTimeWithinBounds("08:00", "09:00", "17:00"), false);
  assert.equal(isTimeWithinBounds("18:00", "09:00", "17:00"), false);
  assert.equal(isTimeWithinBounds("", "09:00", "17:00"), true);
});

test("time picker segments wrap independently", () => {
  assert.deepEqual(
    wrapTimePickerSegment(
      { hours: 23, minutes: 59, seconds: 59 },
      "minutes",
      1
    ),
    { hours: 23, minutes: 0, seconds: 0 }
  );
  assert.deepEqual(
    wrapTimePickerSegment(
      { hours: 0, minutes: 0, seconds: 0 },
      "hours",
      -1
    ),
    { hours: 23, minutes: 0, seconds: 0 }
  );
});

test("duration-mode panel wraps hours within max without carrying", () => {
  assert.deepEqual(
    wrapTimePickerSegment(
      { hours: 24, minutes: 59, seconds: 0 },
      "minutes",
      1,
      { mode: "duration", maxHours: 24 }
    ),
    { hours: 24, minutes: 0, seconds: 0 }
  );
  assert.deepEqual(
    wrapTimePickerSegment(
      { hours: 24, minutes: 30, seconds: 0 },
      "hours",
      1,
      { mode: "duration", maxHours: 24 }
    ),
    { hours: 0, minutes: 30, seconds: 0 }
  );
});

test("time picker normalises and formats optional seconds", () => {
  const parts = normalizeTimePickerParts(
    { hours: 30, minutes: -2, seconds: 8 },
    { showSeconds: true }
  );
  assert.deepEqual(parts, { hours: 23, minutes: 0, seconds: 8 });
  assert.equal(
    formatTimePickerParts(parts, { showSeconds: true }),
    "23:00:08"
  );
});
