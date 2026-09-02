import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stylesPath = path.join(root, "app", "styles.css");
const frameworkPath = path.join(root, "app", "css", "framework.css");
const appCssPath = path.join(root, "app", "css", "app.css");

test("styles.css is a fork entry importing tokens, framework, then app", () => {
  const css = fs.readFileSync(stylesPath, "utf8");
  assert.match(css, /@import url\("tokens\.css"\);/);
  assert.match(css, /@import url\("css\/framework\.css"\);/);
  assert.match(css, /@import url\("css\/app\.css"\);/);
  assert.doesNotMatch(css, /@import url\("css\/layout\.css"\);/);
});

test("framework.css indexes selected partials that exist on disk", () => {
  const css = fs.readFileSync(frameworkPath, "utf8");
  const imports = [...css.matchAll(/@import url\("([^"]+\.css)"\);/g)].map(
    (match) => match[1]
  );
  assert.ok(imports.length > 0, "framework.css should list CSS partials");
  assert.ok(imports.includes("layout.css"));
  assert.ok(imports.includes("overlays.css"));
  assert.ok(imports.includes("controls-buttons.css"));
  for (const partial of imports) {
    assert.ok(
      fs.existsSync(path.join(root, "app", "css", partial)),
      partial
    );
  }
});

test("app.css exists as a fork-owned sheet", () => {
  assert.ok(fs.existsSync(appCssPath));
  const css = fs.readFileSync(appCssPath, "utf8");
  assert.doesNotMatch(css, /@import/);
});
