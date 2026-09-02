import { parseHexColor } from "../../utils/color.js";

/**
 * @typedef {{ hex: string, name?: string }} ColorSetSwatch
 * @typedef {{ id: string, name: string, colors: Array<string | ColorSetSwatch> }} ColorSetDefinition
 * @typedef {{ id: string, name: string, colors: ColorSetSwatch[] }} ColorSet
 */

/** @type {Map<string, ColorSet>} */
const setsById = new Map();

/**
 * @param {string | ColorSetSwatch} entry
 * @param {{ alpha?: boolean }} [options]
 * @returns {ColorSetSwatch | null}
 */
export function normalizeColorEntry(entry, { alpha = false } = {}) {
  if (typeof entry === "string") {
    const hex = parseHexColor(entry, { alpha });
    return hex ? { hex } : null;
  }
  if (!entry || typeof entry !== "object") return null;
  const hex = parseHexColor(entry.hex, { alpha });
  if (!hex) return null;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  return name ? { hex, name } : { hex };
}

/**
 * @param {ColorSetDefinition} definition
 * @param {{ alpha?: boolean, replace?: boolean }} [options]
 * @returns {ColorSet | null}
 */
export function registerColorSet(definition, { alpha = false, replace = false } = {}) {
  if (!definition || typeof definition !== "object") return null;
  const id = String(definition.id ?? "").trim();
  const name = String(definition.name ?? "").trim() || id;
  if (!id) return null;
  if (setsById.has(id) && !replace) {
    return setsById.get(id) ?? null;
  }

  /** @type {ColorSetSwatch[]} */
  const colors = [];
  for (const entry of definition.colors ?? []) {
    const normalised = normalizeColorEntry(entry, { alpha });
    if (normalised) colors.push(normalised);
  }

  /** @type {ColorSet} */
  const set = { id, name, colors };
  setsById.set(id, set);
  return set;
}

/** @param {string} id */
export function getColorSet(id) {
  return setsById.get(String(id ?? "").trim()) ?? null;
}

/** @returns {ColorSet[]} */
export function listColorSets() {
  return [...setsById.values()];
}

/** Clear all registered sets (tests / re-init). */
export function clearColorSets() {
  setsById.clear();
}
