import { registerColorSet } from "../registry.js";
import basic from "./basic.js";
import fluent from "./fluent.js";
import metro from "./metro.js";
import flatUi from "./flat-ui.js";
import material from "./material.js";
import tailwind from "./tailwind.js";
import webSafe from "./web-safe.js";

const BUILTIN_SETS = [basic, fluent, metro, flatUi, material, tailwind, webSafe];

let registered = false;

/** Register built-in palettes once. Safe to call multiple times. */
export function ensureBuiltinColorSets() {
  if (registered) return;
  for (const definition of BUILTIN_SETS) {
    registerColorSet(definition, { replace: true });
  }
  registered = true;
}

export { BUILTIN_SETS };
