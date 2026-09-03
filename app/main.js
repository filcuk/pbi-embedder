import { initShell } from "./shell/shell.js";
import { setHidden } from "./utils/dom.js";
import { initSegmentedControl } from "./components/segmented-control.js";
import { initToggle } from "./components/toggle.js";
import { initTabularInput, formatClipboardTable } from "./components/tabular-input.js";
import { initCodeBlock } from "./components/code-block.js";
import { initExpandableSurfaces } from "./components/expandable-surface.js";
import { initDialog } from "./components/dialog.js";
import { initAboutDialog } from "./components/about-dialog.js";
import { createIcon } from "./utils/icons.js";
import { copyText } from "./utils/clipboard.js";
import {
  prepareButtonLabelFlash,
  setButtonLabelFlash,
  flashButtonLabel,
} from "./utils/button-label.js";
import {
  showBanner,
  hideBanner,
  setBannerVariation,
} from "./components/banner.js";
import { createSelection } from "./tools/selection.js";
import {
  convert,
  encodeBase64Text,
  encodeJsonText,
  encodeMJsonText,
  parseInput,
  tableToRecords,
} from "./tools/convert.js";
import { renderOutputTable } from "./tools/output-table.js";
import {
  loadPersistedTooling,
  savePersistedTooling,
} from "./tools/persist.js";

initShell({
  headingLinks: false,
  pageNav: false,
});

initAboutDialog({
  dialogEl: document.getElementById("about-dialog"),
  openTriggers: "#about-open-btn",
});

const persisted = loadPersistedTooling();

const selection = createSelection({
  family: "m",
  input: "tabular",
  output: "m-json",
  quoteStyle: "escaped",
  formatting: "format",
  includeParsing: true,
  convertQuotes: true,
  ...(persisted?.selection ?? {}),
});

const headingEl = document.getElementById("conversion-heading");
const leadEl = document.getElementById("conversion-lead");
const optionsSection = document.getElementById("options-section");
const mJsonOptions = document.getElementById("m-json-options");
const gzipToggle = document.getElementById("gzip-toggle");
const outputFormatControl = document.getElementById("output-format-control");
const errorBanner = document.querySelector("[data-convert-error]");
const errorMessageEl = document.getElementById("convert-error-message");
const singleQuoteWarning = document.querySelector("[data-single-quote-warning]");

const inputSurfaces = {
  tabular: document.getElementById("input-tabular"),
  json: document.getElementById("input-json"),
  "m-json": document.getElementById("input-m-json"),
  base64: document.getElementById("input-base64"),
};

const outputSurfaces = {
  tabular: document.getElementById("output-tabular"),
  json: document.getElementById("output-json"),
  "m-json": document.getElementById("output-m-json"),
  base64: document.getElementById("output-base64"),
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

const SAMPLE_TABLE = { columns: SAMPLE_COLUMNS, rows: SAMPLE_ROWS };
const SAMPLE_RECORDS = tableToRecords(SAMPLE_TABLE);

/** @type {ReturnType<typeof initTabularInput> | null} */
let inputTabularApi = null;
/** @type {{ destroy: () => void } | null} */
let outputTabularApi = null;
/** @type {import("./tools/convert.js").TableData | null} */
let lastOutputTable = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let inputJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let inputMJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let inputBase64Api = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let outputJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let outputMJsonApi = null;
/** @type {ReturnType<typeof initCodeBlock> | null} */
let outputBase64Api = null;

/** @type {number | null} */
let convertFrame = null;
/** @type {number | null} */
let persistFrame = null;
/** Skip recursive convert while we programmatically update surfaces. */
let suppressConvert = false;
/** Skip selection/onChange side effects while restoring persisted chrome. */
let isRestoring = false;

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
  if (leadEl) {
    leadEl.textContent = selection.lead();
  }

  const showOptions = selection.showOptions();
  const showMJsonOptions = selection.showMJsonOptions();
  setHidden(optionsSection, !showOptions);
  setHidden(mJsonOptions, !showMJsonOptions);
  setHidden(gzipToggle, !selection.showGzip());
  convertQuotesToggleApi?.setDisabled(!selection.showConvertQuotes());
  if (singleQuoteWarning) {
    if (showMJsonOptions && state.quoteStyle === "single") {
      const converting =
        selection.showConvertQuotes() && state.convertQuotes;
      setBannerVariation(
        singleQuoteWarning,
        converting ? "converting" : "warning"
      );
      showBanner(singleQuoteWarning);
    } else {
      hideBanner(singleQuoteWarning);
    }
  }
  syncOutputAvailability(state.input);
  syncSurfaceVisibility(inputSurfaces, state.input);
  syncSurfaceVisibility(outputSurfaces, state.output);
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
  if (format === "base64") {
    return inputBase64Api?.getSource() ?? "";
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
        inputTabularApi?.reset({ emitEvent: false });
      }
      return;
    }
    const text = typeof value === "string" ? value : "";
    if (format === "json") {
      inputJsonApi?.setSource(text);
    } else if (format === "base64") {
      inputBase64Api?.setSource(text);
    } else {
      inputMJsonApi?.setSource(text);
    }
  } finally {
    suppressConvert = false;
  }
}

