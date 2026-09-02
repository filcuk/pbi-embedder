import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLocalDate,
  parseISODate,
  parseInputDate,
  toISODate,
  isBeforeDay,
} from "../app/components/date-picker/parse.js";

test("parseISODate accepts YYYY-MM-DD", () => {
  const date = parseISODate("2026-06-20");
  assert.equal(toISODate(date), "2026-06-20");
});

test("parseInputDate rejects invalid input", () => {
  assert.deepEqual(parseInputDate("not-a-date"), { date: null, valid: false });
});

test("isBeforeDay compares calendar days", () => {
  const a = buildLocalDate(2026, 6, 1);
  const b = buildLocalDate(2026, 6, 2);
  assert.equal(isBeforeDay(a, b), true);
});
