import test from "node:test";
import assert from "node:assert/strict";

import {
  EMPTY_DIAGRAM_SOURCE_MESSAGE,
  MERMAID_VERSION,
  resolveDiagramAriaLabel,
  resolveDiagramSource,
} from "../app/components/diagram.js";

/**
 * Duck-typed host for pure resolver tests (no DOM required).
 * @param {{ ariaLabel?: string | null, sourceText?: string | null }} [options]
 */
function stubDiagramEl({ ariaLabel = null, sourceText = null } = {}) {
  return {
    getAttribute(name) {
      return name === "aria-label" ? ariaLabel : null;
    },
    querySelector(selector) {
      if (selector !== ".diagram-source" || sourceText === null) return null;
      return { textContent: sourceText };
    },
  };
}

test("MERMAID_VERSION is pinned", () => {
  assert.equal(MERMAID_VERSION, "11.16.1");
  assert.equal(EMPTY_DIAGRAM_SOURCE_MESSAGE, "Diagram source is empty");
});

test("resolveDiagramSource prefers options.source over markup", () => {
  const el = /** @type {HTMLElement} */ (
    stubDiagramEl({ sourceText: "flowchart TD\n  A-->B" })
  );
  assert.equal(
    resolveDiagramSource(el, "sequenceDiagram\n  A->>B: Hi"),
    "sequenceDiagram\n  A->>B: Hi"
  );
});

test("resolveDiagramSource falls back to .diagram-source text", () => {
  const el = /** @type {HTMLElement} */ (
    stubDiagramEl({ sourceText: "  flowchart TD\n  A-->B  " })
  );
  assert.equal(resolveDiagramSource(el, undefined), "flowchart TD\n  A-->B");
  assert.equal(resolveDiagramSource(el, "   "), "flowchart TD\n  A-->B");
});

test("resolveDiagramSource returns empty when nothing resolvable", () => {
  const el = /** @type {HTMLElement} */ (stubDiagramEl());
  assert.equal(resolveDiagramSource(el, ""), "");
  assert.equal(resolveDiagramSource(el, null), "");
  assert.equal(resolveDiagramSource(el, undefined), "");
});

test("resolveDiagramAriaLabel prefers option, then attribute, then default", () => {
  const withAttr = /** @type {HTMLElement} */ (
    stubDiagramEl({ ariaLabel: "From attr" })
  );
  assert.equal(resolveDiagramAriaLabel(withAttr, "  Option  "), "Option");
  assert.equal(resolveDiagramAriaLabel(withAttr, undefined), "From attr");
  assert.equal(
    resolveDiagramAriaLabel(/** @type {HTMLElement} */ (stubDiagramEl()), ""),
    "Diagram"
  );
});
