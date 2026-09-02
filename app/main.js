import { initShell } from "./shell/shell.js";
import { initPageNavPanel } from "./shell/page-nav.js";
import { setHidden } from "./utils/dom.js";
import { initSegmentedControl } from "./components/segmented-control.js";
import { initTabularInput } from "./components/tabular-input.js";
import { initCodeBlock } from "./components/code-block.js";
import { initExpandableSurfaces } from "./components/expandable-surface.js";
import { initIcons } from "./utils/icons.js";
import { showBanner, hideBanner } from "./components/banner.js";
import { createSelection } from "./tools/selection.js";
import {
  convert,
  encodeJsonText,
  encodeMJsonText,
  parseInput,
} from "./tools/convert.js";

initShell();

const selection = createSelection({
  family: "m",
  input: "tabular",
  output: "m-json",
  quoteStyle: "single",
});

const headingEl = document.getElementById("conversion-heading");
const quoteStyleRow = document.getElementById("quote-style-row");
const outputFormatControl = document.getElementById("output-format-control");
const errorBanner = document.querySelector("[data-convert-error]");
const errorMessageEl = document.getElementById("convert-error-message");
const pageNav = initPageNavPanel("#page-nav");

const inputSurfaces = {
  tabular: document.getElementById("input-tabular"),
  json: document.getElementById("input-json"),
  "m-json": document.getElementById("input-m-json"),
};

const outputSurfaces = {
  tabular: document.getElementById("output-tabular"),
  json: document.getElementById("output-json"),
  "m-json": document.getElementById("output-m-json"),
};

const SAMPLE_COLUMNS = [
  { id: "name", label: "Name", type: "text" },
  { id: "qty", label: "Qty", type: "number" },
  { id: "active", label: "Active", type: "logical" },
];

const SAMPLE_ROWS = [
  { id: "r1", cells: { name: "Widget", qty: 12, active: true } },
  { id: "r2", cells: { name: "Gadget", qty: 3, active: false } },
];

const EMPTY_TABLE = { columns: [...SAMPLE_COLUMNS], rows: [] };

/** @type {ReturnType<typeof initTabularInput> | null} */
let inputTabularApi = null;
/** @type {ReturnType<typeof initTabularInput> | null} */
let outputTabularApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let inputJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let inputMJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let outputJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let outputMJsonApi = null;

/** @type {number | null} */
let convertFrame = null;
/** Skip recursive convert while we programmatically update surfaces. */
let suppressConvert = false;

/**
 * Disable the output option that matches the current input format.
 * @param {string} inputFormat
 */
function syncOutputAvailability(inputFormat) {
  if (!outputFormatControl) return;

  const items = [
    ...outputFormatControl.querySelectorAll(
      ".segmented-control-item[role='radio']"
    ),
  ];
  for (const item of items) {
    const value = item.dataset.segmentedControlValue ?? "";
    item.disabled = value === inputFormat;
  }
}

/**
 * Show only the surface that matches the active format for a side.
 * @param {Record<string, HTMLElement | null>} surfaces
 * @param {string} activeFormat
 */
function syncSurfaceVisibility(surfaces, activeFormat) {
  for (const [format, el] of Object.entries(surfaces)) {
    setHidden(el, format !== activeFormat);
  }
}

function syncChrome() {
  const state = selection.get();

  if (headingEl) {
    headingEl.textContent = selection.heading();
  }

  setHidden(quoteStyleRow, !selection.showQuoteStyle());
  syncOutputAvailability(state.input);
  syncSurfaceVisibility(inputSurfaces, state.input);
  syncSurfaceVisibility(outputSurfaces, state.output);
  pageNav?.rebuild?.();
}

/**
 * @param {string | null | undefined} message
 */
function setConvertError(message) {
  if (!errorBanner) return;
  if (!message) {
    hideBanner(errorBanner);
    return;
  }
  if (errorMessageEl) {
    errorMessageEl.textContent = message;
  }
  showBanner(errorBanner);
}

/**
 * Read the active input payload for the current input format.
 * @param {import("./tools/selection.js").Format} format
 */
function readInputValue(format) {
  if (format === "tabular") {
    return inputTabularApi?.getData() ?? { columns: [], rows: [] };
  }
  if (format === "json") {
    return inputJsonApi?.getSource() ?? "";
  }
  return inputMJsonApi?.getSource() ?? "";
}

/**
 * Write a payload into an input surface without retriggering convert mid-write.
 * @param {import("./tools/selection.js").Format} format
 * @param {import("./tools/convert.js").TableData | string} value
 */
function writeInputValue(format, value) {
  suppressConvert = true;
  try {
    if (format === "tabular") {
      const table =
        value && typeof value === "object"
          ? value
          : { columns: [], rows: [] };
      if (table.columns.length || table.rows.length) {
        inputTabularApi?.setData(table, { emitEvent: false });
      } else {
        inputTabularApi?.setData(EMPTY_TABLE, { emitEvent: false });
      }
      return;
    }
    const text = typeof value === "string" ? value : "";
    if (format === "json") {
      inputJsonApi?.setSource(text);
    } else {
      inputMJsonApi?.setSource(text);
    }
  } finally {
    suppressConvert = false;
  }
}

