# Changelog

All notable changes to **SMA1 Framework** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
for `FRAMEWORK_VERSION` in `app/version.js`.

## [Unreleased]

### Fixed

- Code block view/select with line numbers: horizontal scrollbar sits flush with the block (padding moved from `pre` onto `code` / gutter rows so the scrollport fills the block). Edit mode was already correct via the inset textarea.
- Anchored popovers hide while their target is fully off-screen (instead of clamping to a viewport edge) and show again when the anchor returns.
- Tutorial navigation (`next` / `back` / `goTo` / `start`) uses one showable-step resolver (`when` + resolvable target). Back over a missing target no longer ends the tour; `goTo(i)` jumps to the nearest showable step instead of walking a one-way ray that could stop the tour.
- Dropdown / combobox / also-see auto grid stores column count on `data-grid-cols` (not an inline custom property), so the also-see narrow-viewport single-column rule can apply. Grid keyboard and selection joins follow visual columns across full-span group rows.
- Corrected **Available features** module paths in `USAGE.md` (pre-move `app/*.js` links). Clarified heading-link disable order and also-see `accent` vs `accentHover` roles.
- Press feedback hover / selected fills use `--control-hover-mix` / `--control-selected-mix` (no hardcoded 6% / 12%). Selected `.btn-toggle:active` uses `--control-press-mix`. Dropped dead `.combo-menu-item` selectors from grid-only menu rules.
- Combobox hosts elevate with `.is-popup-open` while the suggestion list is open (same stacking fix as dropdown / combo). Table row hover, time-picker duration mode, slim-size APIs, and tri-state cycle scope documented in `USAGE.md` / `DESIGN.md`.
- Date / time / duration field CSS shares one trigger, popup shell, icon, and quick-action bar block in `controls-fields.css` (duration popups reuse `.time-picker-popup`).
- Documented time-panel **00:00** / **Now** defaults per host (standalone time picker, duration mode, duration input, date+time combined picker).
- Banner rotation requires `data-banner-expire`; `hideBanner()` resets to the first variation. `prepareButtonLabelFlash()` defaults `lockWidth` to on. Section panel inner gaps use `--panel-gap`.

### Changed

- Renamed technical identifiers from `template-*` to `framework-*` (e.g. `framework.lock.json`, `FRAMEWORK_VERSION`, `npm run sync:framework`, `migrate-framework` / `release-framework` skills, `icons-framework.js`, `app/css/framework.css`).
- Segmented control default height matches standard buttons (`--control-height`); add `.segmented-control--slim` for the previous compact size.

### Added

- Dropdown auto grid: `data-dropdown-grid-min` (and related `data-dropdown-grid*` attributes) switch long menus to a multi-column layout; `data-dropdown-grid="false"` keeps a single column. Footer **also see** and **combobox** lists use the same grid (`data-combobox-grid*`, `alsoSeeMenuColumns()`).
- Banner style variations (`banner-question`, `banner-example`, `banner-quote`, `banner-tip`) reuse warning, important, note, and success tokens; optional rotation via `data-banner-variations`, `data-banner-rotate`, and `setBannerVariation()`.
- Heading links can be disabled per app (`initShell({ headingLinks: false })` or `data-no-heading-links` on `<html>`) or per heading (`data-no-heading-link`).
- `migrate-framework` asks whether to check new changelog additions against local app workarounds and offers each match individually to switch onto the framework API.
- Button label flash helpers ([`app/utils/button-label.js`](app/utils/button-label.js)): `.btn-label-flash` + `prepareButtonLabelFlash()` / `flashButtonLabel()` for in-place Copy → Copied feedback; `lockWidth` auto-measure defaults on (pass `false` to skip). Code block and tabular input labeled clipboard actions use this pattern.
- Click press feedback for enabled toggle buttons, menu items, combobox options, and chips via `:active` tint (combobox options use `.is-pressed` because option `mousedown` `preventDefault` keeps the input focused and suppresses `:active`). Extended to file dropzone, colour-set swatches, table sort, legend chips, segmented control, pagination, tabs, and theme toggle; hover mixes use `--control-hover-mix` where they were still hardcoded.
- Tutorial scripts accept `when` on steps and nested `{ when, steps }` groups. Navigation and `Step {n} of {N}` follow currently showable steps (eligible `when` and resolvable target).

