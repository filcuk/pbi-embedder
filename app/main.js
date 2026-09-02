import { initShell } from "./shell/shell.js";
import { initPageNavPanel } from "./shell/page-nav.js";
import { setHidden } from "./utils/dom.js";
import { initSegmentedControl } from "./components/segmented-control.js";
import { initTabularInput } from "./components/tabular-input.js";
import { initCodeBlock } from "./components/code-block.js";
import { initExpandableSurfaces } from "./components/expandable-surface.js";
import { initIcons } from "./utils/icons.js";
import { createSelection } from "./tools/selection.js";

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

initSegmentedControl(document.getElementById("family-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setFamily(/** @type {"m" | "dax"} */ (value));
    syncChrome();
  },
});

const outputFormatApi = initSegmentedControl(outputFormatControl, {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setOutput(
      /** @type {import("./tools/selection.js").Format} */ (value)
    );
    syncChrome();
  },
});

initSegmentedControl(document.getElementById("input-format-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    const state = selection.setInput(
      /** @type {import("./tools/selection.js").Format} */ (value)
    );
    outputFormatApi?.selectValue(state.output, { emit: false });
    syncChrome();
  },
});

initSegmentedControl(document.getElementById("quote-style-control"), {
  onChange: ({ value, source }) => {
    if (source === "init") return;
    selection.setQuoteStyle(/** @type {"single" | "escaped"} */ (value));
    // Conversion refresh lands in the next step.
  },
});

initTabularInput(inputSurfaces.tabular, {
  columns: SAMPLE_COLUMNS,
  rows: SAMPLE_ROWS,
});

initTabularInput(outputSurfaces.tabular, {
  columns: SAMPLE_COLUMNS,
  rows: [],
  disabled: true,
});

initCodeBlock(inputSurfaces.json);
initCodeBlock(inputSurfaces["m-json"]);
initCodeBlock(outputSurfaces.json);
initCodeBlock(outputSurfaces["m-json"]);

initExpandableSurfaces(document);
initIcons(document.querySelector("[data-convert-error]") ?? undefined);

syncChrome();
