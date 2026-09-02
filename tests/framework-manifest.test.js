import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AGENT_RULES,
  AGENT_SKILLS,
  APP_OWNED,
  COMPONENTS,
  CSS_INDEX_ORDER,
  DERIVED_FILES,
  validateLifecycleCatalogue,
} from "../scripts/lib/framework-catalogue.mjs";
import { renderFrameworkCssIndex } from "../scripts/lib/framework-catalogue.mjs";
import {
  buildManifest,
  hashFile,
  isAppOwnedPath,
  listAgentCatalogueFiles,
  readFrameworkVersion,
  sha256Hex,
} from "../scripts/generate-framework-manifest.mjs";
import { canonicalizeNewlines } from "../scripts/lib/framework-resolve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "framework-manifest.json");

test("readFrameworkVersion matches app/version.js", () => {
  const src = fs.readFileSync(path.join(ROOT, "app", "version.js"), "utf8");
  const match = /export const FRAMEWORK_VERSION = "([^"]+)"/.exec(src);
  assert.ok(match, "app/version.js must export FRAMEWORK_VERSION");
  assert.equal(readFrameworkVersion(), match[1]);
});

test("isAppOwnedPath covers files and directory prefixes", () => {
  assert.equal(isAppOwnedPath("app/main.js"), true);
  assert.equal(isAppOwnedPath("app/res/app.svg"), true);
  assert.equal(isAppOwnedPath("app/components/dialog.js"), false);
  assert.equal(isAppOwnedPath("app/css/framework.css"), false);
});

test("buildManifest excludes app-owned and derived from files hashes", () => {
  const manifest = buildManifest();
  for (const owned of APP_OWNED) {
    if (owned.endsWith("/")) {
      for (const key of Object.keys(manifest.files)) {
        assert.equal(key.startsWith(owned), false, key);
      }
    } else {
      assert.equal(owned in manifest.files, false, owned);
    }
  }
  for (const derived of DERIVED_FILES) {
    assert.equal(derived in manifest.files, false, derived);
    assert.ok(manifest.derived[derived]?.sha256);
  }
});

test("buildManifest hashes match on-disk bytes for every file entry", () => {
  const manifest = buildManifest();
  for (const [rel, meta] of Object.entries(manifest.files)) {
    assert.equal(meta.sha256, hashFile(rel), rel);
  }
});

test("buildManifest includes hashed agent skill and rule paths", () => {
  const manifest = buildManifest();
  assert.equal(manifest.schemaVersion, 2);
  const agentPaths = listAgentCatalogueFiles();
  assert.ok(agentPaths.length >= AGENT_RULES.length + 2);
  for (const rel of agentPaths) {
    assert.ok(manifest.files[rel]?.sha256, rel);
    assert.equal(manifest.files[rel].sha256, hashFile(rel), rel);
  }
  assert.deepEqual(Object.keys(manifest.agent.skills).sort(), Object.keys(AGENT_SKILLS).sort());
  assert.deepEqual(manifest.agent.rules, AGENT_RULES);
  assert.deepEqual(manifest.deprecated, {});
  assert.deepEqual(manifest.retired, {});
});

test("hashFile is stable across CRLF and LF line endings", () => {
  const rel = "app/components/accordion.js";
  const abs = path.join(ROOT, ...rel.split("/"));
  const lf = canonicalizeNewlines(fs.readFileSync(abs));
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.equal(sha256Hex(lf), sha256Hex(canonicalizeNewlines(crlf)));
  assert.equal(sha256Hex(lf), hashFile(rel));
});

test("checked-in framework-manifest.json matches a fresh build (stable fields)", () => {
  assert.ok(fs.existsSync(MANIFEST_PATH), "framework-manifest.json missing — run npm run manifest:framework");
  const onDisk = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const fresh = buildManifest();

  assert.equal(onDisk.schemaVersion, 2);
  assert.equal(onDisk.frameworkVersion, fresh.frameworkVersion);
  assert.deepEqual(onDisk.appOwned, fresh.appOwned);
  assert.deepEqual(onDisk.appOwnedFields, fresh.appOwnedFields);
  assert.deepEqual(onDisk.core, fresh.core);
  assert.deepEqual(onDisk.cssIndexOrder, fresh.cssIndexOrder);
  assert.deepEqual(Object.keys(onDisk.components).sort(), Object.keys(COMPONENTS).sort());
  assert.deepEqual(onDisk.agent, fresh.agent);
  assert.deepEqual(onDisk.deprecated, fresh.deprecated);
  assert.deepEqual(onDisk.retired, fresh.retired);
  assert.deepEqual(onDisk.files, fresh.files);
  assert.deepEqual(onDisk.derived, fresh.derived);
});

test("validateLifecycleCatalogue rejects retired path reuse and missing deprecatedIn", () => {
  assert.doesNotThrow(() => validateLifecycleCatalogue());

  assert.throws(
    () =>
      validateLifecycleCatalogue({
        retired: {
          "legacy-dialog": {
            kind: "component",
            previousFiles: ["app/components/dialog.js"],
            deprecatedIn: "1.0.0",
            retiredIn: "1.1.0",
          },
        },
      }),
    /path reuse forbidden/
  );

  assert.throws(
    () =>
      validateLifecycleCatalogue({
        retired: {
          gone: {
            kind: "component",
            previousFiles: ["app/gone.js"],
            retiredIn: "1.1.0",
          },
        },
      }),
    /missing deprecatedIn/
  );

  assert.throws(
    () =>
      validateLifecycleCatalogue({
        retired: {
          dialog: {
            kind: "component",
            previousFiles: ["app/old-dialog.js"],
            deprecatedIn: "1.0.0",
            retiredIn: "1.1.0",
          },
        },
      }),
    /must not remain in COMPONENTS/
  );
});

test("renderFrameworkCssIndex matches checked-in framework.css", () => {
  const body = renderFrameworkCssIndex(CSS_INDEX_ORDER);
  for (const name of CSS_INDEX_ORDER) {
    assert.match(body, new RegExp(`@import url\\("${name}"\\);`));
  }
  const diskText = fs
    .readFileSync(path.join(ROOT, "app/css/framework.css"), "utf8")
    .replace(/\r\n/g, "\n");
  assert.equal(diskText, body);
  assert.equal(sha256Hex(body), hashFile("app/css/framework.css"));
});
