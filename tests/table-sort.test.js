import test from "node:test";
import assert from "node:assert/strict";
import {
  getCellValue,
  compareValues,
  compareRowsByColumns,
} from "../app/components/table.js";

test("getCellValue parses numbers", () => {
  const cell = { textContent: "$12.50" };
  assert.equal(getCellValue(cell, "number"), 12.5);
});

test("getCellValue parses dates", () => {
  const cell = { textContent: "2026-03-12" };
  assert.equal(getCellValue(cell, "date"), Date.parse("2026-03-12"));
});

test("compareValues sorts text with localeCompare", () => {
  assert.ok(compareValues("alpha", "beta", "text") < 0);
});

test("compareValues sorts numbers numerically", () => {
  assert.equal(compareValues(2, 10, "number"), -8);
});

test("compareValues sorts dates numerically", () => {
  const earlier = Date.parse("2026-01-09");
  const later = Date.parse("2026-03-12");
  assert.ok(compareValues(earlier, later, "date") < 0);
});

test("compareRowsByColumns uses later columns only when earlier ties", () => {
  const rowOpenA = {
    cells: [
      null,
      { textContent: "Alpha" },
      { textContent: "Open" },
      { textContent: "2026-03-01" },
    ],
  };
  const rowOpenB = {
    cells: [
      null,
      { textContent: "Beta" },
      { textContent: "Open" },
      { textContent: "2026-01-01" },
    ],
  };
  const rowClosed = {
    cells: [
      null,
      { textContent: "Alpha" },
      { textContent: "Closed" },
      { textContent: "2026-06-01" },
    ],
  };

  const columns = [
    { columnIndex: 2, sortType: "text", direction: "ascending" },
    { columnIndex: 1, sortType: "text", direction: "ascending" },
  ];

  assert.ok(compareRowsByColumns(rowClosed, rowOpenA, columns) < 0);
  assert.ok(compareRowsByColumns(rowOpenA, rowOpenB, columns) < 0);
});
