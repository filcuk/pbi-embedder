import test from "node:test";
import assert from "node:assert/strict";
import {
  createSelection,
  defaultOutputForInput,
  formatConversionHeading,
  formatConversionLead,
  isFormat,
} from "../app/tools/selection.js";

test("isFormat accepts known formats only", () => {
  assert.equal(isFormat("tabular"), true);
  assert.equal(isFormat("json"), true);
  assert.equal(isFormat("m-json"), true);
  assert.equal(isFormat("base64"), true);
  assert.equal(isFormat("dax"), false);
  assert.equal(isFormat(""), false);
});

test("defaultOutputForInput maps m-json to tabular and others to m-json", () => {
  assert.equal(defaultOutputForInput("m-json"), "tabular");
  assert.equal(defaultOutputForInput("tabular"), "m-json");
  assert.equal(defaultOutputForInput("json"), "m-json");
  assert.equal(defaultOutputForInput("base64"), "m-json");
});

test("createSelection defaults", () => {
  const selection = createSelection();
  assert.deepEqual(selection.get(), {
    family: "m",
    input: "tabular",
    output: "m-json",
    quoteStyle: "escaped",
    formatting: "format",
    includeParsing: false,
    convertQuotes: true,
    gzip: true,
  });
  assert.equal(selection.heading(), "M: Tabular → M-JSON");
  assert.equal(
    selection.lead(),
    "Convert tabular data to M-encoded JSON for Power Query."
  );
  assert.equal(selection.showOptions(), true);
  assert.equal(selection.showMJsonOptions(), true);
  assert.equal(selection.showGzip(), false);
  assert.equal(selection.showConvertQuotes(), false);
});

test("createSelection migrates legacy compact boolean", () => {
  assert.equal(createSelection({ compact: true }).get().formatting, "compact");
  assert.equal(createSelection({ compact: false }).get().formatting, "format");
  assert.equal(
    createSelection({ compact: true, formatting: "original" }).get().formatting,
    "original"
  );
});

test("createSelection defaults gzip to true when unset", () => {
  assert.equal(createSelection({}).get().gzip, true);
  assert.equal(createSelection({ gzip: false }).get().gzip, false);
  assert.equal(createSelection({ gzip: true }).get().gzip, true);
});

test("createSelection ignores initial family dax while DAX UI is stubbed", () => {
  const selection = createSelection({ family: "dax", input: "json" });
  assert.equal(selection.get().family, "m");
  assert.equal(selection.get().input, "json");
  assert.equal(selection.get().output, "m-json");
});

test("createSelection rewrites same input and output", () => {
  const selection = createSelection({ input: "json", output: "json" });
  assert.equal(selection.get().output, "m-json");
});

test("setInput resets output via defaultOutputForInput", () => {
  const selection = createSelection();
  selection.setInput("m-json");
  assert.equal(selection.get().input, "m-json");
  assert.equal(selection.get().output, "tabular");
  assert.equal(selection.showOptions(), false);
  assert.equal(selection.showMJsonOptions(), false);
  assert.equal(selection.showGzip(), false);
});

test("setOutput ignores same-as-input and unknown formats", () => {
  const selection = createSelection({ input: "tabular", output: "json" });
  selection.setOutput("tabular");
  assert.equal(selection.get().output, "json");
  selection.setOutput(/** @type {any} */ ("nope"));
  assert.equal(selection.get().output, "json");
  selection.setOutput("m-json");
  assert.equal(selection.get().output, "m-json");
});

test("showOptions and showGzip for base64 input or output", () => {
  const selection = createSelection({ input: "tabular", output: "json" });
  assert.equal(selection.showOptions(), false);
  assert.equal(selection.showGzip(), false);
  assert.equal(selection.showMJsonOptions(), false);

  selection.setOutput("base64");
  assert.equal(selection.showOptions(), true);
  assert.equal(selection.showGzip(), true);
  assert.equal(selection.showMJsonOptions(), false);

  selection.setInput("base64");
  assert.equal(selection.get().output, "m-json");
  assert.equal(selection.showOptions(), true);
  assert.equal(selection.showGzip(), true);
  assert.equal(selection.showMJsonOptions(), true);
});

test("setGzip updates selection", () => {
  const selection = createSelection();
  assert.equal(selection.get().gzip, true);
  selection.setGzip(false);
  assert.equal(selection.get().gzip, false);
  selection.setGzip(true);
  assert.equal(selection.get().gzip, true);
});

test("showConvertQuotes requires single quotes and include parsing", () => {
  const selection = createSelection();
  selection.setQuoteStyle("single");
  assert.equal(selection.showConvertQuotes(), false);
  selection.setIncludeParsing(true);
  assert.equal(selection.showConvertQuotes(), true);
  selection.setQuoteStyle("escaped");
  assert.equal(selection.showConvertQuotes(), false);
});

test("setFamily can still select dax after create (for when UI enables it)", () => {
  const selection = createSelection({ family: "dax" });
  assert.equal(selection.get().family, "m");
  selection.setFamily("dax");
  assert.equal(selection.get().family, "dax");
  assert.equal(
    formatConversionHeading(selection.get()),
    "DAX: Tabular → M-JSON"
  );
});

test("formatConversionLead covers each format pair wording", () => {
  assert.equal(
    formatConversionLead({ input: "json", output: "tabular" }),
    "Convert JSON records to a table."
  );
  assert.equal(
    formatConversionLead({ input: "m-json", output: "json" }),
    "Convert M-encoded JSON to plain JSON."
  );
  assert.equal(
    formatConversionLead({ input: "base64", output: "tabular" }),
    "Convert Base64-encoded JSON to a table."
  );
  assert.equal(
    formatConversionLead({ input: "json", output: "base64" }),
    "Convert JSON records to Base64-encoded JSON."
  );
});
