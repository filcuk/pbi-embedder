import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeAlsoSeeSvg } from "../app/utils/also-see-svg.js";

test("sanitizeAlsoSeeSvg wraps path fragments with a default viewBox", () => {
  const out = sanitizeAlsoSeeSvg(
    '<path d="M0 0h24v24H0z" fill="currentColor"/>',
    "dropdown-menu-item-icon"
  );
  assert.match(out, /^<svg\b/i);
  assert.match(out, /viewBox="0 0 24 24"/);
  assert.match(out, /class="dropdown-menu-item-icon"/);
  assert.match(out, /aria-hidden="true"/);
  assert.match(out, /<path d="M0 0h24v24H0z"/);
});

test("sanitizeAlsoSeeSvg strips scripts and event handlers", () => {
  assert.equal(
    sanitizeAlsoSeeSvg(
      '<svg viewBox="0 0 16 16"><script>alert(1)</script><path d="M0 0h16v16H0z"/></svg>'
    ),
    ""
  );
  assert.equal(
    sanitizeAlsoSeeSvg(
      '<svg viewBox="0 0 16 16" onclick="alert(1)"><path d="M0 0h16v16H0z"/></svg>'
    ),
    ""
  );
});

test("sanitizeAlsoSeeSvg keeps a minimal full svg", () => {
  const out = sanitizeAlsoSeeSvg(
    '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1v14"/></svg>',
    "dropdown-menu-item-icon"
  );
  assert.match(out, /viewBox="0 0 16 16"/);
  assert.match(out, /fill="currentColor"/);
  assert.doesNotMatch(out, /\bwidth="/);
  assert.doesNotMatch(out, /\bheight="/);
  assert.match(out, /class="dropdown-menu-item-icon"/);
});
