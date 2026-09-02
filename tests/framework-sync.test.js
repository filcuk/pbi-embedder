import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { readFrameworkVersion } from "../scripts/generate-framework-manifest.mjs";
import {
  collectPrunePaths,
  isPathReferencedInAppOwned,
  mergeVersionJs,
  resolveCssIndex,
  resolveSelectedSkillIds,
  resolveSelection,
  verifyFrameworkTree,
} from "../scripts/lib/framework-resolve.mjs";
import { runVerify } from "../scripts/verify-framework.mjs";
import { buildUpdatedLock, pruneRetiredPaths, runSync } from "../scripts/sync-framework.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadManifest() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "framework-manifest.json"), "utf8"));
}

test("resolveSelection with * includes core shell files and all css partials", () => {
  const manifest = loadManifest();
  const selection = resolveSelection(
    { frameworkVersion: "0.9.0", components: ["*"] },
    manifest
  );
  assert.ok(selection.files.includes("app/shell/shell.js"));
  assert.ok(selection.files.includes("app/components/dialog.js"));
  assert.ok(selection.files.includes("framework-manifest.json"));
  assert.equal(selection.css.length, manifest.cssIndexOrder.length);
});

test("resolveSelection includes agent files by default and respects -skill exclusions", () => {
  const manifest = loadManifest();
  const all = resolveSelection(
    { frameworkVersion: "0.9.0", components: ["dialog"], skills: ["*"] },
    manifest
  );
  assert.ok(all.skills.includes("init-app"));
  assert.ok(all.skills.includes("_shared"));
  assert.ok(all.agentFiles.includes(".cursor/skills/init-app/SKILL.md"));
  assert.ok(all.agentFiles.includes(".cursor/skills/_shared/invariants.md"));
  assert.ok(all.agentFiles.includes(".cursor/rules/icons.mdc"));

  const excluded = resolveSelection(
    {
      frameworkVersion: "0.9.0",
      components: ["dialog"],
      skills: ["*", "-init-app"],
    },
    manifest
  );
  assert.equal(excluded.skills.includes("init-app"), false);
  assert.ok(excluded.skills.includes("_shared"));
  assert.equal(
    excluded.agentFiles.includes(".cursor/skills/init-app/SKILL.md"),
    false
  );
  assert.ok(excluded.agentFiles.includes(".cursor/skills/_shared/invariants.md"));
});

test("resolveSelectedSkillIds treats exclusion-only lists as star minus ids", () => {
  const manifest = loadManifest();
  const ids = resolveSelectedSkillIds({ skills: ["-release-framework"] }, manifest);
  assert.ok(ids.includes("init-app"));
  assert.ok(ids.includes("_shared"));
  assert.equal(ids.includes("release-framework"), false);
});

test("resolveSelection for dialog pulls overlays css and dialog.js only among optional components", () => {
  const manifest = loadManifest();
  const selection = resolveSelection(
    { frameworkVersion: "0.9.0", components: ["dialog"] },
    manifest
  );
  assert.ok(selection.files.includes("app/components/dialog.js"));
  assert.ok(selection.files.includes("app/css/overlays.css"));
  assert.equal(selection.files.includes("app/components/table.js"), false);
  assert.ok(selection.css.includes("overlays.css"));
  assert.equal(selection.css.includes("table.css"), false);
  // always-on components still selected
  assert.ok(selection.components.includes("tooltip"));
  assert.ok(selection.components.includes("banner"));
});

test("picker selections include their shared time panel dependencies", () => {
  const manifest = loadManifest();

  const time = resolveSelection(
    { frameworkVersion: "0.11.0", components: ["time-picker"] },
    manifest
  );
  assert.ok(time.files.includes("app/components/time-picker/index.js"));
  assert.ok(time.files.includes("app/components/time-picker/panel.js"));
  assert.ok(time.files.includes("app/components/time-picker/field.js"));
  assert.ok(time.files.includes("app/utils/icons.js"));

  const date = resolveSelection(
    { frameworkVersion: "0.11.0", components: ["date-picker"] },
    manifest
  );
  assert.ok(date.files.includes("app/components/time-picker/panel.js"));
  assert.ok(date.files.includes("app/components/time-picker/field.js"));

  const duration = resolveSelection(
    { frameworkVersion: "0.11.0", components: ["duration-input"] },
    manifest
  );
  assert.ok(duration.files.includes("app/components/time-picker/panel.js"));
  assert.ok(duration.files.includes("app/utils/document-listeners.js"));
});

