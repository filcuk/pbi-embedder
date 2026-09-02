import test from "node:test";
import assert from "node:assert/strict";
import {
  parseColumnType,
  coerceCellValue,
  defaultValueForType,
  parseClipboardTable,
  formatClipboardTable,
  formatCellForClipboard,
  isTabularClipboardText,
  splitClipboardMatrix,
  detectColumnType,
  isNumericCellValue,
  isLogicalCellValue,
  isNumberDraft,
} from "../app/components/tabular-input.js";

test("parseColumnType accepts known types and defaults unknown to text", () => {
  assert.equal(parseColumnType("text"), "text");
  assert.equal(parseColumnType("NUMBER"), "number");
  assert.equal(parseColumnType("logical"), "logical");
  assert.equal(parseColumnType("date"), "text");
  assert.equal(parseColumnType(""), "text");
  assert.equal(parseColumnType(undefined), "text");
});

test("defaultValueForType matches each column type", () => {
  assert.equal(defaultValueForType("text"), "");
  assert.equal(defaultValueForType("number"), null);
  assert.equal(defaultValueForType("logical"), false);
});

test("coerceCellValue to text", () => {
  assert.equal(coerceCellValue(null, "text"), "");
  assert.equal(coerceCellValue(true, "text"), "true");
  assert.equal(coerceCellValue(12, "text"), "12");
  assert.equal(coerceCellValue("hello", "text"), "hello");
});

test("coerceCellValue to number", () => {
  assert.equal(coerceCellValue("", "number"), null);
  assert.equal(coerceCellValue(null, "number"), null);
  assert.equal(coerceCellValue("12.5", "number"), 12.5);
  assert.equal(coerceCellValue("1,000", "number"), 1000);
  assert.equal(coerceCellValue(true, "number"), 1);
  assert.equal(coerceCellValue("nope", "number"), null);
});

test("coerceCellValue to logical", () => {
  assert.equal(coerceCellValue(true, "logical"), true);
  assert.equal(coerceCellValue(0, "logical"), false);
  assert.equal(coerceCellValue("yes", "logical"), true);
  assert.equal(coerceCellValue("off", "logical"), false);
  assert.equal(coerceCellValue("", "logical"), false);
  assert.equal(coerceCellValue("maybe", "logical"), true);
});

test("isNumberDraft accepts in-progress numeric input", () => {
  assert.equal(isNumberDraft(""), true);
  assert.equal(isNumberDraft("-"), true);
  assert.equal(isNumberDraft("12"), true);
  assert.equal(isNumberDraft("1,000"), true);
  assert.equal(isNumberDraft("1."), true);
  assert.equal(isNumberDraft(".5"), true);
  assert.equal(isNumberDraft("1e-"), true);
  assert.equal(isNumberDraft("1e-3"), true);
});

test("isNumberDraft rejects non-numeric input", () => {
  assert.equal(isNumberDraft("abc"), false);
  assert.equal(isNumberDraft("1a"), false);
  assert.equal(isNumberDraft("--1"), false);
  assert.equal(isNumberDraft("1.2.3"), false);
  assert.equal(isNumberDraft("1 2"), false);
});

test("parseClipboardTable splits TSV and pads short rows", () => {
  assert.deepEqual(parseClipboardTable("a\tb\nc"), [
    ["a", "b"],
    ["c", ""],
  ]);
  assert.deepEqual(parseClipboardTable("a\tb\r\nc\td\n"), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("isTabularClipboardText detects tabs and multi-line", () => {
  assert.equal(isTabularClipboardText("a\tb"), true);
  assert.equal(isTabularClipboardText("a\nb"), true);
  assert.equal(isTabularClipboardText("single"), false);
  assert.equal(isTabularClipboardText(""), false);
});

test("detectColumnType prefers number, then logical, else text", () => {
  assert.equal(detectColumnType(["1", "2.5", ""]), "number");
  assert.equal(detectColumnType(["1,000", "2"]), "number");
  assert.equal(detectColumnType(["yes", "no", ""]), "logical");
  assert.equal(detectColumnType(["true", "false"]), "logical");
  assert.equal(detectColumnType(["1", "2", "x"]), "text");
  assert.equal(detectColumnType(["", "", ""]), "text");
  assert.equal(detectColumnType([]), "text");
});

test("isNumericCellValue and isLogicalCellValue helpers", () => {
  assert.equal(isNumericCellValue("12"), true);
  assert.equal(isNumericCellValue("x"), false);
  assert.equal(isLogicalCellValue("yes"), true);
  assert.equal(isLogicalCellValue("maybe"), false);
});

test("formatClipboardTable emits Excel TSV with header row", () => {
  const text = formatClipboardTable(
    [
      { id: "name", label: "Name", type: "text" },
      { id: "qty", label: "Qty", type: "number" },
      { id: "on", label: "On", type: "logical" },
    ],
    [
      { id: "r1", cells: { name: "Widget", qty: 12, on: true } },
      { id: "r2", cells: { name: "Gadget", qty: null, on: false } },
    ]
  );
  assert.equal(text, "Name\tQty\tOn\nWidget\t12\ttrue\nGadget\t\tfalse");
});

test("formatClipboardTable quotes cells with tabs or newlines", () => {
  assert.equal(
    formatClipboardTable(
      [{ id: "a", label: "A", type: "text" }],
      [{ id: "r1", cells: { a: "x\ty" } }]
    ),
    'A\n"x\ty"'
  );
});

test("formatCellForClipboard handles null and logical", () => {
  assert.equal(formatCellForClipboard(null, "number"), "");
  assert.equal(formatCellForClipboard(true, "logical"), "true");
  assert.equal(formatCellForClipboard(false, "logical"), "false");
});

test("splitClipboardMatrix treats all rows as data by default", () => {
  assert.deepEqual(splitClipboardMatrix([
    ["a", "b"],
    ["1", "2"],
  ]), {
    labels: ["Column 1", "Column 2"],
    data: [
      ["a", "b"],
      ["1", "2"],
    ],
  });
});

test("splitClipboardMatrix uses first row as headers when requested", () => {
  assert.deepEqual(
    splitClipboardMatrix(
      [
        ["Name", "Qty"],
        ["Widget", "12"],
      ],
      { firstRowIsHeader: true }
    ),
    {
      labels: ["Name", "Qty"],
      data: [["Widget", "12"]],
    }
  );
});

test("splitClipboardMatrix falls back empty header cells to Column N", () => {
  assert.deepEqual(
    splitClipboardMatrix([["", "On"], ["x", "true"]], {
      firstRowIsHeader: true,
    }),
    {
      labels: ["Column 1", "On"],
      data: [["x", "true"]],
    }
  );
});

test("splitClipboardMatrix returns null for empty matrix", () => {
  assert.equal(splitClipboardMatrix([]), null);
  assert.equal(splitClipboardMatrix([[]]), null);
});
