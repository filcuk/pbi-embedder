import test from "node:test";
import assert from "node:assert/strict";
import {
  parseDurationValue,
  formatDurationValue,
  nudgeDuration,
} from "../app/components/duration-input.js";

test("parseDurationValue accepts H:MM and HH:MM:SS", () => {
  assert.deepEqual(parseDurationValue("1:30"), {
    hours: 1,
    minutes: 30,
    seconds: 0,
  });
  assert.deepEqual(parseDurationValue("1:30:45", { showSeconds: true }), {
    hours: 1,
    minutes: 30,
    seconds: 45,
  });
  assert.deepEqual(parseDurationValue("01:05"), {
    hours: 1,
    minutes: 5,
    seconds: 0,
  });
});

test("parseDurationValue accepts total seconds as a number or digit string", () => {
  assert.deepEqual(parseDurationValue(90), {
    hours: 0,
    minutes: 1,
    seconds: 0,
  });
  assert.deepEqual(parseDurationValue(90, { showSeconds: true }), {
    hours: 0,
    minutes: 1,
    seconds: 30,
  });
  assert.deepEqual(parseDurationValue("5400"), {
    hours: 1,
    minutes: 30,
    seconds: 0,
  });
});

test("parseDurationValue rejects invalid input", () => {
  assert.equal(parseDurationValue(""), null);
  assert.equal(parseDurationValue(null), null);
  assert.equal(parseDurationValue("1:75"), null);
  assert.equal(parseDurationValue("not-a-duration"), null);
  assert.equal(parseDurationValue("1:30:99", { showSeconds: true }), null);
});

test("formatDurationValue round-trips with parseDurationValue", () => {
  const parts = parseDurationValue("2:05");
  assert.equal(formatDurationValue(parts), "2:05");

  const withSeconds = parseDurationValue("2:05:09", { showSeconds: true });
  assert.equal(
    formatDurationValue(withSeconds, { showSeconds: true }),
    "2:05:09"
  );
});

test("nudgeDuration carries across minutes and saturates at bounds", () => {
  assert.deepEqual(
    nudgeDuration({ hours: 0, minutes: 0, seconds: 0 }, "minutes", -1),
    { hours: 0, minutes: 0, seconds: 0 }
  );
  assert.deepEqual(
    nudgeDuration({ hours: 99, minutes: 59, seconds: 0 }, "minutes", 1, {
      maxHours: 99,
    }),
    { hours: 99, minutes: 59, seconds: 0 }
  );
  assert.deepEqual(
    nudgeDuration({ hours: 0, minutes: 59, seconds: 0 }, "minutes", 1),
    { hours: 1, minutes: 0, seconds: 0 }
  );
  assert.deepEqual(
    nudgeDuration({ hours: 1, minutes: 0, seconds: 0 }, "minutes", -1),
    { hours: 0, minutes: 59, seconds: 0 }
  );
});

test("nudgeDuration saturates seconds at zero and max", () => {
  assert.deepEqual(
    nudgeDuration(
      { hours: 0, minutes: 0, seconds: 0 },
      "seconds",
      -1,
      { showSeconds: true }
    ),
    { hours: 0, minutes: 0, seconds: 0 }
  );
  assert.deepEqual(
    nudgeDuration(
      { hours: 0, minutes: 0, seconds: 59 },
      "seconds",
      1,
      { showSeconds: true, maxHours: 0 }
    ),
    { hours: 0, minutes: 1, seconds: 0 }
  );
  assert.deepEqual(
    nudgeDuration(
      { hours: 0, minutes: 59, seconds: 59 },
      "seconds",
      1,
      { showSeconds: true, maxHours: 0 }
    ),
    { hours: 0, minutes: 59, seconds: 59 }
  );
});