test("resolveCssIndex keeps catalogue order", () => {
  const manifest = loadManifest();
  const css = resolveCssIndex(manifest, ["dialog", "tooltip", "banner"]);
  assert.deepEqual(
    css,
    manifest.cssIndexOrder.filter((name) => css.includes(name))
  );
  assert.ok(css.indexOf("layout.css") < css.indexOf("overlays.css"));
});

test("mergeVersionJs preserves APP_VERSION and takes upstream FRAMEWORK_VERSION", () => {
  const local = `export const FRAMEWORK_VERSION = "0.8.0";\nexport const APP_VERSION = "1.2.3";\n`;
  const upstream = `export const FRAMEWORK_VERSION = "0.9.0";\nexport const APP_VERSION = "0.0.0";\n`;
  const merged = mergeVersionJs(local, upstream);
  assert.match(merged, /FRAMEWORK_VERSION = "0\.9\.0"/);
  assert.match(merged, /APP_VERSION = "1\.2\.3"/);
});

test("buildUpdatedLock preserves skills and bumps schemaVersion", () => {
  const manifest = loadManifest();
  const next = buildUpdatedLock(
    {
      schemaVersion: 1,
      frameworkVersion: "0.9.0",
      components: ["dialog"],
      skills: ["*", "-release-framework"],
      customNote: "keep-me",
    },
    manifest,
    "filcuk/sma1-framework"
  );
  assert.equal(next.schemaVersion, 2);
  assert.deepEqual(next.skills, ["*", "-release-framework"]);
  assert.equal(next.customNote, "keep-me");
  assert.equal(next.source, "filcuk/sma1-framework");
});

test("verifyFrameworkTree passes on this repository", () => {
  const manifest = loadManifest();
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "framework.lock.json"), "utf8"));
  const report = verifyFrameworkTree(ROOT, lock, manifest);
  assert.equal(report.ok, true, JSON.stringify(report.summary));
  assert.equal(report.summary.modified, 0);
  assert.equal(report.summary.missing, 0);
  assert.equal(report.summary.unexpected, 0);
  assert.equal(report.summary.agentModified, 0);
  assert.equal(report.summary.agentMissing, 0);
  assert.ok(report.skills.length > 0);
});

test("agent file drift is soft and does not fail verify ok", () => {
  const manifest = structuredClone(loadManifest());
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, "framework.lock.json"), "utf8"));
  const agentPath = ".cursor/skills/init-app/SKILL.md";
  assert.ok(manifest.files[agentPath]);
  manifest.files[agentPath] = { sha256: "0".repeat(64) };

  const report = verifyFrameworkTree(ROOT, lock, manifest);
  assert.equal(report.ok, true, JSON.stringify(report.summary));
  assert.equal(report.summary.agentModified, 1);
  assert.equal(report.summary.modified, 0);
  const row = report.results.find((r) => r.path === agentPath);
  assert.equal(row?.status, "agentModified");
});

test("runVerify CLI succeeds on this repository", () => {
  const report = runVerify([`--root`, ROOT]);
  assert.equal(report.ok, true);
});