## [0.12.3] - 2026-08-19

### Fixed

- Dropdown and combo menus elevate their host while open so lists paint above neighbouring code-block gutter chrome (replaces the fixed-position approach in 0.12.2).
- Fixed popup menus no longer stretch to full viewport width (`min-width: 100%` on `position: fixed`).

## [0.12.2] - 2026-08-19

### Added

- Data table row hover uses one outer accent border per row instead of a box around every cell.
- Tabular input logical columns use the slim toggle (`.toggle--slim`) instead of a checkbox.

### Changed

- Tabular input copy tooltip reads “Copy in tabular format”; column rename tooltip reads “Select to edit”.
- Tabular input reset button uses danger styling (`.btn-danger`).

### Fixed

- Dropdown, combo, and toggle-dropdown menus use fixed positioning so lists escape stacking and overflow clipping (e.g. above code-block gutter chrome).
- Tabular input top-row selection spacing — header gap row replaces padding on the first body row.

## [0.12.1] - 2026-08-18

### Added

- Also-see links accept a theme pair (`accentLight` / `accentDark`, and the same for hover) as well as a single `accent` / `accentHover`; the pair wins and a missing side clones the other.

## [0.12.0] - 2026-08-16

### Added

- Custom time picker popup — independently wrapping hour / minute / optional second columns, block selection in the editable field, 00:00 / Now quick actions, and keyboard navigation; framework `clock` icon (`ic:round-schedule`).
- Slim toggle variant (`.toggle--slim`) — thin track with an oversized overhanging thumb and no icon; Forms demo and USAGE docs.
- Toggle button (`initToggleButton` / `initToggleButtons`) — `.btn-toggle` pressed state with optional next-action label/icon swapping; `data-toggle-button-always-active` keeps the default button appearance for controls where both states are actions; Actions demo shows pressed-state and swapping icon toggles at standard and slim sizes.
- Legend (`initLegend` / `initLegends`) — coloured category chips for charts and code highlights; eight numbered palette slots; optional toggle and `data-tooltip`; demo under Chips.
- Footer “also see” links accept optional per-app `accent` and `accentHover` hex colours in remote JSON or local config, scoping menu hover highlights to the destination app.

### Changed

- Date picker time mode now pairs the calendar and time panel side by side with one full-width Today / Now action bar; Today selects `00:00`, while Now selects the current date and time.
- Duration input uses the shared popup in duration mode with two-way field synchronisation, optional seconds, independent popup-column wrapping, and a 00:00 reset action.
- Anchored menus, combobox lists, and date / time / duration / colour popups share a one-popup-at-a-time registry (with grouped colour set + picker support).
- Checked and mixed checkboxes use an inset `--surface` face (rounded square when checked, disc when mixed) on an accent fill to match the toggle thumb — no check / minus glyphs. Radio selected dots use the same 2px inset and `--surface` face. Checkbox and radio snap into the selected state and ease out over `--control-hover-ms`, matching other controls.

### Fixed

- Time field block selection occurs on pointer press without briefly showing a text caret; quick actions close standalone popups and duration popups anchor to their fields.
- Duration input: clicking the control background (padding or separators) focuses and selects hours, matching native `type="time"`.
- Selected radio dots and toggle thumb glyphs no longer rest inside a transform (radio uses `transform: none` when checked; thumb icons centre with insets and `margin: auto`), so they rasterize on whole device pixels instead of drifting about a pixel off centre at some scroll positions and display scalings.
- `.panel-split` vertical rules now meet an adjacent `.panel-divider` instead of stopping ~1.6px short: next to a rule the split bleeds by the panel gap plus the new `--panel-divider-margin` token rather than one panel padding.
- Sticky section headings no longer flash a transparent background on reload before the pinned fill applies.
- Tutorial popover placement stays stable while scrolling / resizing during a step.
- Legend chip hover styling aligns with other selectable chips.