/**
 * @param {string | number | boolean | null | undefined} value
 * @param {string} type
 */
function isBlankCell(value, type) {
  if (type === "number") return value === null || value === undefined || value === "";
  // Logical `false` is real content (e.g. unchecked flags); only nullish is blank.
  if (type === "logical") return value === null || value === undefined;
  return String(value ?? "").trim() === "";
}

/**
 * True when the active input has no user content to overwrite.
 * @param {import("./tools/selection.js").Format} format
 */
function isInputBlank(format) {
  if (format === "tabular") {
    const data = inputTabularApi?.getData();
    if (!data?.columns?.length) return true;
    return data.rows.every((row) =>
      data.columns.every((column) =>
        isBlankCell(row.cells?.[column.id], column.type)
      )
    );
  }
  return String(readInputValue(format) ?? "").trim() === "";
}

/**
 * Load the built-in sample into the current input format.
 */
async function loadSampleIntoInput() {
  const state = selection.get();
  if (state.input === "tabular") {
    writeInputValue("tabular", SAMPLE_TABLE);
  } else if (state.input === "json") {
    writeInputValue("json", encodeJsonText(SAMPLE_RECORDS));
  } else if (state.input === "base64") {
    writeInputValue(
      "base64",
      await encodeBase64Text(SAMPLE_RECORDS, { gzip: state.gzip })
    );
  } else {
    writeInputValue(
      "m-json",
      encodeMJsonText(SAMPLE_RECORDS, {
        quoteStyle: state.quoteStyle,
        formatting: state.formatting,
        includeParsing: state.includeParsing,
        convertQuotes: state.convertQuotes,
      })
    );
  }
  scheduleConvert();
}

/**
 * Best-effort move of the current payload into a newly selected input format.
 * @param {import("./tools/selection.js").Format} previousFormat
 * @param {import("./tools/selection.js").Format} nextFormat
 * @param {Pick<import("./tools/selection.js").ToolSelection, "quoteStyle" | "formatting" | "gzip">} options
 */
async function migrateInputFormat(previousFormat, nextFormat, options) {
  const previousValue = readInputValue(previousFormat);
  try {
    const parsed = await parseInput(previousFormat, previousValue, {
      gzip: options.gzip,
    });
    if (nextFormat === "tabular") {
      writeInputValue("tabular", parsed.table);
      return;
    }
    if (nextFormat === "json") {
      writeInputValue("json", encodeJsonText(parsed.records));
      return;
    }
    if (nextFormat === "base64") {
      writeInputValue(
        "base64",
        await encodeBase64Text(parsed.records, { gzip: options.gzip })
      );
      return;
    }
    writeInputValue(
      "m-json",
      encodeMJsonText(parsed.records, {
        quoteStyle: options.quoteStyle,
        formatting: options.formatting,
        sourceJson:
          options.formatting === "original" && previousFormat === "json"
            ? String(previousValue ?? "").trim()
            : null,
      })
    );
  } catch {
    writeInputValue(nextFormat, nextFormat === "tabular" ? { columns: [], rows: [] } : "");
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
      lastOutputTable = result.table ?? { columns: [], rows: [] };
      outputTabularApi = renderOutputTable(
        outputSurfaces.tabular,
        lastOutputTable,
        outputTabularApi
      );
      syncOutputTabularCopy();
      return;
    }
    const text = result.text ?? "";
    if (outputFormat === "json") {
      outputJsonApi?.setSource(text);
    } else if (outputFormat === "base64") {
      outputBase64Api?.setSource(text);
    } else {
      outputMJsonApi?.setSource(text);
    }
  } finally {
    suppressConvert = false;
  }
}