test("prune deletes previousFiles when safe and skips when referenced", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "microapp-prune-test-"));
  try {
    const stale = "app/legacy-widget.js";
    const referenced = "app/legacy-referenced.js";
    fs.mkdirSync(path.join(temp, "app"), { recursive: true });
    fs.writeFileSync(path.join(temp, ...stale.split("/")), "stale\n");
    fs.writeFileSync(path.join(temp, ...referenced.split("/")), "ref\n");
    fs.writeFileSync(
      path.join(temp, "app", "main.js"),
      `import "./legacy-referenced.js";\n`
    );

    const manifest = {
      appOwned: [
        "app/main.js",
        "app/demo.js",
        "app/config.js",
        "app/styles.css",
        "app/css/app.css",
        "app/utils/icons-app.js",
        "app/res/",
        "index.html",
        "demo.html",
      ],
      components: {},
      agent: { skills: {}, rules: [] },
      retired: {
        "legacy-widget": {
          kind: "component",
          previousFiles: [stale, referenced],
          deprecatedIn: "1.0.0",
          retiredIn: "1.1.0",
        },
      },
    };
    const selection = { components: [], skills: [] };
    assert.deepEqual(collectPrunePaths(manifest, selection), [referenced, stale].sort());
    assert.equal(isPathReferencedInAppOwned(temp, referenced, manifest.appOwned), true);
    assert.equal(isPathReferencedInAppOwned(temp, stale, manifest.appOwned), false);

    const result = pruneRetiredPaths(temp, manifest, selection);
    assert.deepEqual(result.pruned, [stale]);
    assert.deepEqual(result.skipped, [referenced]);
    assert.equal(fs.existsSync(path.join(temp, ...stale.split("/"))), false);
    assert.equal(fs.existsSync(path.join(temp, ...referenced.split("/"))), true);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});

test("sync --from self into a temp root with dialog-only lock", async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "microapp-sync-test-"));
  try {
    // Minimal fork scaffold
    fs.mkdirSync(path.join(temp, "app", "css"), { recursive: true });
    fs.writeFileSync(
      path.join(temp, "app", "version.js"),
      `export const FRAMEWORK_VERSION = "0.8.0";\nexport const APP_VERSION = "9.9.9";\n`
    );
    fs.writeFileSync(path.join(temp, "app", "styles.css"), "/* fork entry */\n");
    fs.writeFileSync(path.join(temp, "app", "css", "app.css"), "/* app */\n");
    fs.writeFileSync(
      path.join(temp, "framework.lock.json"),
      `${JSON.stringify(
        {
          schemaVersion: 1,
          frameworkVersion: "0.9.0",
          source: "filcuk/sma1-framework",
          components: ["dialog"],
          skills: ["*", "-release-framework"],
        },
        null,
        2
      )}\n`
    );

    const result = await runSync([`--root`, temp, `--from`, ROOT]);
    assert.equal(result.ok, true);
    assert.ok(fs.existsSync(path.join(temp, "app", "components", "dialog.js")));
    assert.ok(fs.existsSync(path.join(temp, "app", "shell", "shell.js")));
    assert.equal(fs.existsSync(path.join(temp, "app", "components", "table.js")), false);
    assert.equal(fs.existsSync(path.join(temp, "app", "styles.css")), true);
    assert.ok(fs.existsSync(path.join(temp, ".cursor", "skills", "init-app", "SKILL.md")));
    assert.equal(
      fs.existsSync(path.join(temp, ".cursor", "skills", "release-framework", "SKILL.md")),
      false
    );
    assert.ok(fs.existsSync(path.join(temp, ".cursor", "rules", "icons.mdc")));

    const expectedTemplateVersion = readFrameworkVersion();
    const version = fs.readFileSync(path.join(temp, "app", "version.js"), "utf8");
    assert.match(
      version,
      new RegExp(`FRAMEWORK_VERSION = "${expectedTemplateVersion.replace(/\./g, "\\.")}"`)
    );
    assert.match(version, /APP_VERSION = "9\.9\.9"/);

    const css = fs.readFileSync(path.join(temp, "app", "css", "framework.css"), "utf8");
    assert.match(css, /overlays\.css/);
    assert.doesNotMatch(css, /table\.css/);

    const manifest = JSON.parse(
      fs.readFileSync(path.join(temp, "framework-manifest.json"), "utf8")
    );
    const lock = JSON.parse(fs.readFileSync(path.join(temp, "framework.lock.json"), "utf8"));
    assert.equal(lock.schemaVersion, 2);
    assert.deepEqual(lock.skills, ["*", "-release-framework"]);
    const report = verifyFrameworkTree(temp, lock, manifest);
    assert.equal(report.ok, true, JSON.stringify(report.summary));
    assert.equal(report.skills.includes("release-framework"), false);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