## [0.11.0] - 2026-08-12

### Added

- Diagrams (`initDiagram` / `initDiagrams`) — thin Mermaid (`mermaid@11.16.1`) text→SVG host; vendored ESM entry + chunks under `app/vendor/mermaid/`; light/dark theme re-render; empty `update({ source: "" })` clears the canvas; Specialised demo sequence beside the bar chart.
- Charts (`initChart` / `initCharts`) — thin TanStack Charts (`@tanstack/charts@0.9.0`) SVG host; vendored ESM under `app/vendor/tanstack-charts/` plus `d3-scale` / `d3-shape` bundles and a demo import map; Specialised demo bar chart after Editors.
- Agent rule [`.cursor/rules/vendor.mdc`](.cursor/rules/vendor.mdc) — vendor bytes in `app/vendor/`; components own single-consumer access; shared accessors only in `app/utils/` when two+ components need them.
- `app/utils/sanitize-svg.js` — SVG sanitizer for image-preview `setSvg` (keeps SMIL `animate*`; strips scripts / event handlers).

### Changed

- Merged Toast UI vendor accessors into `rich-text-editor.js` and removed `app/components/toastui-editor.js` (components own single-consumer vendor access; see `.cursor/rules/vendor.mdc`).

### Fixed

- Popover initial focus prefers primary / footer actions over Close; `trapFocus` option and `setTrapFocus()` so interactive tutorial steps can Tab to the spotlight target.
- Colour picker `rgbaFromHex` / `setValue` reject invalid hex instead of falling back to brand blue; SV/SL plane supports arrow keys / Home / End and `aria-value*`.
- Image preview sanitizes `setSvg` markup before injection; pre-existing markup `<img>` children get `sourceUrl` so download works.
- Colour set / colour picker `data-*-init` guards skip already-initialised hosts (including nested partners) on bulk `initColorSets` / `initColorPickers`.
- About dialog moves focus to `data-about-final` (else close) after the last Huh? stage; `destroy()` removes the confused-button listener and forwards `initDialog.destroy()`.

## [0.10.0] - 2026-08-09

### Added

