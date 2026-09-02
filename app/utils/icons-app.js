/**
 * Fork-owned inline SVG icons. Never overwritten by framework sync.
 *
 * Add app-specific entries here (or blank stubs with empty `markup` when the
 * user will supply paths). Prefer `{ ref: "framework-id" }` to alias a framework
 * icon. Import `ICON_ATTRIBUTIONS` from `./icons.js` (or `./icons-framework.js`)
 * when setting `attribution`.
 *
 * Available (app): (none in the framework)
 */

/** @typedef {{ viewBox: string, markup: string, attribution?: string, name?: string }} IconSvgDef */
/** @typedef {{ ref: string }} IconRefDef */
/** @typedef {IconSvgDef | IconRefDef} IconDef */

/** @type {Record<string, IconDef>} */
export const APP_ICONS = {};
