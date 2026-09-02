import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeSvgMarkup } from "../app/utils/sanitize-svg.js";

test("sanitizeSvgMarkup keeps a minimal full svg", () => {
  const out = sanitizeSvgMarkup(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><path d="M0 0h8v8H0z"/></svg>'
  );
  assert.match(out, /^<svg\b/i);
  assert.match(out, /viewBox="0 0 8 8"/);
  assert.match(out, /<path d="M0 0h8v8H0z"/);
});

test("sanitizeSvgMarkup strips scripts and event handlers", () => {
  assert.equal(
    sanitizeSvgMarkup(
      '<svg viewBox="0 0 8 8"><script>alert(1)</script><path d="M0 0h8v8H0z"/></svg>'
    ),
    ""
  );
  assert.equal(
    sanitizeSvgMarkup(
      '<svg viewBox="0 0 8 8" onclick="alert(1)"><path d="M0 0h8v8H0z"/></svg>'
    ),
    ""
  );
});

test("sanitizeSvgMarkup keeps SMIL animate elements", () => {
  const out = sanitizeSvgMarkup(`<svg viewBox="0 0 8 8">
  <rect width="8" height="8" fill="red">
    <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
  </rect>
</svg>`);
  assert.match(out, /<animate\b/i);
  assert.match(out, /attributeName="opacity"/);
});

test("sanitizeSvgMarkup accepts svg files with an XML declaration", () => {
  const out = sanitizeSvgMarkup(`<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><rect width="8" height="8"/></svg>`);
  assert.match(out, /^<svg\b/i);
  assert.match(out, /<rect\b/i);
});

test("sanitizeSvgMarkup rejects non-svg roots and empty input", () => {
  assert.equal(sanitizeSvgMarkup('<path d="M0 0h8v8H0z"/>'), "");
  assert.equal(sanitizeSvgMarkup(""), "");
  assert.equal(sanitizeSvgMarkup(null), "");
});

test("sanitizeSvgMarkup strips javascript hrefs", () => {
  const out = sanitizeSvgMarkup(
    '<svg viewBox="0 0 8 8"><a href="javascript:alert(1)"><path d="M0 0h8v8H0z"/></a></svg>'
  );
  /* Fallback strips <a>; DOMParser path removes the element as disallowed. */
  assert.doesNotMatch(out, /javascript:/i);
  if (out) {
    assert.match(out, /^<svg\b/i);
  }
});