/**
 * Best-effort move of the current payload into a newly selected input format.
 * @param {import("./tools/selection.js").Format} previousFormat
 * @param {import("./tools/selection.js").Format} nextFormat
 * @param {import("./tools/selection.js").QuoteStyle} quoteStyle
 */
function migrateInputFormat(previousFormat, nextFormat, quoteStyle) {
  const previousValue = readInputValue(previousFormat);
  try {
    const parsed = parseInput(previousFormat, previousValue);
    if (nextFormat === "tabular") {
      writeInputValue("tabular", parsed.table);
      return;
    }
    if (nextFormat === "json") {
      writeInputValue("json", encodeJsonText(parsed.records));
      return;
    }
    writeInputValue("m-json", encodeMJsonText(parsed.records, quoteStyle));
  } catch {
    if (nextFormat === "tabular") {
      writeInputValue("tabular", {
        columns: SAMPLE_COLUMNS,
        rows: SAMPLE_ROWS,
      });
    } else {
      writeInputValue(nextFormat, "");
    }
  }
}

/**
 * Apply a successful conversion to the visible output surface.
 * @param {import("./tools/selection.js").Format} outputFormat
 * @param {import("./tools/convert.js").ConvertSuccess} result
 */
function writeOutput(outputFormat, result) {
  suppressConvert = true;
  try {
    if (outputFormat === "tabular") {
      outputTabularApi?.setData(
        result.table.columns.length
          ? result.table
          : EMPTY_TABLE,
        { emitEvent: false }
      );
      return;
    }
    const text = result.text ?? "";
    if (outputFormat === "json") {
      outputJsonApi?.setSource(text);
    } else {
      outputMJsonApi?.setSource(text);
    }
  } finally {
    suppressConvert = false;
  }
}

function runConvert() {
  if (suppressConvert) return;

  const state = selection.get();
  const value = readInputValue(state.input);
  const result = convert({
    inputFormat: state.input,
    outputFormat: state.output,
    value,
    quoteStyle: state.quoteStyle,
  });

  if (!result.ok) {
    setConvertError(result.error);
    return;
  }

  setConvertError(null);
  writeOutput(state.output, result);
}

function scheduleConvert() {
  if (suppressConvert) return;
  if (convertFrame !== null) {
    cancelAnimationFrame(convertFrame);
  }
  convertFrame = requestAnimationFrame(() => {
    convertFrame = null;
    runConvert();
  });
}

/**
 * Watch code-block `data-source` updates (typing, paste, clear).
 * @param {HTMLElement | null} surface
 */
function observeCodeSource(surface) {
  const codeEl = surface?.querySelector("code");
  if (!codeEl) return;
  const observer = new MutationObserver(() => {
    if (suppressConvert) return;
    scheduleConvert();
  });
  observer.observe(codeEl, {
    attributes: true,
    attributeFilter: ["data-source"],
  });
}

initSegmentedControl(document.getElementById("family-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setFamily(/** @type {"m" | "dax"} */ (value));
    syncChrome();
    scheduleConvert();
  },
});

const outputFormatApi = initSegmentedControl(outputFormatControl, {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setOutput(
      /** @type {import("./tools/selection.js").Format} */ (value)
    );
    syncChrome();
    scheduleConvert();
  },
});

initSegmentedControl(document.getElementById("input-format-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    const previous = selection.get();
    const state = selection.setInput(
      /** @type {import("./tools/selection.js").Format} */ (value)
    );
    migrateInputFormat(previous.input, state.input, state.quoteStyle);
    outputFormatApi?.selectValue(state.output, { emit: false });
    syncChrome();
    scheduleConvert();
  },
});

initSegmentedControl(document.getElementById("quote-style-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setQuoteStyle(/** @type {"single" | "escaped"} */ (value));
    scheduleConvert();
  },
});

inputTabularApi = initTabularInput(inputSurfaces.tabular, {
  columns: SAMPLE_COLUMNS,
  rows: SAMPLE_ROWS,
  onChange: () => {
    scheduleConvert();
  },
});

outputTabularApi = initTabularInput(outputSurfaces.tabular, {
  columns: SAMPLE_COLUMNS,
  rows: [],
  disabled: true,
});

inputJsonApi = initCodeBlock(inputSurfaces.json);
inputMJsonApi = initCodeBlock(inputSurfaces["m-json"]);
outputJsonApi = initCodeBlock(outputSurfaces.json);
outputMJsonApi = initCodeBlock(outputSurfaces["m-json"]);

observeCodeSource(inputSurfaces.json);
observeCodeSource(inputSurfaces["m-json"]);

initExpandableSurfaces(document);
initIcons(errorBanner ?? undefined);

syncChrome();
scheduleConvert();