/**
 * Clear the active output surface (e.g. after a failed convert).
 * @param {import("./tools/selection.js").Format} outputFormat
 */
function clearOutput(outputFormat) {
  suppressConvert = true;
  try {
    if (outputFormat === "tabular") {
      lastOutputTable = { columns: [], rows: [] };
      outputTabularApi = renderOutputTable(
        outputSurfaces.tabular,
        lastOutputTable,
        outputTabularApi
      );
      syncOutputTabularCopy();
      return;
    }
    if (outputFormat === "json") {
      outputJsonApi?.setSource("");
    } else if (outputFormat === "base64") {
      outputBase64Api?.setSource("");
    } else {
      outputMJsonApi?.setSource("");
    }
  } finally {
    suppressConvert = false;
  }
}

function syncOutputTabularCopy() {
  const copyBtn = document.getElementById("output-tabular-copy");
  if (!(copyBtn instanceof HTMLButtonElement)) return;
  copyBtn.disabled = !(lastOutputTable?.columns?.length);
}

async function runConvert() {
  if (suppressConvert) return;

  const state = selection.get();
  const value = readInputValue(state.input);
  const result = await convert({
    inputFormat: state.input,
    outputFormat: state.output,
    value,
    quoteStyle: state.quoteStyle,
    formatting: state.formatting,
    includeParsing: state.includeParsing,
    convertQuotes: state.convertQuotes,
    gzip: state.gzip,
  });

  if (!result.ok) {
    setConvertError(result.error);
    clearOutput(state.output);
    return;
  }

  setConvertError(null);
  writeOutput(state.output, result);
}

function scheduleConvert() {
  if (suppressConvert || isRestoring) return;
  if (convertFrame !== null) {
    cancelAnimationFrame(convertFrame);
  }
  convertFrame = requestAnimationFrame(() => {
    convertFrame = null;
    void runConvert().then(() => {
      schedulePersist();
    });
  });
}

