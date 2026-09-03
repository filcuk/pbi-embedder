import test from "node:test";
import assert from "node:assert/strict";
import {
  convert,
  encodeBase64Text,
  encodeJsonText,
  encodeMJsonText,
  parseBase64Text,
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

test("normalize rejects non-record JSON shapes via parseJsonText", async () => {
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
    formatting: "compact",
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
    formatting: "compact",
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
    formatting: "compact",
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
    formatting: "compact",
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

test("convert tabular → m-json (pretty escaped by default)", async () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  const result = await convert({
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

test("convert tabular → m-json compact", async () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  const result = await convert({
    inputFormat: "tabular",
    outputFormat: "m-json",
    value: table,
    quoteStyle: "single",
    formatting: "compact",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.text,
    encodeMJsonText(SAMPLE_RECORDS, {
      quoteStyle: "single",
      formatting: "compact",
    })
  );
});

test("convert json → m-json original preserves input spacing", async () => {
  const source = '[\n  {"Name":"Alice"}\n]';
  const result = await convert({
    inputFormat: "json",
    outputFormat: "m-json",
    value: source,
    formatting: "original",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    result.text,
    encodeMJsonText([{ Name: "Alice" }], {
      formatting: "original",
      sourceJson: source,
    })
  );
  assert.equal(
    result.text,
    `"
[
  {""Name"":""Alice""}
]
"`
  );
});

test("convert tabular → m-json original falls back to format", async () => {
  const table = recordsToTable([{ Name: "Alice" }]);
  const result = await convert({
    inputFormat: "tabular",
    outputFormat: "m-json",
    value: table,
    formatting: "original",
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.text, encodeMJsonText([{ Name: "Alice" }]));
});

test("convert m-json → tabular", async () => {
  const text = encodeMJsonText(SAMPLE_RECORDS, {
    quoteStyle: "escaped",
    formatting: "compact",
  });
  const result = await convert({
    inputFormat: "m-json",
    outputFormat: "tabular",
    value: text,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(tableToRecords(result.table), SAMPLE_RECORDS);
});

test("convert json → tabular and tabular → json", async () => {
  const json = encodeJsonText(SAMPLE_RECORDS);
  const toTable = await convert({
    inputFormat: "json",
    outputFormat: "tabular",
    value: json,
  });
  assert.equal(toTable.ok, true);
  if (!toTable.ok) return;

  const back = await convert({
    inputFormat: "tabular",
    outputFormat: "json",
    value: toTable.table,
  });
  assert.equal(back.ok, true);
  if (!back.ok) return;
  assert.deepEqual(JSON.parse(back.text ?? "null"), SAMPLE_RECORDS);
});

test("convert m-json → json", async () => {
  const result = await convert({
    inputFormat: "m-json",
    outputFormat: "json",
    value: `"[{'Name':'Alice'}]"`,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(JSON.parse(result.text ?? "null"), [{ Name: "Alice" }]);
});

test("convert fails on invalid input without throwing", async () => {
  const result = await convert({
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

test("convert rejects same input and output format", async () => {
  const result = await convert({
    inputFormat: "json",
    outputFormat: "json",
    value: "[]",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /must be different/);
});

test("tableToRecords returns empty for null table", () => {
  assert.deepEqual(tableToRecords(null), []);
  assert.deepEqual(tableToRecords(undefined), []);
});

test("recordsToTable returns empty snapshot for empty array", () => {
  assert.deepEqual(recordsToTable([]), { columns: [], rows: [] });
});

test("tableToRecords fills missing cells with null", () => {
  const table = {
    columns: [{ id: "a", label: "A", type: "text" }],
    rows: [{ id: "r1", cells: {} }],
  };
  assert.deepEqual(tableToRecords(table), [{ A: null }]);
});

test("recordsToTable unions keys across sparse records", () => {
  const table = recordsToTable([{ a: 1 }, { b: 2 }]);
  assert.deepEqual(
    table.columns.map((column) => column.label),
    ["a", "b"]
  );
  const records = tableToRecords(table);
  assert.equal(records[0].a, 1);
  assert.equal(records[0].b, null);
  assert.equal(records[1].a, null);
  assert.equal(records[1].b, 2);
});

test("tableToRecords throws on duplicate column labels", () => {
  const table = {
    columns: [
      { id: "c1", label: "A", type: "text" },
      { id: "c2", label: "A", type: "text" },
    ],
    rows: [{ id: "r1", cells: { c1: "x", c2: "y" } }],
  };
  assert.throws(() => tableToRecords(table), /Duplicate column label: "A"/);
});

test("convert surfaces duplicate column labels without throwing", async () => {
  const result = await convert({
    inputFormat: "tabular",
    outputFormat: "json",
    value: {
      columns: [
        { id: "c1", label: "A", type: "text" },
        { id: "c2", label: "A", type: "text" },
      ],
      rows: [{ id: "r1", cells: { c1: "x", c2: "y" } }],
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /Duplicate column label/);
});

test("encodeMJsonText rejects apostrophes in single-quote mode", () => {
  assert.throws(
    () =>
      encodeMJsonText([{ Name: "O'Brien" }], {
        quoteStyle: "single",
        formatting: "compact",
      }),
    /apostrophe/
  );
});

test("convert surfaces single-quote apostrophe failure", async () => {
  const result = await convert({
    inputFormat: "json",
    outputFormat: "m-json",
    value: JSON.stringify([{ Name: "O'Brien" }]),
    quoteStyle: "single",
    formatting: "compact",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /apostrophe/);
});

test("parseMJsonText rejects empty and invalid input", () => {
  assert.throws(() => parseMJsonText("  "), /empty/);
  assert.throws(() => parseMJsonText('"not{json"'), /Invalid M-JSON/);
});

test("encodeJsonText compact omits trailing newline", () => {
  assert.equal(encodeJsonText([{ A: 1 }], { pretty: false }), '[{"A":1}]');
});

test("encodeMJsonText escaped includeParsing has no Text.Replace", () => {
  const encoded = encodeMJsonText([{ A: 1 }], {
    quoteStyle: "escaped",
    formatting: "compact",
    includeParsing: true,
  });
  assert.match(encoded, /Json\.Document\(JSON\)/);
  assert.doesNotMatch(encoded, /Text\.Replace/);
});
test("encodeBase64Text / parseBase64Text round-trip with gzip", async () => {
  const encoded = await encodeBase64Text(SAMPLE_RECORDS, { gzip: true });
  assert.match(encoded, /^[A-Za-z0-9+/]+=*$/);
  const decoded = await parseBase64Text(encoded, { gzip: true });
  assert.deepEqual(decoded, SAMPLE_RECORDS);
});

test("encodeBase64Text / parseBase64Text round-trip without gzip", async () => {
  const encoded = await encodeBase64Text(SAMPLE_RECORDS, { gzip: false });
  const json = Buffer.from(encoded, "base64").toString("utf8");
  assert.deepEqual(JSON.parse(json), SAMPLE_RECORDS);
  const decoded = await parseBase64Text(encoded, { gzip: false });
  assert.deepEqual(decoded, SAMPLE_RECORDS);
});

test("parseBase64Text strips whitespace", async () => {
  const encoded = await encodeBase64Text([{ A: 1 }], { gzip: false });
  const wrapped = `${encoded.slice(0, 8)}\n ${encoded.slice(8)}`;
  assert.deepEqual(await parseBase64Text(wrapped, { gzip: false }), [{ A: 1 }]);
});

test("convert tabular → base64 → tabular with gzip", async () => {
  const table = recordsToTable(SAMPLE_RECORDS);
  const encoded = await convert({
    inputFormat: "tabular",
    outputFormat: "base64",
    value: table,
    gzip: true,
  });
  assert.equal(encoded.ok, true);
  if (!encoded.ok) return;

  const decoded = await convert({
    inputFormat: "base64",
    outputFormat: "tabular",
    value: encoded.text,
    gzip: true,
  });
  assert.equal(decoded.ok, true);
  if (!decoded.ok) return;
  assert.deepEqual(tableToRecords(decoded.table), SAMPLE_RECORDS);
});

test("convert json → base64 without gzip", async () => {
  const result = await convert({
    inputFormat: "json",
    outputFormat: "base64",
    value: encodeJsonText(SAMPLE_RECORDS),
    gzip: false,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    await parseBase64Text(result.text ?? "", { gzip: false }),
    SAMPLE_RECORDS
  );
});

test("convert fails on invalid base64 without throwing", async () => {
  const result = await convert({
    inputFormat: "base64",
    outputFormat: "json",
    value: "@@@not-base64@@@",
    gzip: false,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /Invalid Base64/);
});

test("convert fails when gzip expected but payload is plain base64 json", async () => {
  const plain = await encodeBase64Text([{ A: 1 }], { gzip: false });
  const result = await convert({
    inputFormat: "base64",
    outputFormat: "json",
    value: plain,
    gzip: true,
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.error, /Invalid GZip/);
});

test("parseBase64Text rejects empty input", async () => {
  await assert.rejects(() => parseBase64Text("   ", { gzip: false }), /empty/);
});
