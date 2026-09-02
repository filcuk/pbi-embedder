# AGENTS.md

Rules for AI agents working in **Power BI Embedder** (an SMA1 Framework fork).

App-specific logic lives under [`app/tools/`](app/tools/) (`convert.js`, `selection.js`, `persist.js`, `output-table.js`) and [`app/main.js`](app/main.js). The catalogue is trimmed via [`framework.lock.json`](framework.lock.json); use **`restore-component`** to add features back. Fork tests run through [`scripts/test-app.mjs`](scripts/test-app.mjs).

## Framework ownership boundary

The always-applied [framework ownership rule](.cursor/rules/framework-ownership.mdc) defines which files app agents must treat as read-only. Follow it before editing an app fork.

## Lifecycle skills

Multi-step workflows live under [`.cursor/skills/`](.cursor/skills/). Read the matching `SKILL.md` when the task fits; shared rules and the feature dependency inventory are in [`.cursor/skills/_shared/`](.cursor/skills/_shared/).

| Skill | Use when |
| ----- | -------- |
| [`init-app`](.cursor/skills/init-app/SKILL.md) | Fork / scaffold a new app from this framework |
| [`migrate-framework`](.cursor/skills/migrate-framework/SKILL.md) | Upgrade a fork to a newer framework release (partial or full) via lock + sync; optionally fold local workarounds into new framework APIs |
| [`sync-shell`](.cursor/skills/sync-shell/SKILL.md) | Pull shell/theme/tokens/infra only |
| [`restore-component`](.cursor/skills/restore-component/SKILL.md) | Add a trimmed catalogue component back into a fork (lock + sync) |
| [`finalize-app`](.cursor/skills/finalize-app/SKILL.md) | Remove unused components before shipping |
| [`author-component`](.cursor/skills/author-component/SKILL.md) | Add a **new** reusable component to the framework itself |
| [`release-framework`](.cursor/skills/release-framework/SKILL.md) | Bump `FRAMEWORK_VERSION`, regenerate manifest, tag `vX.Y.Z` |
| [`handle-assets`](.cursor/skills/handle-assets/SKILL.md) | Wire logos/favicons/res — never invent artwork; request files from the user |
| [`manage-color`](.cursor/skills/manage-color/SKILL.md) | Set / validate light+dark `--accent` and `--accent-fg` (WCAG AA) in `app.css` |
| [`add-icon`](.cursor/skills/add-icon/SKILL.md) | Pull Icônes / Iconify SVG into `icons-framework.js` or `icons-app.js` (prefer `ic` Round; Material Symbols fallback) |
| [`health-check`](.cursor/skills/health-check/SKILL.md) | Verify boot, Pages, config, assets, and `verify:framework` |