- Colour set (`initColorSet`) — named palette gallery (popup or embedded); built-in sets as one module each under `app/components/color-set/sets/`; shared colour math in `app/utils/color.js`; swatches use `--control-height-micro`.
- Colour picker (`initColorPicker`) — HSV/HSL plane + hue slider, RGB/CMYK/alpha via shared `initSlider`, HEX field; format switch changes the visual; optional adjacent colour-set panel (palette icon toggle on the value row).
- Framework icon `palette` (`ic:round-palette`).
- Colour input `openOnClick` / `data-color-input-open` (`none` \| `picker` \| `set` \| `both`) with `openTrigger` / `data-color-input-open-trigger` (`either` default \| `swatch` \| `input`) — opens a nested or passed colour set / picker and keeps values in sync.
- `--control-height-micro` token (half of `--control-height`) for compact colour swatches and similar micro controls.
- Image preview (`initImagePreview`) — checkerboard host for SVG / image URLs / Blob; optional maximise icon and click-to-expand via expandable-surface (`data-image-preview-maximize`, `data-image-preview-expand-on-click`); optional floating download and muted dimensions / file-size / SMIL frame + duration meta (`data-image-preview-download`, `data-image-preview-dimensions`, `data-image-preview-file-size`, `data-image-preview-frames`, `data-image-preview-duration`); meta strip visibility via `data-image-preview-meta` (`hover` default, `always`, `never`).
- Expandable surface: `data-expandable-surface-click` (toggle on surface click) and `data-expandable-surface-control="false"` (omit floating maximise button).
- Manifest **schema v2**: hashed Cursor agent skills/rules, `agent` catalogue, empty `deprecated` / `retired` lifecycle maps, and lock `skills` selection (`*` / `-id`).
- `sync:framework --prune` to remove `previousFiles` / retired paths when safe (skips if still referenced from app-owned files).
- USAGE section **Framework lock, manifest, and upgrades** documenting versions, lock/manifest, sync/verify, ids, deprecate→retire, and forking skills.
- Popover (`initPopover`) — anchored speech-bubble card with a notch, title, body, and actions; pure `computePopoverPlacement` for flip/clamp positioning.
- Tutorial (`initTutorial`) — guided spotlight tour over a JS step script (back / next / close); multiple scripts per page with one active at a time; optional interactive steps (`advanceOn: "click"`).
- About dialog (`initAboutDialog`) — tagline “What?” opener with progressive Huh? / Uhh… simplification stages declared in markup (`data-about-stage`, `data-about-next-label`, `data-about-final`), same pattern as [pqm-stepper](https://github.com/filcuk/pqm-stepper); demo on `demo.html`.
- Optional automatic title numbering (`data-title-numbering` / `setTitleNumbering`) — hierarchical `1.` / `1.1.` / `1.2.1.` prefixes on outline headings; demo toggle beside sticky chrome.
- Callout cards (`.callout`) — accent-edged tip panels for standing information (CSS-only; former content-tier header chrome).
- Agent lifecycle skills under `.cursor/skills/` (init-app, migrate-framework, sync-shell, restore-component, finalize-app, author-component, release-framework, handle-assets, health-check).
- Shared `.cursor/skills/_shared/component-map.md` and `invariants.md` for trim/restore/migrate.
- `framework-manifest.json` (SHA-256 per distributable `app/` file, component graph, app-owned paths) generated by `npm run manifest:framework` from `scripts/lib/framework-catalogue.mjs`.
- `framework.lock.json` plus `npm run sync:framework` / `npm run verify:framework` for versioned 1:1 component sync (local `--from` or GitHub tag tarball).
- Lifecycle skills (`migrate-framework`, `restore-component`, `health-check`, `release-framework`, …) driven by lock + sync/verify; releases require git tag `vX.Y.Z`.
- Colour input alpha variant (`data-color-input-alpha` / `alpha: true`) for `#RGBA` / `#RRGGBBAA`.
- Also-see `order` on topics and links; embedded `iconSvg` / `iconSvgLight` / `iconSvgDark` (sanitized inline SVG).
- Combobox multi-select variant (`data-combobox-multi` / `multi: true`): comma-separated labels in the input and a selection-count badge.
- Time picker (`initTimePicker`) — time of day without a date.
- Duration input (`initDurationInput`) — segmented hours:minutes (optional seconds).

### Changed

- Soft verify for agent skill/rule drift (`agentModified` / `agentMissing` does not fail CI); hard verify remains for catalogue `app/` hashes.
- Rich text editor Markdown / WYSIWYG switch uses the framework segmented control (Toast UI’s native mode tabs are hidden).
- Heading outline: site `h1`, tier `h2.segment-title` (was `.content-tier-title`), section `h3.section-title` (was `h2.section-heading`). Page nav and heading links default to `main :is(h2, h3)[id]`.
- Content tier headers are plain larger titles with an underline instead of accent-edged cards (card chrome moved to `.callout`).
- Sticky chrome stacks site header, tier header, and section headings; pinned bars fade in gap fill and a single edge hairline/shadow (`data-sticky-stuck` / `data-sticky-stuck-edge`) instead of always-on cover strips.
- Split inline icons into `icons-framework.js` (catalogue), `icons-app.js` (fork-owned, empty here), and merging `icons.js` (public API unchanged).
- Split styles into fork-owned `styles.css` / `css/app.css` and framework partial index `css/framework.css`.
- Toggle dropdown selection count uses a **badge** on the trigger instead of appending `(n)` to the label text.
- Renamed the hex colour field component from colour picker to **colour input** (`color-input` / `initColorInput`) so “colour picker” can mean a future spectrum selector.
- Also-see menu lays topics out full width on a shared grid, choosing the column count that leaves the fewest empty cells.
- Banner borders again use `--banner-*-border` tokens (no `color-mix`); warn / info / note / important / success borders align with their text colours in light and dark. `--banner-error-border` is unchanged (shared as the danger accent on buttons and invalid fields).
- Success banner text/border retune (`#1f8c40` / `#4ac25c`) also affects `.tooltip--success`, which uses the same tokens.

### Fixed

- Rich text editor toolbar icon bleed — match Toast UI’s 1px border to the toolbar/`--code-bg` hover fill and clip the sprite to the padding box.
- Rich text editor content panes use `--input-bg` (same as `.input` / `.textarea`); toolbar stays on `--surface`.
- Sticky site-header border disappearing under the sticky cover strip once pinned.
- Sticky section/tier cover strips masking content while headings were still in flow.

## [0.9.0] - 2026-07-26

### Added

- App icon modes: light/dark pair or single logo via `APP_ICON_SRC` / `__MICROAPP__` (`appIcon`, `appIconLight`, `appIconDark`).
- Improved related-links (also-see) icon handling for light/dark assets.

## [0.8.0] - 2026-07-26

### Added

- Remote `alsoSeeUrl` JSON for the footer related-apps menu, with local `alsoSee` fallback.
- Also-see topic whitelist (`alsoSeeTopics`).
- Tabular input copy/paste options (in-place and replace), wider canvas breakout, and related demo/docs/tests.

### Fixed

- Also-see menu opening under the page body.
- Tooltip appearing when removing tabular-input columns.
- Missing icon placeholders for new actions.

## [0.7.0] - 2026-07-25

### Added

- Tabular input (editable typed grid, row/column controls, clipboard helpers, keyboard nav).
- Badge and chips components.
- Footer related-apps (“also see”) menu.
- Sticky site header and sticky section headings.
- Tri-state toggle and tri-state checkbox.
- Theme / colour documentation blocks in the demo.
- Progress bar error and disabled states; optional shine.
- Dropdown menu group headers and richer dropdown demos.

### Changed

- Control reorganisation and header styling (including header bottom border).
- Improved table interaction and input filtering.

### Fixed

- Sticky header blocking content and sticky interaction issues.
- Dropdowns remaining open incorrectly.

## [0.6.0] - 2026-06-29

### Added

- Colour picker, data table, rich text editor (Toast UI + merged-cell plugin).
- Spinner, progress bar, pagination, segmented control, toggle.
- Slider, stepper, progress indicator.
- Reworked demo layout and clearer page-nav category headers.

### Changed

- Codebase review refactor: components under `app/components/`, shell under `app/shell/`, utils under `app/utils/`; demo modules reorganised.

### Fixed

- Progress indicator buttons, table checkbox alignment, page jumps on reload.
- Date picker calendar week start (Monday) and assorted demo polish.

## [0.5.0] - 2026-06-28

### Added

- Initial framework: theme toggle, layout shell, buttons, banners, tooltips, dialogs.
- Code blocks (Prism), expandable surfaces, page navigation, heading links, external-link icons.
- Section panel, toolbar, USAGE.md, disclaimer, SemVer `FRAMEWORK_VERSION` / `APP_VERSION`.
- Checkbox, expand, tabs, combo / dropdown / toggle-dropdown.
- File dropzone and file download.
- Accordion, date/time picker, combobox.
- Radio and related form control polish; banner lifetime / expire indicator.

[Unreleased]: https://github.com/filcuk/sma1-framework/compare/v0.12.1...HEAD
[0.12.1]: https://github.com/filcuk/sma1-framework/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/filcuk/sma1-framework/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/filcuk/sma1-framework/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/filcuk/sma1-framework/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/filcuk/sma1-framework/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/filcuk/sma1-framework/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/filcuk/sma1-framework/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/filcuk/sma1-framework/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/filcuk/sma1-framework/releases/tag/v0.5.0
