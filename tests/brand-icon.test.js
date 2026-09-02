import test from "node:test";
import assert from "node:assert/strict";
import {
  APP_ICON_SRC,
  readAppIconConfig,
  resolveAppIconSources,
} from "../app/utils/brand-icon.js";

test("resolveAppIconSources uses light/dark pair when present", () => {
  assert.deepEqual(
    resolveAppIconSources({
      icon: "app/res/app.svg",
      light: "app/res/app-light.svg",
      dark: "app/res/app-dark.svg",
    }),
    {
      mode: "pair",
      light: "app/res/app-light.svg",
      dark: "app/res/app-dark.svg",
    }
  );
});

test("resolveAppIconSources uses a single icon when pair paths are empty", () => {
  assert.deepEqual(
    resolveAppIconSources({
      icon: "app/res/app.svg",
      light: "",
      dark: "",
    }),
    { mode: "single", icon: "app/res/app.svg" }
  );
});

test("resolveAppIconSources defaults single icon path when empty", () => {
  assert.deepEqual(resolveAppIconSources({ icon: "", light: "", dark: "" }), {
    mode: "single",
    icon: "app/res/app.svg",
  });
});

test("readAppIconConfig prefers __MICROAPP__ overrides including empty strings", () => {
  assert.deepEqual(
    readAppIconConfig(
      {
        appIcon: "app/res/app.svg",
        appIconLight: "",
        appIconDark: "",
      },
      APP_ICON_SRC
    ),
    {
      icon: "app/res/app.svg",
      light: "",
      dark: "",
    }
  );

  assert.deepEqual(readAppIconConfig({}, APP_ICON_SRC), {
    icon: APP_ICON_SRC.icon,
    light: APP_ICON_SRC.light,
    dark: APP_ICON_SRC.dark,
  });
});