function schedulePersist() {
  if (isRestoring) return;
  if (persistFrame !== null) {
    cancelAnimationFrame(persistFrame);
  }
  persistFrame = requestAnimationFrame(() => {
    persistFrame = null;
    savePersistedTooling({
      selection: selection.get(),
      inputs: {
        tabular: inputTabularApi?.getData() ?? null,
        json: inputJsonApi?.getSource() ?? "",
        "m-json": inputMJsonApi?.getSource() ?? "",
      },
    });
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

const familyApi = initSegmentedControl(
  document.getElementById("family-control"),
  {
    onChange: ({ value, source }) => {
      if (source === "init" || isRestoring) return;
      selection.setFamily(/** @type {"m" | "dax"} */ (value));
      syncChrome();
      scheduleConvert();
    },
  }
);

const outputFormatApi = initSegmentedControl(outputFormatControl, {
  onChange: ({ value, source }) => {
    if (source === "init" || isRestoring) return;
    selection.setOutput(
      /** @type {import("./tools/selection.js").Format} */ (value)
    );
    syncChrome();
    scheduleConvert();
  },
});

const inputFormatApi = initSegmentedControl(
  document.getElementById("input-format-control"),
  {
    onChange: ({ value, source }) => {
      if (source === "init" || isRestoring) return;
      void (async () => {
        const previous = selection.get();
        const state = selection.setInput(
          /** @type {import("./tools/selection.js").Format} */ (value)
        );
        await migrateInputFormat(previous.input, state.input, {
          quoteStyle: state.quoteStyle,
          formatting: state.formatting,
          gzip: state.gzip,
        });
        // Enable the new default output option before selecting it — otherwise
        // selectValue no-ops while that segment is still disabled from the prior input.
        syncOutputAvailability(state.input);
        outputFormatApi?.selectValue(state.output, { emit: false });
        syncChrome();
        scheduleConvert();
      })();
    },
  }
);

const quoteStyleApi = initSegmentedControl(
  document.getElementById("quote-style-control"),
  {
    onChange: ({ value, source }) => {
      if (source === "init" || isRestoring) return;
      selection.setQuoteStyle(/** @type {"single" | "escaped"} */ (value));
      syncChrome();
      scheduleConvert();
    },
  }
);

const formattingApi = initSegmentedControl(
  document.getElementById("formatting-control"),
  {
    onChange: ({ value, source }) => {
      if (source === "init" || isRestoring) return;
      selection.setFormatting(
        /** @type {import("./tools/selection.js").Formatting} */ (value)
      );
      scheduleConvert();
    },
  }
);

const includeParsingToggleApi = initToggle(
  document.getElementById("include-parsing-toggle"),
  {
    onChange: ({ checked, source }) => {
      if (source === "init" || isRestoring) return;
      selection.setIncludeParsing(checked);
      syncChrome();
      scheduleConvert();
    },
  }
);

const convertQuotesToggleApi = initToggle(
  document.getElementById("convert-quotes-toggle"),
  {
    onChange: ({ checked, source }) => {
      if (source === "init" || isRestoring) return;
      selection.setConvertQuotes(checked);
      syncChrome();
      scheduleConvert();
    },
  }
);

const gzipToggleApi = initToggle(gzipToggle, {
  onChange: ({ checked, source }) => {
    if (source === "init" || isRestoring) return;
    selection.setGzip(checked);
    scheduleConvert();
  },
});

inputTabularApi = initTabularInput(inputSurfaces.tabular, {
  onChange: () => {
    scheduleConvert();
  },
});
inputTabularApi?.reset({ emitEvent: false });

const loadSampleDialog = initDialog({
  dialogEl: document.getElementById("load-sample-dialog"),
});

document.getElementById("load-sample-btn")?.addEventListener("click", () => {
  const format = selection.get().input;
  if (isInputBlank(format)) {
    void loadSampleIntoInput();
    return;
  }
  loadSampleDialog?.openDialog();
});

document.getElementById("load-sample-confirm")?.addEventListener("click", () => {
  loadSampleDialog?.closeDialog();
  void loadSampleIntoInput();
});

const outputTabularCopyBtn = document.getElementById("output-tabular-copy");
if (outputTabularCopyBtn instanceof HTMLButtonElement) {
  outputTabularCopyBtn.prepend(
    createIcon("copy", { className: "btn-icon-svg" })
  );

  prepareButtonLabelFlash(outputTabularCopyBtn, {
    idle: "Copy",
    success: "Copied",
    fail: "Failed",
  });

  const resetOutputTabularCopyLabel = () => {
    setButtonLabelFlash(outputTabularCopyBtn, "Copy");
    outputTabularCopyBtn.setAttribute("aria-label", "Copy table");
  };

  outputTabularCopyBtn.addEventListener("click", async () => {
    const table = lastOutputTable;
    if (!table?.columns?.length) return;
    const text = formatClipboardTable(table.columns, table.rows);
    const ok = await copyText(text);
    flashButtonLabel(outputTabularCopyBtn, ok, {
      durationMs: 1500,
      reset: resetOutputTabularCopyLabel,
    });
  });
}

inputJsonApi = initCodeBlock(inputSurfaces.json);
inputMJsonApi = initCodeBlock(inputSurfaces["m-json"]);
inputBase64Api = initCodeBlock(inputSurfaces.base64);
outputJsonApi = initCodeBlock(outputSurfaces.json);
outputMJsonApi = initCodeBlock(outputSurfaces["m-json"]);
outputBase64Api = initCodeBlock(outputSurfaces.base64);

observeCodeSource(inputSurfaces.json);
observeCodeSource(inputSurfaces["m-json"]);
observeCodeSource(inputSurfaces.base64);

initExpandableSurfaces(document);

isRestoring = true;
try {
  const state = selection.get();
  familyApi?.selectValue(state.family, { emit: false });
  inputFormatApi?.selectValue(state.input, { emit: false });
  syncOutputAvailability(state.input);
  outputFormatApi?.selectValue(state.output, { emit: false });
  quoteStyleApi?.selectValue(state.quoteStyle, { emit: false });
  formattingApi?.selectValue(state.formatting, { emit: false });
  includeParsingToggleApi?.setChecked(state.includeParsing);
  convertQuotesToggleApi?.setChecked(state.convertQuotes);
  gzipToggleApi?.setChecked(state.gzip);

  const storedInputs = persisted?.inputs;
  if (storedInputs?.tabular?.columns?.length) {
    writeInputValue("tabular", storedInputs.tabular);
  }
  if (typeof storedInputs?.json === "string") {
    writeInputValue("json", storedInputs.json);
  }
  if (typeof storedInputs?.["m-json"] === "string") {
    writeInputValue("m-json", storedInputs["m-json"]);
  }
} finally {
  isRestoring = false;
}

syncChrome();
scheduleConvert();
