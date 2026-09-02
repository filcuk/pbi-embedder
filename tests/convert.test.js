import test from "node:test";
import assert from "node:assert/strict";
import {
  convert,
  encodeJsonText,
  encodeMJsonText,
  parseJsonText,
  parseMJsonText,
  recordsToTable,
  tableToRecords,
  unescapeMTextBody,
  unwrapQuotedPayload,
} from "../app/tools/convert.js";

const SAMPLE_RECORDS = [
  { Name: "Widget", Qty: 12, Active: true },
  { Name: "Gadget", Qty: 3, Active: false },
];

test("tableToRecords uses column labels as keys", () => {
  const table = {
    columns: [
      { id: "name", label: "Name", type: "text" },
      { id: "qty", label: "Qty", type: "number" },
    ],
    rows: [{ id: "r1", cells: { name: "Widget", qty: 12 } }],
  };
  assert.deepEqual(tableToRecords(table), [{ Name: "Widget", Qty: 12 }]);
});

test("recordsToTable infers column types", () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  assert.equal(table.columns.length, 3);
  assert.equal(table.columns[0].label, "Name");
  assert.equal(table.columns[0].type, "text");
  assert.equal(table.columns[1].label, "Qty");
  assert.equal(table.columns[1].type, "number");
  assert.equal(table.columns[2].label, "Active");
  assert.equal(table.columns[2].type, "logical");
  assert.equal(table.rows.length, 2);
  assert.equal(table.rows[0].cells[table.columns[0].id], "Widget");
  assert.equal(table.rows[0].cells[table.columns[1].id], 12);
  assert.equal(table.rows[0].cells[table.columns[2].id], true);
});

test("recordsToTable accepts a single object", () => {
  const table = recordsToTable({ Name: "Solo" });
  assert.equal(table.rows.length, 1);
  assert.equal(tableToRecords(table)[0].Name, "Solo");
});

test("normalize rejects non-record JSON shapes via parseJsonText", () => {
  assert.throws(() => parseJsonText("[1, 2, 3]"), /array of objects/);
  assert.throws(() => parseJsonText('"hello"'), /object or an array/);
  assert.throws(() => parseJsonText(""), /empty/);
  assert.throws(() => parseJsonText("{"), /Invalid JSON/);
});

test("encodeMJsonText pretty escaped-quote form (default)", () => {
  const encoded = encodeMJsonText([{ Name: "Alice", Age: 30 }]);
  assert.equal(
    encoded,
    `"
[
  {
    ""Name"": ""Alice"",
    ""Age"": 30
  }
]
"`
  );
});

test("encodeMJsonText pretty single-quote form", () => {
  const encoded = encodeMJsonText([{ Name: "Alice", Age: 30 }], {
    quoteStyle: "single",
  });
  assert.equal(
    encoded,
    `"
[
  {
    'Name': 'Alice',
    'Age': 30
  }
]
"`
  );
});

test("encodeMJsonText compact single-quote form", () => {
  const encoded = encodeMJsonText([{ Name: "Alice", Age: 30 }], {
    quoteStyle: "single",
    compact: true,
  });
  assert.equal(encoded, `"[{'Name':'Alice','Age':30}]"`);
});

test("encodeMJsonText pretty escaped-quote form explicit", () => {
  const encoded = encodeMJsonText([{ Name: "Alice", Age: 30 }], {
    quoteStyle: "escaped",
  });
  assert.equal(
    encoded,
    `"
[
  {
    ""Name"": ""Alice"",
    ""Age"": 30
  }
]
"`
  );
});

test("encodeMJsonText compact escaped-quote form", () => {
  const encoded = encodeMJsonText([{ Name: "Alice", Age: 30 }], {
    quoteStyle: "escaped",
    compact: true,
  });
  assert.equal(encoded, `"[{""Name"":""Alice"",""Age"":30}]"`);
});

test("parseMJsonText accepts single-quote and escaped forms", () => {
  assert.deepEqual(parseMJsonText(`"[{'Name':'Alice','Age':30}]"`), [
    { Name: "Alice", Age: 30 },
  ]);
  assert.deepEqual(parseMJsonText(`"[{""Name"":""Alice"",""Age"":30}]"`), [
    { Name: "Alice", Age: 30 },
  ]);
  assert.deepEqual(parseMJsonText(`[{"Name":"Alice","Age":30}]`), [
    { Name: "Alice", Age: 30 },
  ]);
});

