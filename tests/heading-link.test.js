import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveHeadingLinksEnabled } from "../app/shell/heading-link.js";

describe("resolveHeadingLinksEnabled", () => {
  it("defaults to on", () => {
    assert.equal(resolveHeadingLinksEnabled(), true);
    assert.equal(resolveHeadingLinksEnabled(undefined), true);
  });

  it("respects data-no-heading-links when the option is omitted", () => {
    assert.equal(
      resolveHeadingLinksEnabled(undefined, { noHeadingLinks: true }),
      false
    );
  });

  it("disables when headingLinks is false", () => {
    assert.equal(resolveHeadingLinksEnabled(false), false);
    assert.equal(
      resolveHeadingLinksEnabled(false, { noHeadingLinks: false }),
      false
    );
  });

  it("enables when headingLinks is true even if the HTML opt-out is set", () => {
    assert.equal(
      resolveHeadingLinksEnabled(true, { noHeadingLinks: true }),
      true
    );
  });

  it("passes through { enabled: false }", () => {
    assert.equal(resolveHeadingLinksEnabled({ enabled: false }), false);
  });

  it("passes through { enabled: true } over the HTML opt-out", () => {
    assert.equal(
      resolveHeadingLinksEnabled({ enabled: true }, { noHeadingLinks: true }),
      true
    );
  });

  it("keeps selector-only objects subject to the HTML opt-out", () => {
    assert.equal(
      resolveHeadingLinksEnabled({ selector: "main h3[id]" }),
      true
    );
    assert.equal(
      resolveHeadingLinksEnabled(
        { selector: "main h3[id]" },
        { noHeadingLinks: true }
      ),
      false
    );
  });
});
