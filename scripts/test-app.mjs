/**
 * Fork test runner for pbi-embedder.
 *
 * The trimmed component set does not ship the full SMA1 catalogue, so
 * framework-maintainer tests that assume every partial/component exist are
 * excluded. CI uses this script instead of the default tests/** glob.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Tests that pass against the locked component fork. */
const FORK_TESTS = [
  "tests/also-see-svg.test.js",
  "tests/also-see.test.js",
  "tests/brand-icon.test.js",
  "tests/button-label.test.js",
  "tests/convert.test.js",
  "tests/document-listeners.test.js",
  "tests/dom.test.js",
  "tests/framework-sync.test.js",
  "tests/heading-link.test.js",
  "tests/icons.test.js",
  "tests/menu-grid.test.js",
  "tests/persist.test.js",
  "tests/selection.test.js",
  "tests/styles-entry.test.js",
  "tests/table-sort.test.js",
  "tests/tabular-input.test.js",
  "tests/title-numbering.test.js",
  "tests/toggle.test.js",
];

const result = spawnSync(process.execPath, ["--test", ...FORK_TESTS], {
  cwd: ROOT,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