test("encodeMJsonText include parsing wraps let query", () => {
  const encoded = encodeMJsonText([{ Name: "Alice" }], {
    quoteStyle: "single",
    compact: true,
    includeParsing: true,
  });
  assert.equal(
    encoded,
    [
      "let",
      `    JSON = "[{'Name':'Alice'}]",`,
      `    Source = Table.FromRecords(Json.Document(Text.Replace(JSON, "'", """")))`,
      "in",
      "    Source",
    ].join("\n")
  );
});

test("encodeMJsonText include parsing can skip quote conversion", () => {
  const encoded = encodeMJsonText([{ Name: "Alice" }], {
    quoteStyle: "single",
    compact: true,
    includeParsing: true,
    convertQuotes: false,
  });
  assert.equal(
    encoded,
    [
      "let",
      `    JSON = "[{'Name':'Alice'}]",`,
      "    Source = Table.FromRecords(Json.Document(JSON))",
      "in",
      "    Source",
    ].join("\n")
  );
});

test("parseMJsonText accepts pretty wrapped forms", () => {
  const prettySingle = encodeMJsonText([{ Name: "Alice" }], {
    quoteStyle: "single",
  });
  const prettyEscaped = encodeMJsonText([{ Name: "Alice" }], {
    quoteStyle: "escaped",
  });
  assert.deepEqual(parseMJsonText(prettySingle), [{ Name: "Alice" }]);
  assert.deepEqual(parseMJsonText(prettyEscaped), [{ Name: "Alice" }]);
});

test("parseMJsonText accepts include-parsing let query", () => {
  const query = encodeMJsonText([{ Name: "Alice", Age: 30 }], {
    quoteStyle: "escaped",
    includeParsing: true,
  });
  assert.deepEqual(parseMJsonText(query), [{ Name: "Alice", Age: 30 }]);
});

test("unwrapQuotedPayload and unescapeMTextBody", () => {
  assert.equal(unwrapQuotedPayload(`"[{""A"":1}]"`), `[{"A":1}]`);
  assert.equal(unescapeMTextBody(`[{""A"":1}]`), `[{"A":1}]`);
  assert.equal(unwrapQuotedPayload(`[{"A":1}]`), `[{"A":1}]`);
});

test("convert tabular → m-json (pretty escaped by default)", () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  const result = convert({
    inputFormat: "tabular",
    outputFormat: "m-json",
    value: table,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.text, encodeMJsonText(SAMPLE_RECORDS));
  assert.ok(result.text?.startsWith(`"\n`));
  assert.ok(result.text?.endsWith(`\n"`));
});

test("convert tabular → m-json compact", () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  const result = convert({
    inputFormat: "tabular",
    outputFormat: "m-json",
    value: table,
    quoteStyle: "single",
    compact: true,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.text,
    encodeMJsonText(SAMPLE_RECORDS, { quoteStyle: "single", compact: true })
  );
});

test("convert m-json → tabular", () => {
  const text = encodeMJsonText(SAMPLE_RECORDS, {
    quoteStyle: "escaped",
    compact: true,
  });
  const result = convert({
    inputFormat: "m-json",
    outputFormat: "tabular",
    value: text,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(tableToRecords(result.table), SAMPLE_RECORDS);
});

test("convert json → tabular and tabular → json", () => {
  const json = encodeJsonText(SAMPLE_RECORDS);
  const toTable = convert({
    inputFormat: "json",
    outputFormat: "tabular",
    value: json,
  });
  assert.equal(toTable.ok, true);
  if (!toTable.ok) return;

  const back = convert({
    inputFormat: "tabular",
    outputFormat: "json",
    value: toTable.table,
  });
  assert.equal(back.ok, true);
  if (!back.ok) return;
  assert.deepEqual(JSON.parse(back.text ?? "null"), SAMPLE_RECORDS);
});

test("convert m-json → json", () => {
  const result = convert({
    inputFormat: "m-json",
    outputFormat: "json",
    value: `"[{'Name':'Alice'}]"`,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(JSON.parse(result.text ?? "null"), [{ Name: "Alice" }]);
});

test("convert fails on invalid input without throwing", () => {
  const result = convert({
    inputFormat: "json",
    outputFormat: "tabular",
    value: "not-json",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /Invalid JSON/);
});

test("nested objects become JSON text cells", () => {
  const table = recordsToTable([{ Name: "A", Meta: { color: "red" } }]);
  assert.equal(table.columns[1].type, "text");
  assert.equal(table.rows[0].cells[table.columns[1].id], '{"color":"red"}');
});