Framework lock, manifest hashes, sync/verify, deprecate→retire, and forking skills: see **[Framework lock, manifest, and upgrades](USAGE.md#framework-lock-manifest-and-upgrades)** in `USAGE.md`.

## Confirm before complexity

Ask the user before adding:

- External dependencies (npm packages, CDN libraries, frameworks)
- Build tools or bundlers (Vite, Webpack, Rollup, etc.)
- Non-trivial architecture (state managers, routers, SSR)

Prefer the simplest approach that fits the existing framework.

## Stay vanilla

- Plain HTML, CSS, and JavaScript ES modules
- No build step unless explicitly approved
- No `package.json` unless the user requests it

## Language (technical vs docs)

Use **American English** for technical identifiers so they match web platform APIs and CSS/HTML conventions (`color`, `dialog`, `initialize`-style spellings where applicable):

- File and directory names (`color-input.js`)
- CSS class names, custom properties, and selectors (`.color-input`, `--accent`)
- JS APIs, variables, and `data-*` attributes (`initColorInput`, `data-color-input-default`)
- Form `name` values and other machine-facing strings

Prose in documentation (`USAGE.md`, `README.md`, `CHANGELOG.md`, `DESIGN.md`, demo labels, user-visible copy) may stay in **British English** (`colour`, `normalise`, etc.).

## Reuse the design system

- Use CSS custom properties from `app/tokens.css` (`--bg`, `--surface`, `--input-bg`, `--accent`, `--accent-hover`, `--accent-fg`, etc.)
- Fork brand colour: override `--accent` (and `--accent-fg` when needed) in `app/css/app.css` — see **`manage-color`**; do not edit `tokens.css` in a fork for primary colour
- Use existing component classes: `.btn`, `.btn-primary`, `.modal`, `.banner`, `.callout`, `.popover`, `.section-panel`, `.code-block`, `.theme-toggle`
- Add or edit inline UI icons in `app/utils/icons-framework.js` (catalogue) or `app/utils/icons-app.js` (fork) only — do not duplicate SVG paths in HTML
- Do not introduce parallel styling systems (Tailwind, CSS-in-JS, component libraries)

## Page boot conventions

Every HTML entry point should:

1. Include blocking `app/theme-init.js` in `<head>` (prevents theme flash)
2. Link `app/styles.css` (fork entry: `tokens.css` → `css/framework.css` → `css/app.css`)
3. Call `initShell()` from `app/shell/shell.js` as the first step in the page module

`initShell()` renders shared chrome via `renderPageShell()` (`app/shell/render-shell.js`), then boots icons, external links, heading links, title numbering, theme toggle, sticky chrome offsets, tooltips, and page navigation. Do **not** duplicate footer, theme toggle, or `#page-nav` markup in HTML.

Optional `renderPageShell({ repoUrl, appUrl, alsoSee, alsoSeeUrl, alsoSeeTopics, alsoSeeIncludeLocal })` overrides for forks. Pass `alsoSee: false` or `alsoSee: []` to contribute no local links. Set `alsoSeeUrl` to a JSON URL (topic sections and/or flat links) to load a shared live list. Optional `order` on topics/links sorts ascending (ungrouped flat links always last). Optional `iconSvg` / `iconSvgLight` / `iconSvgDark` embed sanitized inline SVG (wins over URL icons). Optional `accent` / `accentHover`, or `accentLight` / `accentDark` (and hover) theme pairs: `accent*` scopes menu item highlight chrome; `accentHover*` is for the also-see trigger (item hover/press still use `--accent`). Local `alsoSee` is included only when `alsoSeeIncludeLocal: true` (alone if there is no remote, or merged with remote — same topic names share one section); it is never used as a fallback and is not filtered by `alsoSeeTopics`. Set `alsoSeeTopics` to filter the **remote** list only: `["*"]` = all topics (only `"*"` means all); `"-Topic"` excludes; named strings whitelist; `""` includes ungrouped; `[]` (or no include entries) = none. Set `appUrl` to this app’s public site URL so a matching entry in the list is omitted.

## Module conventions

| Pattern | Use for |
| -------- | ------- |
| `initX({ … })` | Single instance (dialog, combo, dropdown, expand, tab) |
| `initXs(root)` | Scan a subtree for blocks (e.g. `initTabs`, `initExpands`, `initAccordions`, `initCodeBlocks`) |
| `initShell()` | Standard page boot (footer, theme, page nav, tooltips, external links, heading links, also-see) |
| `initAlsoSee(root)` | Footer “also see” related-apps menu — no-op when disabled |
| `initExternalLinks(root)` | Append arrow-outward icon to external links |
| `initHeadingLinks(root)` | Copy-link button on `main :is(h2, h3)[id]` headings. Disable with `initShell({ headingLinks: false })` or `data-no-heading-links` on `<html>`; per heading `data-no-heading-link`. |
| `initCodeBlocks(root)` / `initCodeBlock(el)` | Prism code blocks with toolbar/surface actions, modes, copy/paste |
| `initExpandableSurfaces(root)` | Maximize `[data-expandable-surface]` to page-width overlay |
| `showBanner()` / `hideBanner()` | Show or hide `.banner` elements; respects `data-banner-expire` |
| `initTooltips()` / `flashTooltip()` / `showPersistentTooltip()` / `dismissPersistentTooltip()` | Hover tips; timer reaction when in-place is not possible; persistent tips — see [`DESIGN.md`](DESIGN.md) |
| `initPopover()` | Anchored speech-bubble card with notch, title, body, and actions |
| `initTutorial()` | Guided spotlight tour over a JS step script (uses popover); optional `when` / nested `steps` branches; multiple scripts per page, one active |
| `initPageNav()` / `initPageNavPanel()` | Page nav only — requires `PAGE_NAV_MARKUP` from `app/shell/render-shell.js` |
| `initStickyChrome()` / `setStickyHeader()` / `setStickySectionHeadings()` | Optional sticky site header and section headings (`data-sticky-header`, `data-sticky-section-headings`) |
| `initTitleNumbering()` / `setTitleNumbering()` / `syncTitleNumbering()` | Optional hierarchical outline prefixes (`data-title-numbering`) |
| `initTab()` / `initTabs()` | Single tabbed section vs every `.tabs` block |
| `setHidden()` / `parseBooleanAttr()` | Toggle visibility — always sets **both** `.hidden` class and `hidden` attribute; parse HTML boolean `data-*` values |
| `prepareButtonLabelFlash()` / `setButtonLabelFlash()` / `flashButtonLabel()` / `cancelButtonLabelFlash()` | In-place labeled button flashes (Copy → Copied); `lockWidth` defaults on — see [`button-label.js`](app/utils/button-label.js) |
| `initPopupMenu()` | Anchored popup menus (combo chevron, dropdown) |
| `initDropdown()` / `initToggleDropdown()` | Single-select vs multi-select toggle dropdown menus |
| `initCombobox()` / `initComboboxes()` | Text input with filterable autocomplete list; `data-combobox-multi` for multi-select (comma summary + badge) |
| `initFileDropzone()` / `initFileDropzones()` | Drag-and-drop / browse file picker |
| `initFileDownload()` / `initFileDownloads()` | Click-to-download generated files |
| `initImagePreview()` / `initImagePreviews()` | Checkerboard image preview (SVG / URL / Blob); optional maximise, download, dimensions / file-size / SMIL frame+duration meta |
| `initDatePicker()` / `initDatePickers()` | Calendar popup with optional side-by-side time panel |
| `initTimePicker()` / `initTimePickers()` | Editable time field with segmented popup; optional seconds / quick actions |
| `initDurationInput()` / `initDurationInputs()` | Segmented duration field with the shared popup in duration mode |
| `initSlider()` / `initSliders()` | Range slider with editable value (integer, decimal, percentage) |
| `initProgressBar()` / `initProgressBars()` | Progress bar with optional percent or fraction label |
| `initSpinner()` / `initSpinners()` | Loading spinner; optional blocking overlay on a host |
| `initStepper()` / `initSteppers()` | Numeric nudger with decrement/increment buttons |
| `initColorInput()` / `initColorInputs()` | Hex colour input with inline swatch preview; optional alpha; optional `openOnClick` / `openTrigger` for a paired colour set / picker |
| `initColorSet()` / `initColorSets()` | Named palette gallery; popup or embedded; optional set whitelist |
| `initColorPicker()` / `initColorPickers()` | Spectrum / channel colour picker; format-dependent UI; optional colour set |
| `initToggle()` / `initToggles()` | On/off switch control; optional `data-toggle-tristate` with `data-toggle-tristate-cycle` (`default`, `on-mixed`, `mixed-both`) |
| `initToggleButton()` / `initToggleButtons()` | `.btn-toggle` pressed state; optional next-action label/icon swap with `data-toggle-button-always-active` keeping the default button look |
| `initTriStateCheckbox()` / `initTriStateCheckboxes()` | Tri-state checkbox (`data-checkbox-tristate`) — unchecked → checked → mixed |
| `initBadge()` / `initBadges()` | Corner badge on a `.badge-host` (normal readout or `.badge--sm` dot) |
| `initChipGroup()` / `initChipGroups()` | Selectable filter chips (toggle pressed; not removable) |
| `initChipInput()` / `initChipInputs()` | Text field that adds removable chips |
| `initLegend()` / `initLegends()` | Coloured legend chips (optional toggle; slots `--1`…`--8` or `--legend-color`) |
| `initSegmentedControl()` / `initSegmentedControls()` | Segmented control (toggle button group); optional `.segmented-control--slim` |
| `initPagination()` / `initPaginations()` | Client-side pagination (numbered pages, no URL change) |
| `initTable()` / `initTables()` | Data table with optional sortable columns (Shift+click multi-sort) and row selection |
| `initTabularInput()` / `initTabularInputs()` | Editable typed grid; paste; reset; add/remove rows and columns; rename / type |
| `initProgressIndicator()` / `initProgressIndicators()` | Multi-step wizard with indicators, panels, and back/next |
| `initAboutDialog()` | Tagline “What?” dialog with progressive Huh? / Uhh… stages (wraps `initDialog`) |
| `initRichTextEditor()` / `initRichTextEditors()` | Toast UI rich text editor (Markdown + WYSIWYG); requires vendor scripts |
| `initChart()` / `initCharts()` | TanStack Charts host (`mountChart`); requires vendored ESM + import map for `d3-scale` / `d3-shape` when using bars |
| `initDiagram()` / `initDiagrams()` | Mermaid text→SVG host; requires vendored ESM + chunks under `app/vendor/mermaid/` |
| `onDocumentClickOutside()` / `onDocumentEscape()` | Shared document listeners — do not add per-instance `document` listeners for these |
| `registerOpenPopup()` / `unregisterOpenPopup()` / `openPopupGroup()` | One anchored popup open at a time (menus, pickers, combobox lists) |

### Document listeners

`app/utils/document-listeners.js` registers **one** click and one keydown handler on `document`. Modules register callbacks:

- **Click outside:** all handlers run on every click (menus close when click is outside)
- **Escape:** handlers sorted by priority (higher first). Return `true` when handled. Tutorials use priority `110`, dialogs `100`, expandable surfaces `90`, menus / popovers use `50`.

When a module registers listeners, store and call the returned unsubscribe in `destroy()` if provided.

### One popup at a time

Anchored popups (dropdown / combo menus, combobox lists, date, time, duration, colour set, and colour picker popups) also register with the same module:

- Call `registerOpenPopup(close)` when opening — it closes every other open popup first
- Call `unregisterOpenPopup(close)` when closing and in `destroy()`
- The closer is invoked as `close({ restoreFocus: false })`, so a peer never steals focus
- Wrap a multi-popup open in `openPopupGroup(() => …)` when two popups belong together (colour input `open="both"`)

Triggers call `stopPropagation`, so outside-click alone cannot close peers — new popup components must register.

### Visibility

Always use `setHidden()` from `app/utils/dom.js` when showing/hiding elements programmatically. Do not toggle `.hidden` alone.

### Icons

- Declare icons with `data-icon="name"` and optional `data-icon-class="…"` in HTML
- Call `initIcons()` (via `initShell()`) to inject SVGs
- **Agents must not invent or generate SVG paths** — see [`.cursor/rules/icons.mdc`](.cursor/rules/icons.mdc). If an icon is missing, reuse an existing id / `{ ref }`, or follow the [`add-icon`](.cursor/skills/add-icon/SKILL.md) skill to pull from Icônes (ask for app id + framework catalogue vs app if needed). Blank stubs via [`handle-assets`](.cursor/skills/handle-assets/SKILL.md) when the user will supply custom artwork.
- Users / agents add icon entries in `icons-app.js` / `icons-framework.js` only — `icons.js` merges them; do not duplicate SVG paths in HTML
- Prefer [Icônes — Google Material Icons (Round)](https://icones.js.org/collection/ic?s=info&variant=Round) via `add-icon`; Material Symbols Rounded is the fallback. Set `name` to the collection id and `attribution` from `ICON_ATTRIBUTIONS`
- For sourced icons, set `name` to the original collection id (e.g. `round-info`) — metadata for traceability; omit for custom or in-house icons. The merged `ICONS` object key remains the app id used in `data-icon`
- To alias one app id to another, use `{ ref: "other-icon" }` instead of duplicating markup (e.g. `lines: { ref: "note" }`)
- Third-party icons that require a license notice: set `attribution` on the icon definition (use `ICON_ATTRIBUTIONS` for common sets). Rendered as an SVG comment via `createIcon()` / `initIcons()`

## CSS structure

| File | Contents |
| ---- | -------- |
| `app/styles.css` | Fork-owned entry — `@import` tokens, `css/framework.css`, `css/app.css` |
| `app/css/framework.css` | Framework partial index (regenerated by sync; full catalogue here) |
| `app/css/app.css` | Fork-owned app styles (empty in the framework) |
| `app/tokens.css` | Reset, `:root` tokens, dark theme, base typography, `.hidden`, reduced-motion |
| `app/css/layout.css` | Page shell, sections, content tiers, section panels, page nav, footer, theme toggle |
| `app/css/code-block.css` | Code blocks and expandable surfaces |
| `app/css/controls-buttons.css` | Toolbar, buttons |
| `app/css/controls-badges.css` | Corner badges on controls and labels |
| `app/css/controls-chips.css` | Selectable / removable chips and coloured legend chips |
| `app/css/controls-fields.css` | Fields, combobox, date/time |
| `app/css/controls-widgets.css` | Toggle, segmented control, pagination, progress bar, spinner, slider, stepper, color input |
| `app/css/controls-section-panel.css` | Section panel grid rows |
| `app/css/controls-menus.css` | Combo button, dropdown menus |
| `app/css/controls-disclosure.css` | Expand, accordion, tabs, progress indicator |
| `app/css/controls-file.css` | File dropzone, file download |
| `app/css/controls-image.css` | Image preview (checkerboard host) |
| `app/css/controls-color.css` | Color set gallery and color picker |
| `app/css/controls-charts.css` | TanStack Charts host |
| `app/css/controls-diagram.css` | Mermaid diagram host |
| `app/css/overlays.css` | Banners, tooltips, popovers, modals |
| `app/css/tutorial.css` | Tutorial spotlight overlay and step chrome |
| `app/css/rich-text-editor.css` | Rich text editor field layout and Toast UI token overrides |
| `app/css/table.css` | Data table layout, sort controls, and selection column |
| `app/css/controls-tabular-input.css` | Editable typed grid (tabular input) |

Keep HTML linking only `styles.css`. Edit tokens, `app/css/app.css`, or the relevant partial under `app/css/`; do not merge back into a monolith. Trimming partials updates `framework.css` (or sync regenerates it).

### Demo vs shared layout

- **Shared layout** (usable in forks): `.content-section`, `.content-tier` / `.content-tier-header` / `.segment-title` / `.content-tier-lead` / `.content-tier-body`, `.section-title`, `.section-panel`, `.panel-title` / `.panel-hint` / `.panel-row` / `.panel-inline` / `.panel-grid`, `.panel-split` / `.panel-divider` / `.panel-stack`, `.callout`, …
- **Demo-only helpers** (catalogue wiring and visualisation): `.demo-colour-*`, `.demo-banner-*`, and demo element ids — fine in `demo.html` / `app/demo.js`
- Shell and shared CSS/JS must **not** select `demo-*` classes. If sticky, page-nav, or other chrome depends on markup, use generic names and document them in `USAGE.md`. See [`.cursor/rules/demo-isolation.mdc`](.cursor/rules/demo-isolation.mdc).

## JS module layers

Modules live under `app/shell/`, `app/utils/`, and `app/components/` (no build step). Use this mental model when adding or trimming files:

| Layer | Examples | Role |
| ----- | -------- | ---- |
| Entry | `main.js`, `demo.js`, `theme-init.js`, `config.js`, `version.js` | Loaded directly from HTML |
| Shell | `app/shell/shell.js`, `render-shell.js`, `theme.js`, `page-nav.js`, `sticky.js`, … | Shared page chrome via `initShell()` |
| Infrastructure | `app/utils/dom.js`, `document-listeners.js`, `clipboard.js`, `button-label.js`, `icons.js` (+ `icons-framework.js` / `icons-app.js`), `menu.js`, `brand-icon.js` | Shared helpers and registries |
| Components | `app/components/dialog.js`, `dropdown.js`, `tabs.js`, `code-block.js`, … | One `initX` (or `initXs`) per feature — import only what you need |
| Vendor | `app/vendor/**` | Upstream bytes only (UMD / ESM trees). Never put framework wrappers here |

### Vendor access

`app/components/` is for product components only. The owning component talks to its vendor directly (UMD global or relative ESM import) and documents version / load order in its header. Do **not** add a per-vendor seam file under `components/` when only one feature uses that library. Extract shared accessors to `app/utils/` only when **two or more** components need them. See [`.cursor/rules/vendor.mdc`](.cursor/rules/vendor.mdc).

Respect `prefers-reduced-motion: reduce` — transitions live in components; global overrides are in `tokens.css`. JS scroll behaviour should use `prefersReducedMotion()` from `app/utils/dom.js`.

## Development

After cloning, run `npm ci`, then:

```bash
npm run lint
npm test
```

CI runs the same checks on push and pull requests (`.github/workflows/ci.yml`). Framework maintainers regenerate `framework-manifest.json` with `npm run manifest:framework` when the catalogue or hashed files change (including `.cursor/skills/` and `.cursor/rules/`). Forks pin a revision in `framework.lock.json` (`components` + `skills`) and use `npm run sync:framework` / `npm run verify:framework`. Details: [USAGE.md — Framework lock, manifest, and upgrades](USAGE.md#framework-lock-manifest-and-upgrades).

## Keep GitHub Pages deployable

- Entry HTML files live at the repo root (`index.html`, optional pages like `demo.html`)
- Shared assets live under `app/`
- Avoid features that require a backend or server-only APIs
- ES modules need a local server for development (`npx serve .`) — document if adding fetch-based features

## Match aesthetics

Match the established look (based on [pqm-stepper](https://github.com/filcuk/pqm-stepper)):

- GitHub-inspired palette and 6px border radii
- System UI font stack
- Light / dark / auto theme via `data-theme` on `:root`
- Blocking `app/theme-init.js` in `<head>` to prevent flash of wrong theme

### Action feedback

Follow [`DESIGN.md`](DESIGN.md): prefer **in-place** label flashes when the control can show the outcome (Copy → Copied) via `flashButtonLabel()` and `.btn-label-flash`. Use timer-mode `flashTooltip()` with `tone: "success" | "error"` when in-place is not an option (icon-only controls). Use **banners** when page-level status is requested.

### Selection highlights

Two styles ([`DESIGN.md`](DESIGN.md)): **standard** (accent border + tinted background; neighbouring selected items join under one outer border — default for controls/lists) and **light** (lighter background only — theme switch). Match an existing control; do not invent a third look.

## Accessibility

- Dialogs: focus trap, Escape to close (via document listener), restore focus, `aria-modal` and labelled titles
- Toggle buttons: `aria-pressed` where state toggles
- Tooltips: hover / timer share one `#tooltip` slot; persistent tips are separate; `aria-describedby` linking; keyboard focus support for hover tips
- Prefer semantic HTML (`header`, `main`, `footer`, `button`)
- Popup menus: `aria-expanded` on toggle buttons
- Page nav: outer `<nav aria-label="Page navigation">`; jump buttons have `aria-label`; section links are plain anchors with hash `href`; use `data-page-nav-tier` on group headings for nested nav lists

## When extending this framework

1. Read `USAGE.md` for available components and fork instructions; read `DESIGN.md` for interaction philosophy
2. Check `demo.html` for usage examples
3. Keep changes focused — one concern per file when possible
4. Update `USAGE.md` when you add or change a reusable component, module API, or deploy workflow (see `.cursor/rules/usage-docs.mdc`)
5. Update `AGENTS.md` if you add a new `initX` pattern to the module conventions table
6. For a new catalogue component, follow the **`author-component`** skill and update `.cursor/skills/_shared/component-map.md`
