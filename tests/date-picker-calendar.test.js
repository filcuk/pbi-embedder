import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMonthCells,
  getYearWindowStart,
} from "../app/components/date-picker/calendar.js";

test("buildMonthCells returns 42 cells", () => {
  assert.equal(buildMonthCells(2026, 5).length, 42);
});

test("getYearWindowStart aligns to 12-year windows", () => {
  assert.equal(getYearWindowStart(2026), 2016);
  assert.equal(getYearWindowStart(2019), 2016);
  assert.equal(getYearWindowStart(2011), 2004);
});
