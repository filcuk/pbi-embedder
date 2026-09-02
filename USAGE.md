# Usage guide

How to fork this framework into your own app, deploy it, and use the design system components.

## Creating a new app from this framework

Cursor agents can drive this with skills under [`.cursor/skills/`](.cursor/skills/): **`init-app`** (fork setup), **`handle-assets`** (logos/icons — user supplies files), **`manage-color`** (primary accent + contrast), **`finalize-app`** (trim unused components before ship), plus migrate/sync/restore helpers listed in [`AGENTS.md`](AGENTS.md#lifecycle-skills). How lock, manifest, sync, and deprecate/retire work is documented in [Framework lock, manifest, and upgrades](#framework-lock-manifest-and-upgrades). Forks created before framework lock/versioning should follow [How to bootstrap pre-v0.9.0 upgrades](#how-to-bootstrap-pre-v090-upgrades).

### 1. Create the repository

1. Click **Use this template** on GitHub (or clone this repo).
2. Rename the repository for your app.

### 2. Customize the homepage

Edit [`index.html`](index.html):

- `<title>`, header `<h1>`, and `.tagline`
- Replace the `<main>` content with your app UI
- Remove the link to `demo.html` when you drop the demo page (see below)
- Swap logo files under `app/res/` or update the `<img>` paths

Wire your page logic in [`app/main.js`](app/main.js). Every HTML entry point should follow the same boot pattern:

```html
<script src="app/theme-init.js"></script>
<link rel="stylesheet" href="app/styles.css" />
<!-- …your content… -->
<script type="module" src="app/main.js"></script>
```

```javascript
import { initShell } from "./shell/shell.js";

initShell(); // footer, theme toggle, page nav, tooltips, icons, links
// …your app-specific inits…
```

Optional shell overrides (repo link, related apps, page nav scan, heading links):

```javascript
initShell({
  repoUrl: "https://github.com/you/your-app",
  appUrl: "https://you.github.io/your-app/",
  alsoSee: false, // or [] — hide the footer “also see” menu when no remote list
  alsoSeeUrl: "", // optional remote JSON (topics + links)
  alsoSeeTopics: ["*"], // remote filter: ["*"]=all; ["*","-Topic"]=all except; ["A",""]=whitelist
  alsoSeeIncludeLocal: false, // true = include local alsoSee in full (alone or merged with remote)
  pageNav: { headingSelector: "main :is(h2, h3)[id]" },
  // pageNav: false, // disable page navigation
  // headingLinks: false, // disable copy-link icons (or data-no-heading-links on <html>)
});
```

### App and framework versions

Versions use [Semantic Versioning 2.0.0](https://semver.org/) and live in [`app/version.js`](app/version.js):

```javascript
export const FRAMEWORK_VERSION = "0.6.0"; // SMA1 Framework release — sync with app/version.js
export const APP_VERSION = "0.0.0";      // your app — bump when you ship
```

| Constant | Who sets it | Shown in UI |
| -------- | ----------- | ----------- |
| `APP_VERSION` | You, on your fork | Footer label (`v0.0.0`) |
| `FRAMEWORK_VERSION` | Framework maintainers | Footer tooltip on hover/focus (`SMA1 Framework v0.6.0`) |

After forking, set `APP_VERSION` to your app’s release (e.g. `1.0.0`). Bump it when you publish a new version of **your** app. When you pull updates from the upstream framework, the maintainer may have raised `FRAMEWORK_VERSION` — hover the footer version to see which framework release you are on.

Optional runtime override (rare):

```javascript
initShell({ appVersion: "1.2.3", frameworkVersion: "0.6.0" });
```

### Configuration

Fork-sensitive defaults live in [`app/config.js`](app/config.js):

```javascript
export const APP_CONFIG = {
  repoUrl: "https://github.com/you/your-app",
  appUrl: "https://you.github.io/your-app/", // public Pages URL — omitted from “also see”
  themeStorageKey: "microapp-theme",
  themeChangeEvent: "microapp-theme-change",
  // Remote JSON for footer “also see” — empty skips fetch (local only when alsoSeeIncludeLocal)
  alsoSeeUrl: "", // e.g. "https://raw.githubusercontent.com/you/shared/main/apps/links.json"
  alsoSeeTopics: ["*"], // remote filter: ["*"]=all; ["*","-Topic"]=all except; ["A",""]=whitelist
  alsoSeeIncludeLocal: false, // true = include local alsoSee in full (alone or merged with remote)
  // Local related apps — only used when alsoSeeIncludeLocal is true
  alsoSee: [
    {
      topic: "Examples",
      order: 10,
      items: [
        {
          label: "Example App A",
          subtitle: "Sample related microapp",
          url: "https://example.com/app-a",
          iconLight: "app/res/app-light.svg",
          iconDark: "app/res/app-dark.svg",
          order: 10,
        },
      ],
    },
  ],
};
```

| Field | Used by |
| ----- | ------- |
| `repoUrl` | Footer GitHub / issues links via `renderPageShell()` |
| `appUrl` | Public site URL; matching entries are dropped from “also see” |
| `alsoSeeUrl` | Optional remote JSON for footer “also see”; empty skips fetch |
| `alsoSeeTopics` | Filters **remote** only: `["*"]` = all; `"-Topic"` excludes; named whitelist; `""` = ungrouped; `[]` = none |
| `alsoSeeIncludeLocal` | When `true`, include local `alsoSee` in full (alone or merged with remote); when `false`, local is never shown |
| `alsoSee` | Local footer “also see” list (only when `alsoSeeIncludeLocal` is true) |
| `themeStorageKey` | `theme.js` and blocking `theme-init.js` |
| `themeChangeEvent` | Theme changes; rich text editor syncs to dark mode |

If you rename `themeStorageKey`, update the inline bridge in every HTML entry point **before** `theme-init.js`:

```html
<script>window.__MICROAPP__={themeStorageKey:"your-app-theme"};</script>
<script src="app/theme-init.js"></script>
```

Also set `APP_VERSION` in [`app/version.js`](app/version.js) when you ship your app.

### 3. Remove or keep the demo

The demo is for exploring components — not required for your app.

| Keep as reference | Remove when shipping |
| ----------------- | -------------------- |
| [`demo.html`](demo.html) | Delete `demo.html` |
| [`app/demo.js`](app/demo.js) | Delete `app/demo.js` |
| Prism vendor + `app/prism.css` (only if you do not use code blocks) | `app/vendor/prism/`, `app/prism.css` |
| Toast UI vendor + `app/toastui-editor.css` (only if you do not use the rich text editor) | `app/components/rich-text-editor.js`, `app/toastui-editor.css`, `app/css/rich-text-editor.css`, `app/vendor/toastui-editor/`, `app/vendor/toastui-editor-plugin-table-merged-cell/` |
| TanStack Charts vendor (only if you do not use charts) | `app/components/charts.js`, `app/css/controls-charts.css`, `app/vendor/tanstack-charts/`, `app/vendor/d3-scale/`, `app/vendor/d3-shape/` |
| Mermaid vendor (only if you do not use diagrams) | `app/components/diagram.js`, `app/css/controls-diagram.css`, `app/vendor/mermaid/` |

If you **remove** `demo.html`, update [`.github/workflows/pages.yml`](.github/workflows/pages.yml) — drop `demo.html` from the `cp` line:

```yaml
cp index.html _site/
```

If you **keep** the demo, leave the workflow as-is and optionally link to it from `index.html` while developing.

### 4. Trim unused modules (optional)

All modules under `app/` are small and tree-shaken by the browser (only imported files load). You can delete files you will never use, for example:

- `app/code-block.js`, `app/expandable-surface.js`, `app/vendor/prism/` — no syntax-highlighted code
- `app/components/rich-text-editor.js`, `app/toastui-editor.css`, `app/vendor/toastui-editor/`, `app/vendor/toastui-editor-plugin-table-merged-cell/` — no rich text editor
- `app/components/charts.js`, `app/css/controls-charts.css`, `app/vendor/tanstack-charts/`, `app/vendor/d3-scale/`, `app/vendor/d3-shape/` — no charts
- `app/components/diagram.js`, `app/css/controls-diagram.css`, `app/vendor/mermaid/` — no diagrams
- `app/combo.js`, `app/dropdown.js`, `app/dropdown-toggle.js` — no menus
- `app/dialog.js` — no modals

Do **not** delete shared infrastructure you still need: `shell.js`, `render-shell.js`, `theme-init.js`, `theme.js`, `icons.js`, `dom.js`, `document-listeners.js`, `menu.js` (if any popup menu remains).

### 5. Branding

| Asset | Purpose |
| ----- | ------- |
| `app/res/app-light.svg` + `app-dark.svg` **or** `app/res/app.svg` | Header logo, favicon |

**App logo — pair (default)** or **single**:

| Mode | Files | Config (`APP_ICON_SRC` in [`brand-icon.js`](app/utils/brand-icon.js) and/or `window.__MICROAPP__`) | Header markup |
| ---- | ----- | --- | --- |
| Pair | `app-light.svg`, `app-dark.svg` | `light` / `dark` set (default); `icon` empty | Two `<img class="site-logo brand-icon--light\|dark">` (see `index.html`) |
| Single | `app.svg` | `icon: "app/res/app.svg"`, `light`/`dark` (and `__MICROAPP__` `appIconLight`/`appIconDark`) `""` | One `<img class="site-logo" src="app/res/app.svg">` (no `brand-icon--*` classes) |

Set `__MICROAPP__.appIcon` / `appIconLight` / `appIconDark` in the HTML bridge (before `theme-init.js`) so the favicon is correct before modules load. [`brand-icon.js`](app/utils/brand-icon.js) reads the same keys and keeps the favicon in sync on theme change. If both a single `icon` and a light/dark pair are configured, the pair wins.

Theme-aware swapping for pair mode is handled in CSS (`brand-icon--light` / `brand-icon--dark`). Replace the SVG files or edit the paths above.

For pair-mode header logos, set a meaningful `alt` on the visible theme variant and `aria-hidden="true"` on the duplicate variant so screen readers are not announced twice.

**Primary accent** — set light and dark `--accent` in [`app/css/app.css`](app/css/app.css) (fork-owned; sync will not overwrite it). `--accent-hover` is derived in [`tokens.css`](app/tokens.css) via `color-mix`. Set `--accent-fg` so text/icons on accent fills meet WCAG AA (≥ 4.5:1). Agents: use the **`manage-color`** skill.

### 6. Checklist before first deploy

- [ ] `index.html` title, heading, and content updated
- [ ] `APP_VERSION` set in `app/version.js` for your app
- [ ] `app/main.js` implements your app (not just `initShell()`)
- [ ] Demo removed or intentionally kept
- [ ] `pages.yml` matches published HTML files
- [ ] GitHub **Settings → Pages → Source** set to **GitHub Actions**

---

## How to bootstrap pre-v0.9.0 upgrades

Forks created before lock/versioning lack `framework.lock.json`, the sync scripts, and `.cursor/skills/`. For a **one-time** bootstrap, copy those from a current [SMA1 Framework](https://github.com/filcuk/sma1-framework) checkout (or tagged release) into the fork. After that, rely on lock + sync — do not keep re-copying the whole `.cursor/skills/` tree by hand (that would overwrite fork-local skills).

| Copy | Purpose |
| ---- | ------- |
| `.cursor/skills/` and `.cursor/rules/` | Agent playbooks and framework rules (later refreshed by sync) |
| `scripts/sync-framework.mjs`, `scripts/verify-framework.mjs`, `scripts/lib/` | Sync / verify tooling |
| `scripts/generate-framework-manifest.mjs` (optional on forks) | Only needed if you regenerate manifests locally |

Ensure `package.json` has `"type": "module"` and:

```json
{
  "scripts": {
    "sync:framework": "node scripts/sync-framework.mjs",
    "verify:framework": "node scripts/verify-framework.mjs"
  }
}
```

Add `framework.lock.json` (use `"components": ["*"]` for a full catalogue, or list only what the app uses):

```json
{
  "schemaVersion": 2,
  "frameworkVersion": "0.9.0",
  "source": "filcuk/sma1-framework",
  "components": ["*"],
  "skills": ["*"]
}
```

Then run the **`migrate-framework`** skill (or `npm run sync:framework -- --version 0.9.0` + `npm run verify:framework`) to pull the tagged framework release into the fork. See [Framework lock, manifest, and upgrades](#framework-lock-manifest-and-upgrades) for ongoing upgrades.

---

## Framework lock, manifest, and upgrades

How forks stay aligned with a tagged SMA1 Framework release without clobbering app-owned work.

### Versions

| Constant | File | Who bumps |
| -------- | ---- | --------- |
| `FRAMEWORK_VERSION` | `app/version.js` | Framework maintainers; sync updates it on the fork |
| `APP_VERSION` | `app/version.js` | App authors on the fork (sync preserves it) |

Fetch-based sync requires a git tag `vX.Y.Z` on the upstream framework that matches `framework.lock.json` → `frameworkVersion`. Local checkouts can use `npm run sync:framework -- --from /path/to/sma1-framework`.

### Manifest (`framework-manifest.json`)

Generated by `npm run manifest:framework` from [`scripts/lib/framework-catalogue.mjs`](scripts/lib/framework-catalogue.mjs) (`schemaVersion` **2**). It records:

- **Hashed files** — SHA-256 (LF-canonical) for framework-owned `app/` paths plus listed Cursor agent skills/rules under `.cursor/`
- **Component graph** — stable ids, `files` / `css` / `vendor` / `icons` / `infra`
- **Agent catalogue** — `agent.skills` and `agent.rules`
- **App-owned** paths sync must never overwrite (`appOwned`)
- **Derived** — e.g. `app/css/framework.css` regenerated from the selected CSS index
- **Lifecycle maps** — `deprecated` and `retired` (usually empty)

### Lock (`framework.lock.json`)

Fork pin for what to install:

```json
{
  "schemaVersion": 2,
  "frameworkVersion": "0.9.0",
  "source": "filcuk/sma1-framework",
  "components": ["*"],
  "skills": ["*"]
}
```

| Field | Meaning |
| ----- | ------- |
| `components` | Catalogue ids to install, or `["*"]` for the full set. Always-on shell pieces are added automatically. |
| `skills` | Agent skill ids to install (`["*"]` default when omitted on schema v2). Support `-id` exclusions (e.g. `["*", "-release-framework"]`). Rules under `.cursor/rules/` always sync when any skill is selected. |
| `source` | GitHub `owner/repo` used by `--version` fetch |
| `frameworkVersion` | Target framework SemVer (without the `v` prefix) |

### Sync

```bash
npm run sync:framework -- --version X.Y.Z
npm run sync:framework -- --from ../sma1-framework
npm run sync:framework -- --from ../sma1-framework --prune
npm run sync:framework -- --from . --dry-run
```

Sync copies every path in the lock selection from upstream, regenerates `app/css/framework.css`, merges `APP_VERSION` into `app/version.js`, and refreshes the lock (preserving `skills` and other fork fields). It does **not** overwrite app-owned paths and does **not** delete fork-local `.cursor/skills/<other-id>/` folders.

`--prune` deletes `previousFiles` from live moves and paths listed on **retired** ids, unless an app-owned file still references the path (then sync warns and skips).

### Verify

```bash
npm run verify:framework
```

| Result | Effect on exit / CI |
| ------ | ------------------- |
| `modified` / `missing` / `unexpected` on catalogue `app/` files | **Hard fail** (`ok` false) |
| `agentModified` / `agentMissing` on skills/rules | **Soft** — reported only; does not fail CI |
| Warnings | Deprecated ids still selected; prune candidates still on disk |

### Stable ids

Components and skills are selected by **id** (usually matching the file or folder name: `dialog`, `init-app`). Paths can move; the id is what the lock tracks. Renames keep the id and list old paths in `previousFiles`.

### Moves, deprecate, and retire

1. **Same-id move** — update live `files`; put the old path in `previousFiles`; run sync, then `--prune` when ready.
2. **Deprecated** — id still ships; manifest marks it deprecated (`deprecatedIn`, optional `replacedBy`). Forks get a verify warning.
3. **Retired** — id removed from the live catalogue; `retired` entry must include `deprecatedIn` from an earlier release, plus `retiredIn` and `previousFiles`. Sync with `--prune` removes those files when safe.

**Retired / `previousFiles` paths must never be reused** by a new live file. Manifest generation rejects overlaps.

### Customising framework skills

Do not edit a framework skill in place (the next sync overwrites it). **Fork** it:

1. Copy `.cursor/skills/<id>/` to a new folder id.
2. Change frontmatter `name` and `description` so agents pick the fork copy.
3. Exclude the original: `"skills": ["*", "-init-app"]`.

### Agent-driven upgrades

Prefer the **`migrate-framework`** skill for version bumps (partial or full). It also asks whether to check new changelog additions against local app workarounds and, if so, offers each match individually to switch onto the framework API. **`sync-shell`** is a lighter path for chrome/tokens only and does **not** refresh agent skills/rules.

---

## Local preview

ES modules require a local server (opening `index.html` directly may block imports):

```bash
npx serve .
```

Optional quality checks (requires `npm ci` once):

```bash
npm run lint
npm test
npm run manifest:framework   # regenerate framework-manifest.json after catalogue changes
npm run verify:framework     # check tree vs framework.lock.json + manifest hashes
# npm run sync:framework -- --from ../sma1-framework
# npm run sync:framework -- --version 0.9.0
# npm run sync:framework -- --from ../sma1-framework --prune
```

Forks that predate lock/sync should bootstrap first — see [How to bootstrap pre-v0.9.0 upgrades](#how-to-bootstrap-pre-v090-upgrades). Day-to-day upgrades: [Framework lock, manifest, and upgrades](#framework-lock-manifest-and-upgrades).

Then open `http://localhost:3000` and, if kept, `http://localhost:3000/demo.html`.

Maintainer tooling for regenerating README demo scroll media is documented in **[DEVELOPMENT.md](DEVELOPMENT.md)**.

---

## GitHub Pages deployment

1. Push to `main` (includes [`.github/workflows/pages.yml`](.github/workflows/pages.yml)).
2. In the repo **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**.
3. After the workflow runs, the site is at `https://<username>.github.io/<repo>/`.

The workflow copies only publishable files into `_site/` (`index.html`, optional `demo.html`, `.nojekyll`, `app/`). `README.md`, `USAGE.md`, and other repo files are not published.

---

## Project structure

```
index.html          # Your app homepage
demo.html           # Component showcase (optional)
.nojekyll           # Skip Jekyll on GitHub Pages
framework-manifest.json  # SHA-256 + component/agent graph (npm run manifest:framework)
framework.lock.json      # Fork pin: frameworkVersion + components + skills
.cursor/
  skills/               # Template agent playbooks (hashed + synced; fork-local ids untouched)
  rules/                # Template Cursor rules (hashed + synced)
app/
  styles.css            # Fork entry: tokens.css → css/framework.css → css/app.css
  tokens.css            # Design tokens, base typography, reduced motion
  css/
    framework.css        # Framework partial index (sync regenerates in forks)
    app.css             # Fork-owned app styles (empty in the framework)
    layout.css          # Page shell, sections, page nav, footer, theme toggle
    code-block.css      # Code blocks and expandable surfaces
    controls-buttons.css  # Toolbar, buttons
    controls-badges.css   # Corner badges on controls/labels
    controls-chips.css    # Selectable / removable chips; legend
    controls-fields.css   # Fields, combobox, date/time
    controls-widgets.css  # Toggle, segmented, pagination, progress, spinner, slider, stepper, color input
    controls-section-panel.css # Section panel grid
    controls-menus.css    # Combo, dropdown
    controls-disclosure.css # Expand, accordion, tabs, progress indicator
    controls-file.css     # File dropzone, file download
    controls-color.css    # Colour set / colour picker
    controls-charts.css   # TanStack Charts host
    controls-diagram.css  # Mermaid diagram host
    overlays.css        # Banners, tooltips, modals
    rich-text-editor.css # Rich text editor layout + Toast UI token overrides
    table.css            # Data tables
    controls-tabular-input.css # Editable typed grid
  config.js             # Fork defaults (repo URL, brand, theme key)
  version.js            # APP_VERSION + FRAMEWORK_VERSION (SemVer 2.0.0)
  main.js               # index.html entry
  demo.js               # demo.html entry (optional)
  shell/
    shell.js            # initShell() — shared page boot
    render-shell.js     # Footer, page nav, skip link
    also-see.js         # Footer “also see” related-apps menu
    theme.js            # Theme preference module
    page-nav.js         # In-page heading nav + jump up/down
    external-link.js    # Arrow icon on outgoing links
    heading-link.js     # Copy section link on heading hover
    sticky.js           # Optional sticky header / section headings
    title-numbering.js  # Optional hierarchical outline title prefixes
  utils/
    dom.js              # setHidden(), parseBooleanAttr(), focus helpers
    document-listeners.js # Outside click, Escape, one-popup-at-a-time registry
    menu.js             # Shared popup menu logic
    icons.js            # Inline SVG icon registry
    brand-icon.js       # Theme-aware logo paths
  components/
    dialog.js, combo.js, dropdown.js, tabs.js, …
    date-picker/        # parse.js, calendar.js, index.js
    time-picker/        # field.js, panel.js, index.js
  prism.css             # Prism token colours (optional)
  toastui-editor.css    # Vendored Toast UI base CSS (optional)
  vendor/               # Prism, Toast UI, TanStack Charts, Mermaid, d3-scale, d3-shape (optional)
  res/                  # App logo SVGs
```

### Module layers (JavaScript)

JS modules live under `app/shell/`, `app/utils/`, and `app/components/` — the browser only loads files you `import`. When forking, use this map:

| Layer | Path | When you need it |
| ----- | ---- | ---------------- |
| **Entry** | `main.js`, `demo.js`, `theme-init.js`, `config.js`, `version.js` | Always — wired from HTML |
| **Shell** | `app/shell/` | Always — call `initShell()` from `app/shell/shell.js` |
| **Infrastructure** | `app/utils/` | Keep if any popup menu, icons, or shared helpers remain |
| **Components** | `app/components/` | Import and init only the features your page uses; delete unused files |

Component CSS lives under `app/css/` (indexed by `css/framework.css`, linked via `styles.css`). Match a component to its partial: form controls in `controls-fields.css`, menus in `controls-menus.css`, modals in `overlays.css`, and so on. Put app-only rules in `css/app.css`.

#### One popup open at a time

[`app/utils/document-listeners.js`](app/utils/document-listeners.js) owns the single `document` click and Escape listeners (`onDocumentClickOutside`, `onDocumentEscape`) plus a registry that keeps only one anchored popup open. Dropdown and combo menus, combobox lists, and the date, time, colour set, and colour picker popups all take part: opening any of them closes the previous one.

A custom popup joins in by calling `registerOpenPopup(close)` when it opens and `unregisterOpenPopup(close)` when it closes (and in `destroy()`). Peers are closed as `close({ restoreFocus: false })`. Wrap opens in `openPopupGroup(() => …)` when two popups belong to one control and should stay open together — colour input with `data-color-input-open="both"` does this for its set and picker. A menu nested inside another popup can pass `registerPopup: false` to `initPopupMenu()` so it does not close its parent.

---

## Available features and components

| Feature | Description |
| -------- | ----------- |
| **Design tokens** | CSS custom properties in [`app/tokens.css`](app/tokens.css) for background, surface, section panels, `--input-bg` (form fields — lighter than page/section chrome), `--table-header-bg`, `--control-height` / `--control-height-slim` / `--control-height-micro` (standard, compact, and micro single-line controls — micro is half of standard), text, borders, accent (`--accent`, derived `--accent-hover`, `--accent-fg` on accent fills), banners, and code blocks. Light and dark values via `[data-theme="dark"]`. Override brand accent in fork-owned [`app/css/app.css`](app/css/app.css) (never edit `tokens.css` in a fork for colour — sync can overwrite it); keep `--accent-fg` at WCAG AA ≥ 4.5:1 against `--accent` (see **`manage-color`**). Component styles in [`app/css/`](app/css/) partials (indexed by [`framework.css`](app/css/framework.css); [`app/styles.css`](app/styles.css) also pulls fork-owned [`app.css`](app/css/app.css)). |
| **Press feedback** | Enabled click reactions use `:active` colour-mix (`--control-hover-mix` / `--control-selected-mix` / `--control-press-mix`) and filled button darkening (`--accent-active` / `--danger-active`). |
| **Theme toggle** | Footer control (injected by `initShell()`): light, dark, or system (`auto`). Stored in `localStorage` under `microapp-theme`. `app/theme-init.js` runs in `<head>` to avoid flash of wrong theme. |
| **Layout shell** | Semantic `header` / `main` / `footer` (footer rendered by JS), max-width 1200px, flex column page. Content grouping via `.content-section` and optional `.content-tier` bands (sticky with `.section-title` / `.segment-title` — see **Sticky chrome**). Outline: site `h1`; with tiers use `h2.segment-title` then `h3.section-title`; without tiers, `h2.section-title` is fine. App version in footer; framework version on hover. Optional footer **also see** related-apps menu in a responsive topic grid (`APP_CONFIG.alsoSee` / `alsoSeeUrl` / `alsoSeeTopics` / `alsoSeeIncludeLocal`, optional `order`, `accent` / `accentLight` / `accentDark` (and hover), and `iconSvg*`, or `initShell({ alsoSee, alsoSeeUrl, alsoSeeTopics, alsoSeeIncludeLocal })`; `[]` / `false` disables when there is no remote list). Optional sticky site header (`data-sticky-header`) and sticky section headings (`data-sticky-section-headings`) — see **Sticky chrome**. Optional hierarchical title numbering (`data-title-numbering`) — see **Title numbering**. |
| **Title numbering** | Optional `1.` / `1.1.` / `1.2.1.` prefixes on outline headings (`main :is(h2, h3, h4)[id]`). Off by default. [`app/shell/title-numbering.js`](app/shell/title-numbering.js). |
| **Buttons** | `.btn` (default / standard height), `.btn-slim` (compact `--control-height-slim`; works with labeled and icon buttons), `.btn-primary`, `.btn-danger` (destructive primary), `.btn-icon`, `.btn-toggle` (`aria-pressed` — accent border when on), `.btn-link`, disabled state. Click press feedback uses `:active` mix tint. Optional `initToggleButton` for label/icon swapping and an always-active variant that keeps the default button appearance — see **Toggle button**. |
| **Badge** | Corner indicator on a control or text: normal readout or small `.badge--sm` dot. [`app/components/badge.js`](app/components/badge.js). |
| **Chips** | Selectable filter tags and removable input chips. [`app/components/chip.js`](app/components/chip.js). |
| **Legend** | Coloured category chips for charts, code highlights, and similar; optional toggle + tooltips. [`app/components/legend.js`](app/components/legend.js). |
| **Inputs** | `.field` / `.field-label` with `.input`, `.textarea`, `.checkbox`, `.radio`, `.toggle`, `.segmented-control`, `.progress-bar`, `.spinner`, `.date-picker`, `.time-picker`, `.duration-input`, `.slider`, `.stepper`, `.color-input`, and `.combobox`. |
| **File dropzone** | `.file-dropzone` drag-and-drop / browse picker with file list and remove buttons. [`app/components/file-dropzone.js`](app/components/file-dropzone.js). |
| **File download** | `.file-download` full-width button rows with on-demand download. [`app/components/file-download.js`](app/components/file-download.js). |
| **Image preview** | Checkerboard `.image-preview` host for SVG / image URLs / Blob; optional maximise, download, and size meta. [`app/components/image-preview.js`](app/components/image-preview.js). |
| **Section panel** | Reusable padded surface (`.section-panel`) with optional compact-form grid rows, divider, submit row, and expiring banner. See **Panel layout** and **Section panel**. |
| **Panel layout** | Titles, hints, flex rows, inline groups, responsive 2/3/4-column grids, stacks, splits, and full-bleed dividers inside panels (`.panel-title`, `.panel-hint`, `.panel-row`, `.panel-inline`, `.panel-grid`, `.panel-stack`, `.panel-split`, `.panel-divider`). See **Panel layout** and **Panel split**. |
| **Combo button** | Split `.combo-btn` with main action + chevron menu; behaviour from [`app/components/combo.js`](app/components/combo.js). |
| **Combobox** | Text input with filterable suggestion list; optional multi-select (`data-combobox-multi`) with comma-separated summary and selection badge; optional auto grid list (`data-combobox-grid*`). [`app/components/combobox.js`](app/components/combobox.js). |
| **Slider** | Range control with editable value field; integer, decimal, percentage; optional disabled. [`app/components/slider.js`](app/components/slider.js). |
| **Progress bar** | Horizontal fill for a value between min and max; optional % or x/y label; optional shine; indeterminate (sweep or bounce), error (stuck) and disabled states. [`app/components/progress-bar.js`](app/components/progress-bar.js). |
| **Spinner** | Loading indicator; optional blocking overlay on a host region. [`app/components/spinner.js`](app/components/spinner.js). |
| **Stepper** | Numeric nudger with − / + buttons and editable value; integer or decimal. [`app/components/stepper.js`](app/components/stepper.js). |
| **Colour input** | Hex text input with swatch attached on the left; optional alpha (`#RRGGBBAA`); optional `openOnClick` + `openTrigger` for colour set / picker. [`app/components/color-input.js`](app/components/color-input.js). |
| **Colour set** | Named palette gallery (popup or embedded); built-in sets as one module each. [`app/components/color-set/`](app/components/color-set/). |
| **Colour picker** | Spectrum / channel colour selector (HEX / RGB / HSL / HSV / CMYK); optional alpha and adjacent colour set. [`app/components/color-picker/`](app/components/color-picker/). |
| **Date picker** | Calendar popup with an optional side-by-side time panel and shared Today / Now action bar. [`app/components/date-picker/`](app/components/date-picker/). |
| **Time picker** | Editable time-of-day field with a segmented popup, optional seconds, and 00:00 / Now actions. [`app/components/time-picker/`](app/components/time-picker/). |
| **Duration input** | Segmented hours:minutes (optional seconds) field with the shared popup in duration mode. [`app/components/duration-input.js`](app/components/duration-input.js). |
| **Toggle** | On/off switch with track and thumb; `role="switch"`. Optional `.toggle--slim` (thin track, oversized overhanging thumb, no icon). Optional tri-state (`data-toggle-tristate`) with configurable cycle (`data-toggle-tristate-cycle`). [`app/components/toggle.js`](app/components/toggle.js). |
| **Tri-state checkbox** | Checkbox that cycles unchecked → checked → mixed (`indeterminate`). [`app/components/checkbox.js`](app/components/checkbox.js). |
| **Segmented control** | Toggle button group for single selection; optional linked panels. Default height matches `.btn`; add `.segmented-control--slim` for the compact size. [`app/components/segmented-control.js`](app/components/segmented-control.js). |
| **Progress indicator** | Linear multi-step wizard; horizontal (default) or vertical step list. [`app/components/progress-indicator.js`](app/components/progress-indicator.js). |
| **Dropdown** | `.dropdown` with `.dropdown-trigger` and `.dropdown-menu`; optional `.dropdown-menu-group` headers, `.dropdown-menu-item-subtitle` context lines, leading `.dropdown-menu-item-icon-wrap` icons, and auto grid layout (`data-dropdown-grid*`). Behaviour from [`app/components/dropdown.js`](app/components/dropdown.js). |
| **Toggle dropdown** | Multi-select dropdown; items toggle with `aria-checked`, menu stays open; selection count via badge. [`app/components/dropdown-toggle.js`](app/components/dropdown-toggle.js). |
| **Expand** | `.expand` disclosure with chevron + label trigger and collapsible `.expand-panel`; behaviour from [`app/components/expand.js`](app/components/expand.js). |
| **Accordion** | `.accordion` vertical stack of collapsible sections; one open at a time by default. [`app/components/accordion.js`](app/components/accordion.js). |
| **Tabs** | `.tabs` block with `.tabs-list` / `.tabs-tab` and `.tabs-panel` content; behaviour from [`app/components/tabs.js`](app/components/tabs.js). |
| **Pagination** | In-page page navigation with prev/next and numbered pages; no URL change. [`app/components/pagination.js`](app/components/pagination.js). |
| **Table** | Data table with striped layout, sortable columns (Shift+click multi-sort), and optional row selection. [`app/components/table.js`](app/components/table.js). |
| **Tabular input** | Editable typed grid (text / number / logical); add/remove/reset; Excel/TSV paste (in-place or replace via footer buttons) with type detection; centered canvas breakout when wide. [`app/components/tabular-input.js`](app/components/tabular-input.js). |
| **Page navigation** | Fixed `#page-nav`: always-visible jump up/down (shared progress ring), section links on hover. Group nested headings under `data-page-nav-tier` parents. [`app/shell/page-nav.js`](app/shell/page-nav.js). |
| **Dialogs** | Accessible modal: backdrop, focus trap, Escape, Enter (default action), focus restore. Markup uses `.modal` / `.modal-panel`; behaviour from [`app/components/dialog.js`](app/components/dialog.js). |
| **About dialog** | Tagline “What?” opener with progressive Huh? / Uhh… simplification stages. Optional first-visit popover hint + Guided tour. [`app/components/about-dialog.js`](app/components/about-dialog.js) (wraps dialog). |
| **Heading links** | Hover a `main :is(h2, h3)[id]` heading to reveal a link icon; tooltip says “Get link”; click copies the URL and shows a timer success/error tip (icon-only — no in-place label). Disable with `initShell({ headingLinks: false })` or `data-no-heading-links` on `<html>`; skip one heading with `data-no-heading-link`. [`app/shell/heading-link.js`](app/shell/heading-link.js). |
| **External links** | Outgoing `http(s)` links get an arrow-outward icon via `initShell()` / [`app/shell/external-link.js`](app/shell/external-link.js). Opt out with `data-no-external-icon`. |
| **Tooltips** | Hover (default), timer (`flashTooltip` when in-place feedback is not possible), and persistent modes. `data-tooltip`, optional `data-tooltip-position`, `data-tooltip-tone="success\|error"`. See [`DESIGN.md`](DESIGN.md) and [`app/components/tooltip.js`](app/components/tooltip.js). |
| **Popovers** | Anchored speech-bubble card with a notch, title, body, and actions. [`app/components/popover.js`](app/components/popover.js). Prefer over tooltips when the tip needs buttons or rich content. |
| **Tutorials** | Guided spotlight tour over a JS step script (back / next / close). Dims the page except the target; optional interactive steps and `when` / nested `steps` branches. [`app/components/tutorial.js`](app/components/tutorial.js) (uses popover). |
| **Banners** | `.banner.banner-*` variants with `data-icon`. Optional style variations (`banner-question`, `banner-example`, `banner-quote`, `banner-tip`) reuse existing tokens. Optional rotation via `data-banner-variations` + `data-banner-rotate`. Auto-hide via `data-banner-expire` (ms) and [`app/components/banner.js`](app/components/banner.js) (`showBanner` / `hideBanner` / `setBannerVariation`). Expire overlay + fade-out. |
| **Callouts** | `.callout` accent-edged tip cards for standing information (CSS-only). See **Callouts** under Using components. |
| **Code blocks** | `.code-block` with Prism highlighting, configurable toolbar (top/bottom/none), hover copy/maximise, view/select/edit modes. [`app/components/code-block.js`](app/components/code-block.js). |
| **Expandable surface** | Maximize code blocks or textareas to page width. [`app/components/expandable-surface.js`](app/components/expandable-surface.js). |
| **Icons** | Inline SVGs in [`app/utils/icons.js`](app/utils/icons.js); use `data-icon` in HTML or `createIcon()` in JS. Source from [Icônes — Material Icons (Round)](https://icones.js.org/collection/ic?s=info&variant=Round). Logo files stay in `app/res/`. |
| **Toolbar helper** | `.toolbar` flex row for button groups. See [`demo.html`](demo.html). |
| **Code highlighting** | Optional [Prism.js](https://prismjs.com/) via [`app/components/code-block.js`](app/components/code-block.js) and [`app/vendor/prism/`](app/vendor/prism/). Load vendor scripts on the page (see Code blocks in **Using components**). |
| **Rich text editor** | Markdown + WYSIWYG via [Toast UI Editor](https://github.com/nhn/tui.editor); table merged-cell plugin; base64 image paste. [`app/components/rich-text-editor.js`](app/components/rich-text-editor.js). Large vendor bundle (~500KB+). |
| **Charts** | Thin SVG host around [TanStack Charts](https://tanstack.com/charts/latest) (`initChart` / `mountChart`). Forks author `defineChart` marks/scales. Vendored ESM + import map for `d3-scale` / `d3-shape`. [`app/components/charts.js`](app/components/charts.js). Pre-alpha upstream. |
| **Diagrams** | Thin Mermaid host (`initDiagram` / `initDiagrams`) for text → SVG diagrams (flowchart, sequence, …). Vendored ESM + chunks under `app/vendor/mermaid/`. Theme follows light/dark. [`app/components/diagram.js`](app/components/diagram.js). |

For live examples of each component, open [`demo.html`](demo.html) on a local server or your deployed site.

---

## Using components

### Theme

```html
<script src="app/theme-init.js"></script>
<link rel="stylesheet" href="app/styles.css" />
<script type="module" src="app/main.js"></script>
```

```javascript
import { initShell } from "./shell/shell.js";

initShell(); // footer + page nav + icons + theme in one call
```

Or wire individually:

```javascript
import { initTheme, initThemeToggle } from "./shell/theme.js";
initTheme();
initThemeToggle(document.getElementById("theme-toggle"));
```

### Sticky chrome

Optional stickiness for the site `<header>` and section titles. Off by default. Opt in with attributes on `<html>` (or the JS helpers). `initShell()` syncs offsets and stuck state on load, resize, and scroll.

| Opt-in | Effect |
| ------ | ------ |
| `data-sticky-header` | Sticky `body > header` |
| `data-sticky-section-headings` | Sticky `.section-title` and `.content-tier-header` (so `.segment-title` stays visible for the tier) |

```html
<html lang="en" data-sticky-header data-sticky-section-headings>
```

```html
<section class="content-tier">
  <header class="content-tier-header">
    <h2 class="segment-title" data-page-nav-tier>Tier title</h2>
    <p class="content-tier-lead">Optional lead.</p>
  </header>
  <div class="content-tier-body">
    <section class="content-section" aria-labelledby="example-heading">
      <h3 id="example-heading" class="section-title">Section</h3>
      <!-- … -->
    </section>
  </div>
</section>
```

```javascript
import {
  setStickyHeader,
  setStickySectionHeadings,
  syncStickyOffsets,
} from "./shell/sticky.js";

setStickyHeader(true);
setStickySectionHeadings(true);
// After layout changes that alter header/tier-band height:
syncStickyOffsets();
```

While stickiness is enabled but nothing is pinned yet, appearance is unchanged. Pinning itself waits for `data-sticky-ready` (set by `initStickyChrome()`) so a mid-document reload never shows bare stuck titles before the chrome paints; the first sync also boots with fades suppressed. As each bar pins, it receives `data-sticky-stuck` (gap fill fades in above and below) and the bottom-most *visible* pinned element also gets `data-sticky-stuck-edge` (hairline + drop shadow).

When both opts are on, the site header sticks at `top: 0` as its own bar. Content headings share a **single** slot under it (`top: headerOffset + gap`): a pinned tier shows its segment title alone, then **grows** to a breadcrumb **`Segment > Section`** when a section in that tier also pins (chevron separator; section chrome is ghosted via `data-sticky-crumb-merged`). If the tier has already scrolled away, the section title sticks alone in that slot. Clearance uses `--sticky-header-offset` (live bottom of the site header, no gap) and `--sticky-gap`; `--sticky-tier-offset` (pinned bar height) is used only by `scroll-margin-top` so page-nav jumps land headings below the bar. Peer handoff is native sticky (a section heading cannot leave its `.content-section`; a tier header cannot leave its `.content-tier`). Below about `700px` viewport height, tier headers leave the stack so short screens stay usable (sections stick alone; no crumb).

Pinning is deliberately **layout-neutral**: a pinned tier header hides its lead, and `--sticky-collapse-reserve` (measured by `sticky.js`) gives that height back as margin. Without it, pinning would shorten the page, lift the next tier, evict the pinned header, restore the lead, and oscillate at the boundary. For the same reason, pin state is derived from in-flow document Y plus `scrollY`, and eviction is measured against the containing `.content-tier` / `.content-section` rather than the header's own (pin-dependent) height.

Subsection handoffs crossfade the crumb label (`--sticky-crumb-ms`) and **hold** the crumb for a short beat when no section is pinned, so fast scrolling does not flash the large segment title between subsections. Crumb labels (and pinned titles when the crumb is not showing) are links: click to jump to that heading with the same sticky clearance as page nav.

### Title numbering

Optional hierarchical prefixes on outline headings (`1.`, `1.1.`, `1.2.1.`, …). Off by default. Opt in with `data-title-numbering` on `<html>`, or call `setTitleNumbering(true)`. `initShell()` applies numbering before page nav so nav labels include the prefixes.

| Opt-in / opt-out | Effect |
| ---------------- | ------ |
| `data-title-numbering` on `<html>` | Number `main :is(h2, h3, h4)[id]` in document order |
| `data-no-title-number` on a heading | Skip that heading |

```html
<html lang="en" data-title-numbering>
```

```javascript
import {
  setTitleNumbering,
  syncTitleNumbering,
} from "./shell/title-numbering.js";

setTitleNumbering(true);
// After DOM changes that add or remove outline headings:
syncTitleNumbering();
```

Numbers are injected as a leading `.title-number` span (picked up by page nav `textContent`). Depth follows heading level relative to the shallowest matched tag (typically `h2` → `1.`, nested `h3` → `1.1.`). Skipped levels fill with `0` (e.g. `h2` then `h4` → `1.` then `1.0.1.`).

### Dialog

```javascript
import { initDialog } from "./components/dialog.js";

const dialog = initDialog({
  dialogEl: document.getElementById("my-dialog"),
  openTriggers: "#open-my-dialog",
});
// dialog.openDialog(), dialog.closeDialog(), dialog.isDialogOpen()
```

Close controls use `data-dialog-close` on backdrop, × button, or footer buttons.

**Default action / Enter:** mark the intended Enter target with `data-dialog-default` (focused on open). If omitted, Enter falls back to `.modal-footer-actions .btn-primary` (not `.btn-danger`). For destructive dialogs, put `data-dialog-default` on Cancel and style the primary action with `.btn-danger`.

### About dialog (“What?”)

Pattern for explaining the app from the site tagline — same idea as [pqm-stepper](https://github.com/filcuk/pqm-stepper). A `.btn-link.tagline-link` opens a dialog; an optional **confused** button reveals progressively simpler copy, then hands over to a final link.

All copy lives in the markup, so editing the explanation never means touching JS.

```html
<p class="tagline">
  Short app pitch.
  <button type="button" id="about-open-btn" class="btn btn-link tagline-link">What?</button>
</p>

<div id="about-dialog" class="modal hidden" role="dialog" aria-modal="true"
  aria-labelledby="about-dialog-title" hidden>
  <div class="modal-backdrop" data-dialog-close></div>
  <div class="modal-panel">
    <div class="modal-header">
      <h2 id="about-dialog-title">What does this do?</h2>
      <button type="button" class="modal-close" aria-label="Close" data-dialog-close>×</button>
    </div>
    <div class="modal-body">
      <p>Full explanation…</p>
      <div class="about-extra-content" data-about-extra>
        <div class="about-extra-block hidden" data-about-stage data-about-next-label="Uhh…" hidden>
          <p>Simpler explanation…</p>
        </div>
        <div class="about-extra-block hidden" data-about-stage data-about-next-label="I don't get it" hidden>
          <p>Even simpler…</p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" class="btn" data-about-confused>Huh?</button>
      <a class="btn hidden" data-about-final href="https://example.com/help" hidden>I don't get it</a>
      <div class="modal-footer-actions">
        <button type="button" class="btn" id="about-guided-tour">Guided tour</button>
        <button type="button" class="btn btn-primary" data-dialog-close data-dialog-default>Got it</button>
      </div>
    </div>
  </div>
</div>
```

```javascript
import { initAboutDialog } from "./components/about-dialog.js";

const about = initAboutDialog({
  dialogEl: document.getElementById("about-dialog"),
  openTriggers: "#about-open-btn",
});
// about.openDialog(), about.closeDialog(), about.isDialogOpen(), about.reset(), about.destroy()
```

| Markup hook | Role |
| ----------- | ---- |
| `data-about-confused` | The progressive button; its HTML text is the initial label |
| `data-about-stage` | One block per stage, revealed in DOM order (start them `hidden`) |
| `data-about-next-label` | Optional label for the button once that stage is showing |
| `data-about-final` | Optional element (usually an `<a href>`) shown after the last stage; the button hides and focus moves to it |

Stages reset every time the dialog opens or closes. Omit `data-about-stage` entirely and the confused button hides itself. See the live example on [`demo.html`](demo.html).

Once the first stage is showing, the dialog gains `data-about-dimmed` and the newest stage gains `data-about-current`. The stylesheet uses those to fade earlier copy to `--muted` so the new block reads first — restyle or drop those rules if you want every layer at full contrast.

**First-visit hint:** on a cold load, point a non-dismissible popover at the “What?” button (localStorage flag so it only shows once). Opening the about dialog should dismiss and remember the hint. Optional: a **Guided tour** footer button closes the dialog and starts `initTutorial`. Pattern as in [`demo.js`](app/demo.js) and [pqm-function-creator](https://github.com/filcuk/pqm-function-creator):

```javascript
const ABOUT_HINT_STORAGE_KEY = "my-app-about-hint-seen";
const aboutOpenBtn = document.getElementById("about-open-btn");
let aboutHintPopover = null;

function hasSeenAboutHint() {
  try {
    return localStorage.getItem(ABOUT_HINT_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markAboutHintSeen() {
  try {
    localStorage.setItem(ABOUT_HINT_STORAGE_KEY, "1");
  } catch { /* ignore */ }
}

function dismissAboutHint() {
  if (!aboutHintPopover) return;
  const popover = aboutHintPopover;
  aboutHintPopover = null;
  markAboutHintSeen();
  popover.destroy();
}

const aboutDialog = initAboutDialog({
  dialogEl: document.getElementById("about-dialog"),
  openTriggers: [aboutOpenBtn],
  onOpen: () => dismissAboutHint(),
});

if (aboutOpenBtn instanceof HTMLElement && !hasSeenAboutHint()) {
  aboutHintPopover = initPopover({
    anchor: aboutOpenBtn,
    body: "Check here for more info and a guided tour!",
    position: "right",
    dismissible: false,
    trapFocus: false,
    actions: [{
      label: "Got it",
      className: "btn btn-primary",
      closeOnClick: false,
      onClick: () => dismissAboutHint(),
    }],
    onClose: () => {
      if (!aboutHintPopover) return;
      const popover = aboutHintPopover;
      aboutHintPopover = null;
      markAboutHintSeen();
      queueMicrotask(() => popover.destroy());
    },
  });
  window.requestAnimationFrame(() => aboutHintPopover?.open());
}
```

### Tooltip

Hover tips (default): add `data-tooltip` and optional `data-tooltip-position="top|bottom|left|right"`. Optional `data-tooltip-tone="success|error"` for bold green/red tips with check / × icons (info is the default, text only).

```html
<button type="button" data-tooltip="Help text" data-tooltip-position="top">?</button>
```

```javascript
import {
  initTooltips,
  flashTooltip,
  showPersistentTooltip,
  dismissPersistentTooltip,
} from "./components/tooltip.js";

initTooltips(document);

// Timer mode — reaction feedback when the control cannot flash in-place
// (e.g. icon-only). Prefer rewriting a visible label (Copy → Copied) when possible.
flashTooltip(copyBtn, {
  text: "Copied",
  tone: "success",
  durationMs: 2000,
});

// Persistent mode — tutorial; dismiss only when intended
const tipId = showPersistentTooltip(nextBtn, {
  text: "Click Next to continue",
  // Optional: override data-tooltip-position so a hover tip on the same
  // control can sit on another side (e.g. persistent top, hover bottom).
  position: "top",
});
nextBtn.addEventListener(
  "click",
  () => dismissPersistentTooltip(tipId),
  { once: true }
);
```

`initShell()` already calls `initTooltips(document)`. Modes and mutual exclusion are documented in [`DESIGN.md`](DESIGN.md).

For multi-step guided tours with a dimmed page and back/next controls, use **Tutorials** (below) instead of chaining persistent tooltips. For a single rich tip with actions, use **Popovers**.

### Popover

Anchored speech-bubble card (notch points at the target). Use when a tip needs a title, longer copy, or action buttons. Tooltips stay text-only and non-interactive. When the anchor scrolls fully off-screen, the popover hides (still open) and reappears when the anchor returns — it does not stay clamped to a viewport edge.

```javascript
import { initPopover } from "./components/popover.js";

const popover = initPopover({
  anchor: "#help-target", // selector, element, or null for a centred card
  title: "Keyboard shortcuts",
  body: "Press ? to open this help anytime.",
  position: "auto", // auto | top | bottom | left | right
  dismissible: true, // close button + Escape
  closeOnOutsideClick: true, // defaults to dismissible
  trapFocus: true, // default; set false (or call setTrapFocus) to allow Tab outside
  actions: [
    {
      label: "Got it",
      className: "btn btn-primary",
      // closeOnClick defaults to true
    },
  ],
});

popover.open();
// Initial focus prefers the primary action, then any footer action, then Close.
// popover.update({ title, body, position, actions })
// popover.setAnchor(otherEl)
// popover.setTrapFocus(false)
// popover.close() / popover.destroy()
```

`computePopoverPlacement()` is also exported for tests or custom positioning. See the live example on [`demo.html`](demo.html).

### Tutorial

Walk a JS-defined script: dim the page, spotlight a target, and show a popover with back / next / close. Register any number of tutorials per page; only one runs at a time (starting another stops the first).

```javascript
import { initTutorial } from "./components/tutorial.js";

const tour = initTutorial({
  id: "getting-started",
  startTriggers: "#start-tour",
  padding: 8,
  steps: [
    {
      title: "Welcome",
      body: "A short intro with no target — the whole page is dimmed.",
    },
    {
      target: "#save-btn", // selector, element, or () => element
      title: "Save",
      body: "Your work is saved here.",
      position: "bottom",
    },
    {
      target: "#next-control",
      title: "Try it",
      body: "This step lets you click the control; the tour advances on click.",
      interactive: true,
      advanceOn: "click",
    },
  ],
  onFinish: ({ reason }) => {
    // reason: done | close | escape | stop | missing-target | empty | …
  },
});

tour?.start(); // or rely on startTriggers
// tour.next() / tour.back() / tour.goTo(i) / tour.stop() / tour.destroy()
```

| Step field | Role |
| ---------- | ---- |
| `target` | Element to spotlight; omit for a centred intro/outro card |
| `title` / `body` | Popover content (`body` may be a string or a DOM node) |
| `position` | Popover side (`auto` preferred) |
| `interactive` | When true, the target stays clickable (page is not `inert`) and Tab is not trapped in the step popover |
| `advanceOn` | `"click"` — advance when the interactive target is clicked |
| `padding` | Spotlight padding around the target (px) |
| `scroll` | Scroll the target into view before opening the step popover when it is clipped (default `true`; already-visible targets are not recentred) |
| `onEnter` / `onLeave` | Optional callbacks when a step is shown or left — use to reset pagination, tabs, etc. before the next target is resolved |
| `when` | `boolean` or `(ctx) => boolean` (`ctx`: `{ index, step }`). `index` is the **post-flatten** leaf index (same as `goTo(i)` / `onEnter`). Re-evaluated on start / next / back / `goTo`. `false` skips the step silently (unlike a missing target, which warns). A thrown `when` is treated as ineligible and logged |
| `steps` | Nested group (authoring sugar). Flattened at init; the group's `when` is AND-ed with each child's `when`. The group itself is not shown — if the same object also has `target` / `title` / `interactive`, those leaf fields are ignored |

```javascript
let path = "a";

initCombo(document.getElementById("mode-combo"), {
  onSelect: ({ value }) => {
    path = value;
  },
});

initTutorial({
  id: "branching",
  startTriggers: "#start-branching-tour",
  steps: [
    {
      target: "#mode-combo",
      title: "Pick a path",
      body: "Choose Option A or Option B, then press Next.",
      interactive: true,
    },
    {
      when: () => path === "b",
      steps: [{ target: "#path-b", title: "Option B" }],
    },
    {
      when: () => path !== "b",
      steps: [{ target: "#path-a", title: "Option A" }],
    },
    { title: "Both paths rejoin here" },
  ],
});
```

`when` is not snapshotted when the tour starts, so a choice on an earlier interactive step can change the remaining path. Navigation (`next` / `back` / `goTo` / `start`) and Back / Done / `Step {n} of {N}` follow **showable** steps: currently eligible `when` **and** a resolvable target (or no target). `goTo(i)` jumps to the nearest showable step to `i` (itself first; equal distance prefers forward) and does not end the tour when none exist. If the **current** step's `when` later becomes false, the tour stays on it until the user moves.

Steps whose `target` cannot be resolved log a **console warning** and are skipped; if no step can be shown when starting the tour logs a **console error** and stops (`onFinish` reason `missing-target`). If the current target leaves the document during the tour (scroll/resize), a warning is logged and the tour advances to the next showable step (or stops with `missing-target`).

Escape closes the active tutorial (priority above dialogs). See [`DESIGN.md`](DESIGN.md) for when to prefer a tutorial vs a persistent tooltip. Demo: [`demo.html`](demo.html).

### Banners

Markup uses `.banner` plus a variant (`banner-success`, `banner-error`, …) and a `data-icon` for the left icon.

**Style variations** reuse an existing banner palette with a different semantic class and icon:

| Variation class | Reuses style of | Icon id |
| --------------- | --------------- | ------- |
| `banner-question` | `banner-warning` | `help` |
| `banner-example` | `banner-important` | `experiment` |
| `banner-quote` | `banner-note` | `format-quote` |
| `banner-tip` | `banner-success` | `tip` |

Auto-hide after a delay — set `data-banner-expire` (milliseconds) and call `showBanner()`. A light overlay drains across the banner for the duration of the timeout, then the banner fades out quickly.

**Rotating variations** — list ids on `data-banner-variations` (space- or comma-separated). The first id matches the visible markup; additional variations live in hidden source nodes. With `data-banner-rotate`, expiry advances to the next variation and restarts the timer instead of hiding (loops when there are two or more). **`data-banner-expire` is required for rotation** — without a timeout, expiry never fires and the carousel does not advance.

`hideBanner()` cancels any pending expiry and **resets the variation index to the first** id in `data-banner-variations` (or the markup default when there is only one). The next `showBanner()` therefore starts from the first variation again — not from whichever slide was showing when hidden.

```html
<div id="status-banner" class="banner banner-warning hidden" role="status" hidden
  data-banner-expire="3000" data-banner-rotate data-banner-variations="warning question">
  <span class="banner-icon" data-icon="warning" data-icon-class="banner-icon-svg"></span>
  <span class="banner-body"><strong class="banner-body-label">Warning:</strong> non-blocking notice.</span>
  <div class="banner-variation-source" data-banner-variation="question"
    data-banner-class="banner-question" hidden>
    <span data-banner-variation-icon="help"></span>
    <span data-banner-variation-body>
      <strong class="banner-body-label">Question:</strong> something to decide.
    </span>
  </div>
</div>
```

Single-variation auto-hide:

```html
<div id="saved-banner" class="banner banner-success hidden" role="status" hidden
  data-banner-expire="1500">
  <span class="banner-icon" data-icon="success" data-icon-class="banner-icon-svg"></span>
  <span class="banner-body">Saved</span>
</div>
```

```javascript
import { showBanner, hideBanner, setBannerVariation } from "./components/banner.js";

showBanner(document.getElementById("saved-banner"));
// or override: showBanner(el, { expire: 3000 });
setBannerVariation(el, "question");
hideBanner(el);
```

Always use `hideBanner()` / `showBanner()` for banners with expiry — do not toggle `.hidden` directly, or timers may keep running.

### Callouts

Accent-edged cards for durable tips and context that stay on the page. Prefer banners for transient status (save, error, auto-dismiss).

```html
<aside class="callout" role="note">
  <h3 class="callout-title">Optional title</h3>
  <p class="callout-body">Standing information the reader should keep in view.</p>
</aside>
```

Styles live in [`app/css/overlays.css`](app/css/overlays.css). No JS init.

### External links

Enabled by `initShell()`. Any `http(s)` link to another origin gets an arrow-outward icon appended automatically. Opt out on a specific link:

```html
<a href="https://example.com" data-no-external-icon>Stay plain</a>
```

### Also see (related apps)

Footer control after the GitHub link. Topics render as `.dropdown-menu-group` headers; link cells use the shared dropdown **auto grid** (`alsoSeeMenuColumns()` picks 1–3 columns from link counts so each topic’s last row leaves as few empty cells as possible). Narrow viewports fall back to a single column. Configure in [`app/config.js`](app/config.js) (or pass `alsoSee` / `alsoSeeUrl` / `alsoSeeTopics` / `alsoSeeIncludeLocal` to `initShell()` / `renderPageShell()`):

```javascript
alsoSeeUrl: "https://raw.githubusercontent.com/you/shared/main/apps/links.json", // optional
alsoSeeTopics: ["*", "-Database"], // all remote topics except Database
alsoSeeIncludeLocal: false, // true = include local alsoSee in full (alone or merged with remote)
appUrl: "https://you.github.io/your-app/", // omit this site from the menu
alsoSee: [
  {
    topic: "Examples",
    order: 10, // optional — lower first among named topics
    items: [
      {
        label: "Example App A",
        subtitle: "Sample related microapp", // optional
        url: "https://example.com/app-a",
        iconLight: "app/res/app-light.svg", // or single `icon` for one image
        iconDark: "app/res/app-dark.svg",
        accent: "#8250df", // optional per-app menu highlight (hex only)
        accentHover: "#6639ba",
        // or theme pair: accentLight / accentDark (and accentHoverLight / accentHoverDark)
        order: 10, // optional — lower first within the topic
      },
    ],
  },
  {
    label: "Sponsor",
    subtitle: "Support this work",
    url: "https://github.com/sponsors/you",
    // Embedded SVG (wins over icon / iconLight / iconDark). Prefer full <svg viewBox="…">.
    iconSvg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1v14"/></svg>',
    order: 10, // ranks among ungrouped flat links only
  },
],
```

| Value | Behaviour |
| ----- | --------- |
| `alsoSeeUrl` string | Fetches remote JSON and shows it (merged with local when `alsoSeeIncludeLocal`) |
| Local `alsoSee` array | Included in full only when `alsoSeeIncludeLocal` is true — never used as a fallback; not filtered by `alsoSeeTopics` |
| `alsoSeeIncludeLocal: true` | Include local alone (no remote) or merge with filtered remote; same topics combined; URL de-dupe; lower topic `order` wins on merge |
| `alsoSeeIncludeLocal: false` | Local list is never shown |
| `alsoSeeTopics: ["*"]` | All **remote** topics (including ungrouped); only `"*"` means all |
| `alsoSeeTopics: ["*", "-Topic"]` | All remote topics except exclusions (`"-"` excludes ungrouped) |
| `alsoSeeTopics: string[]` | Case-insensitive remote whitelist; `""` for ungrouped; `"-Topic"` still excludes |
| `alsoSeeTopics: []` | No **remote** topics (nothing included) |
| `appUrl` | Any entry whose `url` matches (trailing slash / case ignored) is excluded; empty topics are dropped |
| `alsoSee: []` or `false` | Hides the control when there is no successful remote list |
| `order` (number) | Optional on topic sections and links; ascending sort; missing/`NaN` after numbered; ungrouped flat links always last (link `order` still applies within that group) |
| `accent` / `accentHover` | Optional per-link hex (`#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA`) for both themes; applied as local `--accent` / `--accent-hover`. **`accent`** drives menu item highlight chrome (border / fill). **`accentHover`** is for the also-see **trigger** text hover (and other `--accent-hover` consumers) — item hover/press still use `--accent` for border/fill and keep label colour `--text`. Invalid values are ignored |
| `accentLight` / `accentDark` | Optional theme pair (same hex rules); wins over `accent`; a missing side clones the other. Hover has `accentHoverLight` / `accentHoverDark` (independent of accent; wins over `accentHover`; same trigger-vs-item split as above) |

Remote / local JSON is a top-level array of **topic sections** and/or **flat links**:

```json
[
  {
    "topic": "Power BI",
    "order": 10,
    "items": [
      {
        "label": "Power BI Tabulator",
        "subtitle": "Tabular conversion for DAX & M",
        "url": "https://filcuk.github.io/pbi-tabulator/",
        "icon": "https://filcuk.github.io/pbi-tabulator/app/res/icon.svg",
        "accent": "#8250df",
        "accentHover": "#6639ba",
        "order": 10
      }
    ]
  },
  {
    "label": "Sponsor",
    "subtitle": "Support this work",
    "url": "https://github.com/sponsors/filcuk",
    "iconSvg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 16 16\" fill=\"currentColor\"><path d=\"M8 1v14\"/></svg>",
    "order": 10
  }
]
```

Prefer a `raw.githubusercontent.com` or GitHub Pages URL and a simple `GET` (no custom headers). Each item is a real link: left-click opens in the current window; middle-click or Ctrl/Cmd-click opens in a new tab. Optional `subtitle` shows muted context under the label.

**Icons** (first match wins):

1. `iconSvgLight` + `iconSvgDark` — theme pair of embedded SVG strings (missing side clones the other)
2. `iconSvg` — single always-visible embedded SVG
3. `iconLight` + `iconDark` — theme-swapped image URLs/paths (`brand-icon--light` / `brand-icon--dark`)
4. `icon` — single always-visible image URL/path

**Colours** (accent and hover are independent; pair wins over single in each role):

- Accent: `accentLight` + `accentDark` (missing side clones the other), else `accent` — scopes **menu item** highlight chrome (`--accent` border / fill)
- Hover: `accentHoverLight` + `accentHoverDark`, else `accentHover` — scopes the also-see **trigger** text hover (`--accent-hover`); item hover/press still use `--accent`

Omit hover to keep the inherited `--accent-hover` mix (it follows the resolved `--accent`). Hex only (`#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`); invalid values are ignored.

Embedded SVG should be a full `<svg viewBox="…">…</svg>` (or inner shape markup). Keep `viewBox` and fills; omit `width`/`height`/`class`/`data-*`. Escape `"` as `\"` in JSON. Markup is sanitized before inline render (scripts, event handlers, and disallowed tags are stripped). Prefer URL icons when the logo is already hosted. Flat legacy arrays (links only, no topics) still work. Extra JSON properties are ignored.

### Heading links

Enabled by `initShell()`. Headings matching `main :is(h2, h3)[id]` show a link icon on hover with a “Get link” tooltip; click copies the full section URL and shows a timer success (“Copied!”) or error tip (icon-only control).

Disable the page with `initShell({ headingLinks: false })` or `data-no-heading-links` on `<html>`. Skip one heading with `data-no-heading-link`. An explicit `headingLinks: true` (or `{ enabled: true }`) overrides the HTML opt-out. Pass `{ selector }` through `initShell({ headingLinks: { selector: "…" } })` to narrow which headings get a button.

```javascript
// Prefer initShell — it installs (or skips) heading links once at boot:
initShell({ headingLinks: false });
// or: initShell({ headingLinks: { selector: "main h3[id]" } });

// Standalone (only if you are not using initShell for this page):
import { initHeadingLinks } from "./shell/heading-link.js";
initHeadingLinks(document); // default: main :is(h2, h3)[id]
initHeadingLinks(document, { selector: "main h3[id]" }); // sections only
```

Calling `initShell({ headingLinks: false })` **after** `initHeadingLinks(document)` does not remove buttons already installed — disable before install, or use `data-no-heading-links` on `<html>` before `initShell()` runs.

```html
<html lang="en" data-no-heading-links>
```

```html
<h2 id="overview" data-no-heading-link>Overview</h2>
```

### Buttons

Standard height uses `--control-height`. Add `.btn-slim` for the compact `--control-height-slim` size (labeled or icon-only).

```html
<button type="button" class="btn">Standard</button>
<button type="button" class="btn btn-slim">Slim</button>
<button type="button" class="btn btn-primary btn-slim">Slim primary</button>
<button type="button" class="btn btn-slim btn-icon" aria-label="More options"
  data-icon="lines" data-icon-class="btn-icon-svg"></button>
```

### Button label flash

In-place **Copy** → **Copied** / **Failed** feedback on labeled buttons. Pair `.btn-label-flash` with a `.btn-label-flash__label` span (icon optional). Icon-only controls should keep using timer `flashTooltip()` instead.

```html
<button type="button" class="btn btn-label-flash" aria-label="Copy">
  <span class="btn-label-flash__label">Copy</span>
</button>
```

```javascript
import { copyText } from "./utils/clipboard.js";
import {
  prepareButtonLabelFlash,
  setButtonLabelFlash,
  flashButtonLabel,
} from "./utils/button-label.js";

const copyBtn = document.getElementById("copy-btn");

prepareButtonLabelFlash(copyBtn, {
  idle: "Copy",
  success: "Copied",
  fail: "Failed",
  // lockWidth: false, // optional — skip auto-measure when labels are same width
  measureLabels: [], // optional extra states (e.g. "Ctrl+V")
});

copyBtn.addEventListener("click", async () => {
  const ok = await copyText("…");
  flashButtonLabel(copyBtn, ok, {
    durationMs: 1500,
    reset: () => {
      copyBtn.setAttribute("aria-label", "Copy");
      setButtonLabelFlash(copyBtn, "Copy");
    },
  });
});
```

`lockWidth` defaults to **on** — `prepareButtonLabelFlash()` auto-measures idle / success / fail (plus `measureLabels`) so longer flash text does not shift layout. Pass `lockWidth: false` to skip. Use `setButtonLabelFlash()` for other temporary labels (e.g. paste-arming **Ctrl+V**). See [`DESIGN.md`](DESIGN.md) (Action feedback).

### Toggle button

Pressed-state button (`.btn.btn-toggle` + `aria-pressed`) with optional label/icon swapping. By default the pressed state shows the accent on/off appearance. Add `data-toggle-button-always-active` when both states are equally valid actions rather than on/off: the accent pressed styling is suppressed so the control keeps the default button appearance, and the swapped label/icon describes the **next action** (e.g. Enter fullscreen ↔ Exit fullscreen).

```html
<button type="button" class="btn btn-icon btn-toggle" aria-pressed="false"
  data-toggle-button data-toggle-button-always-active
  data-toggle-button-icon-off="fullscreen" data-toggle-button-icon-on="fullscreen-exit"
  data-toggle-button-aria-label-off="Enter fullscreen"
  data-toggle-button-aria-label-on="Exit fullscreen"
  data-icon-class="btn-icon-svg"></button>

<button type="button" class="btn btn-toggle" aria-pressed="false"
  data-toggle-button
  data-toggle-button-label-off="Enable" data-toggle-button-label-on="Disable"></button>
```

```javascript
import { initToggleButton, initToggleButtons } from "./components/toggle-button.js";

const btn = initToggleButton(document.getElementById("my-toggle-btn"), {
  onChange: ({ pressed, source }) => console.log(pressed, source),
});

btn?.getPressed();
btn?.setPressed(true);
btn?.toggle();

initToggleButtons(document); // all [data-toggle-button]
```

`data-toggle-button-label-off` / `-on`, `data-toggle-button-aria-label-off` / `-on`, `data-toggle-button-icon-off` / `-on`, `data-toggle-button-icon-class`, and `data-toggle-button-always-active` mirror the JS options. Actions in [`demo.html`](demo.html) shows both variants at standard and slim sizes.

### Toolbar

Flex row for grouping related buttons. Wraps on narrow viewports.

```html
<div class="toolbar" role="toolbar" aria-label="Document actions">
  <button type="button" class="btn">Undo</button>
  <button type="button" class="btn">Redo</button>
  <button type="button" class="btn btn-primary">Save</button>
  <button type="button" class="btn btn-danger">Delete</button>
  <button type="button" class="btn btn-icon" aria-label="More options" data-icon="lines"
    data-icon-class="btn-icon-svg"></button>
</div>
```

### Badge

Corner indicator on a control or text. Wrap the host in `.badge-host` and add a `.badge` sibling (top-right, slightly overlapping).

**Variants** (class on `.badge`):

| Class | Role |
| ----- | ---- |
| `.badge` (default) | **Normal** — shows a number or text readout; empty or `0` hides it |
| `.badge.badge--sm` | **Small** — round dot only; show/hide with a truthy value (`true` / count) or `clear()` |

```html
<!-- Normal (readout) -->
<span class="badge-host" data-badge-label="Notifications">
  <button type="button" class="btn" aria-label="Notifications, 3">Notifications</button>
  <span class="badge" aria-hidden="true">3</span>
</span>

<!-- Small (dot) -->
<span class="badge-host" data-badge-label="Updates">
  <button type="button" class="btn" aria-label="Updates, updated">Updates</button>
  <span class="badge badge--sm" aria-hidden="true"></span>
</span>
```

```javascript
import { initBadge, initBadges } from "./components/badge.js";

const badge = initBadge(document.getElementById("notifications-badge"), {
  onChange: ({ value, display, variant }) => console.log(value, display, variant),
});

badge?.getValue();
badge?.setValue(12);
badge?.increment(); // +1
badge?.clear();     // hide (value 0)

const dot = initBadge(document.getElementById("updates-badge"), { value: true });
dot?.setValue(false); // hide
dot?.setValue(true);  // show

initBadges(document); // all `.badge-host` blocks with a `.badge`
```

`data-badge-label` keeps the control’s `aria-label` in sync (`{label}, {value}` for normal; `{label}, {detail}` for small). Optional `data-badge-max` (or `max` option) caps normal readouts (e.g. `99` → `99+`). Mark the control with `data-badge-control` when it is not the obvious button/link sibling. On tinted `.section-panel` surfaces, `--badge-ring` matches the panel; override it where the host background differs.

### Chips

Selectable tags (filters) and removable input chips.

**Filter group** — static chips that toggle on/off (`aria-pressed`); they cannot be removed.

```html
<div class="chip-group" role="group" aria-label="Categories">
  <button type="button" class="chip" aria-pressed="true" data-chip-value="docs">Docs</button>
  <button type="button" class="chip" aria-pressed="false" data-chip-value="api">API</button>
</div>
```

```javascript
import { initChipGroup, initChipGroups } from "./components/chip.js";

const filters = initChipGroup(document.getElementById("category-filters"), {
  onChange: ({ values, labels }) => console.log(values, labels),
});

filters?.getValues();
filters?.setSelected(["docs", "api"]);
filters?.clear();

initChipGroups(document);
```

**Input chips** — type a value and press Enter or comma to add; chips render below the field. Click a chip to remove it.

```html
<div class="chip-input" id="tag-input">
  <label class="field-label" for="tag-input-field">Tags</label>
  <div class="chip-input-control">
    <input type="text" id="tag-input-field" class="input chip-input-field"
      placeholder="Add tag…" autocomplete="off" />
  </div>
  <div class="chip-input-list"></div>
  <input type="hidden" class="chip-input-value" />
</div>
```

```javascript
import { initChipInput, initChipInputs } from "./components/chip.js";

const tags = initChipInput(document.getElementById("tag-input"), {
  values: ["urgent"],
  onChange: ({ values }) => console.log(values),
});

tags?.getValues();
tags?.add("mine");
tags?.remove("urgent");
tags?.clear();

initChipInputs(document);
```

`data-chip-value` on selectable chips sets the value (defaults to label text). `data-chip-input-disabled` disables the input field.

### Legend

Coloured category chips for charts, code highlights, and similar. Styles share [`app/css/controls-chips.css`](app/css/controls-chips.css). Eight palette slots live in [`app/tokens.css`](app/tokens.css) (`--legend-1` / `--legend-1-border` … `--legend-8` / `--legend-8-border`), applied via `.legend-chip--1` … `.legend-chip--8`. Override a chip with `--legend-color` and optional `--legend-border` for app-specific colours. Label text uses `--text`.

**Interactive** — `button.legend-chip` items toggle on/off (`aria-pressed`); inactive chips dim. Use `data-tooltip` for hover detail (via `initTooltips` / `initShell`).

```html
<div class="legend" role="group" aria-label="Highlight categories">
  <button type="button" class="legend-chip legend-chip--1"
    aria-pressed="true" data-legend-value="definition"
    data-tooltip="Step name being defined">Definition</button>
  <button type="button" class="legend-chip legend-chip--2"
    aria-pressed="true" data-legend-value="new-definition">New Definition</button>
  <button type="button" class="legend-chip legend-chip--3"
    aria-pressed="true" data-legend-value="reference">Reference</button>
  <button type="button" class="legend-chip legend-chip--4"
    aria-pressed="true" data-legend-value="new-reference">New Reference</button>
</div>
```

```javascript
import { initLegend, initLegends } from "./components/legend.js";

const legend = initLegend(document.getElementById("highlight-legend"), {
  onChange: ({ values, labels }) => console.log(values, labels),
});

legend?.getValues();
legend?.setSelected(["definition", "reference"]);
legend?.clear();

initLegends(document);
```

**Static** — use `span.legend-chip` (no toggle). `initLegend` ignores non-button items.

```html
<div class="legend" role="list" aria-label="Series">
  <span class="legend-chip legend-chip--1" role="listitem">Series A</span>
  <span class="legend-chip" role="listitem" style="--legend-color: #dafbe1; --legend-border: #52b768">Custom</span>
</div>
```

`data-legend-value` sets the value (defaults to label text). Modifier classes: `.legend-chip--1` … `.legend-chip--8`.

### Inputs

```html
<label class="field" for="name">
  <span class="field-label">Name</span>
  <input type="text" id="name" class="input" placeholder="Enter text…" />
</label>

<label class="field" for="notes">
  <span class="field-label">Notes</span>
  <textarea id="notes" class="textarea" rows="4"></textarea>
</label>

<label class="checkbox" for="agree">
  <input type="checkbox" class="checkbox-input" id="agree" />
  <span>I agree</span>
</label>

<label class="checkbox">
  <input type="checkbox" class="checkbox-input" id="partial"
    data-checkbox-tristate data-checkbox-default="mixed" />
  <span>Some selected</span>
</label>

<div class="field">
  <span class="field-label" id="size-label">Size</span>
  <div class="radio-group" role="radiogroup" aria-labelledby="size-label">
    <label class="radio" for="size-small">
      <input type="radio" class="radio-input" name="size" id="size-small" value="small" />
      <span>Small</span>
    </label>
    <label class="radio" for="size-large">
      <input type="radio" class="radio-input" name="size" id="size-large" value="large" />
      <span>Large</span>
    </label>
  </div>
</div>
```

```javascript
import {
  initTriStateCheckbox,
  initTriStateCheckboxes,
} from "./components/checkbox.js";

const partial = initTriStateCheckbox(document.getElementById("partial"), {
  onChange: ({ state, indeterminate }) => console.log(state, indeterminate),
});

partial?.getState(); // "true" | "false" | "mixed"
partial?.setState("mixed");
partial?.cycle();

initTriStateCheckboxes(document); // all `[data-checkbox-tristate]` inputs
```

`data-checkbox-default` accepts `"true"`, `"false"`, or `"mixed"`. Click cycles **unchecked → checked → mixed** (fixed order — there is no `data-checkbox-tristate-cycle`; configurable cycle order is a **toggle** feature only). Native `indeterminate` is set for mixed; `aria-checked` mirrors the state. Use a wrapping `<label>` **or** `for` (not both) so a single click does not activate the control twice. Checked and mixed states use an inset `--surface` face (rounded square when checked, disc when mixed) mounted by `initIcons()` (via `initShell`); for checkboxes created later, call `ensureCheckboxFace(input)` from `app/utils/icons.js`.

#### Date picker

Calendar popup via [`app/components/date-picker/index.js`](app/components/date-picker/index.js). Add `data-date-picker-time` for an editable time field and side-by-side time panel; add `data-date-picker-seconds` to include seconds.

```html
<div class="date-picker" id="my-date-picker" data-date-picker-time>
  <label class="field-label" for="my-date-picker-input">Appointment</label>
  <div class="date-picker-row">
    <div class="date-picker-control">
      <input type="hidden" class="date-picker-value" />
      <input type="text" id="my-date-picker-input" class="input date-picker-input"
        placeholder="Jun 20, 2026" autocomplete="off" />
      <button type="button" class="date-picker-trigger" aria-label="Open calendar"
        data-icon="calendar" data-icon-class="date-picker-icon" aria-expanded="false"></button>
    </div>
    <input type="text" class="input date-picker-time" value="00:00"
      inputmode="numeric" autocomplete="off" aria-label="Time" />
    <div class="date-picker-popup hidden" role="dialog" aria-modal="true"
      aria-label="Choose date and time" hidden>
      <div class="date-picker-header">
        <button type="button" class="date-picker-nav btn btn-link" data-date-picker-prev aria-label="Previous month">‹</button>
        <div class="date-picker-caption" aria-live="polite"></div>
        <button type="button" class="date-picker-nav btn btn-link" data-date-picker-next aria-label="Next month">›</button>
      </div>
      <div class="date-picker-weekdays" aria-hidden="true">
        <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
      </div>
      <div class="date-picker-grid" role="grid"></div>
      <div class="date-picker-actions">
        <button type="button" class="btn btn-slim date-picker-quick-btn" data-date-picker-today>Today</button>
        <button type="button" class="btn btn-slim date-picker-quick-btn" data-date-picker-now hidden>Now</button>
      </div>
    </div>
  </div>
</div>
```

```javascript
import { initDatePicker, initDatePickers } from "./components/date-picker/index.js";

const picker = initDatePicker(document.getElementById("my-date-picker"), {
  onChange: ({ isoDate, time, display }) => console.log(isoDate, time, display),
});

picker?.setValue({ isoDate: "2026-06-20", time: "14:30" });
picker?.getValue();

initDatePickers(document);
```

`data-date-min` and `data-date-max` accept ISO dates (`YYYY-MM-DD`). The hidden `.date-picker-value` field stores the selected date for forms.

Click the **month** or **year** in the popup header to open quick-pick grids. Choosing a year returns to the month grid; choosing a month returns to days. Prev/next arrows change month, year, or 12-year window depending on the current view. Escape steps back through views before closing.

The date field accepts typed or pasted values (for example `2026-06-20` or `Jun 20, 2026`). Values are validated on blur or Enter; invalid input reverts to the last valid date. Arrow Down opens the calendar while the field is focused.

The calendar grid starts weeks on Monday. Weekday labels in markup are optional — `initDatePicker()` fills `.date-picker-weekdays` when missing or out of date.

The day view includes **Today** below a date-only calendar. Combined pickers have one action bar spanning both panels: **Today** selects the current date at `00:00`, while **Now** selects the current date and time.

When `data-date-picker-time` is set, the side time column uses the shared time panel **without** its own **00:00** / **Now** row — those actions would duplicate the combined **Today** / **Now** bar under the calendar (`initDatePicker` mounts the time panel with `showZero: false` and `showNow: false`).

#### Time picker

Time of day without a date. The editable text field opens a popup with independently wrapping hour, minute, and optional second columns. The legacy native `<input type="time">` markup remains supported when no custom popup is present.

```html
<div class="time-picker" id="my-time-picker" data-time-picker-default="14:30">
  <label class="field-label" for="my-time-picker-input">Time</label>
  <div class="time-picker-control">
    <input type="text" id="my-time-picker-input" class="input time-picker-input"
      value="14:30" inputmode="numeric" autocomplete="off" />
    <button type="button" class="time-picker-trigger" aria-label="Open time picker"
      data-icon="clock" data-icon-class="time-picker-icon" aria-expanded="false"></button>
  </div>
  <div class="time-picker-popup hidden" role="dialog" aria-label="Choose time" hidden>
    <div class="time-picker-panel"></div>
  </div>
  <input type="hidden" class="time-picker-value" name="time" />
</div>
```

```javascript
import { initTimePicker, initTimePickers } from "./components/time-picker.js";

const timePicker = initTimePicker(document.getElementById("my-time-picker"), {
  onChange: ({ value }) => { /* HH:MM or HH:MM:SS */ },
  // defaultValue: "14:30",
  // min: "09:00",
  // max: "17:00",
  // showSeconds: true,
  // showZero: true,
  // showNow: true,
});

timePicker?.getValue();
timePicker?.setValue("09:15");

initTimePickers(document);
```

`data-time-picker-default`, `data-time-picker-min`, `data-time-picker-max`, `data-time-picker-seconds`, `data-time-picker-zero`, `data-time-picker-now`, and `data-time-picker-disabled` mirror the JS options.

**Quick actions (`showZero` / `showNow`):** The popup can show **00:00** (`showZero`, default `true`) and **Now** (`showNow`, default `true` in time mode). Pass `showZero: false` / `showNow: false` or set `data-time-picker-zero="false"` / `data-time-picker-now="false"` to hide either button. **Now** is never shown in duration mode — clock “now” is not a meaningful duration preset.

| Host | Popup quick actions | Configurable? |
| ---- | ------------------- | ------------- |
| Standalone [`initTimePicker`](#time-picker) | **00:00** + **Now** (defaults above) | Yes — options / `data-time-picker-zero` / `data-time-picker-now` |
| [`initTimePicker` duration mode](#time-picker) | **00:00** only | `showZero` only (`showNow` ignored) |
| [`initDurationInput`](#duration-input) | **00:00** (or **00:00:00** with seconds) | Fixed — always reset via popup; no **Now** |
| [`initDatePicker` + time](#date-picker) | None on the time column | Fixed — use **Today** / **Now** in `.date-picker-actions` instead |

**Duration mode:** `initTimePicker` also accepts `mode: "duration"` (or `data-time-picker-mode="duration"`) to render the hours / minutes / (optional seconds) panel without a clock time-of-day field — useful when embedding the panel elsewhere. For form duration fields, prefer [`initDurationInput`](#duration-input): it adds inline segments, a hidden `.duration-input-value`, and the clock trigger automatically.

Clicking the field selects the hour, minute, or second block under the pointer; keyboard focus selects hours. Arrow Up / Down wraps the selected block independently, Arrow Left / Right or `:` moves between blocks, and Alt+Arrow Down opens the popup.

#### Duration input

Segmented hours and minutes (optional seconds) with a clock-triggered popup using the same panel as the time picker in duration mode. Stores `H:MM` or `H:MM:SS` in `.duration-input-value`. The trigger and popup are created automatically when omitted.

Focusing or clicking an inline segment selects its full value; clicking the control background focuses hours. Inline Arrow Up / Down nudges the focused segment, while popup buttons wrap each column independently (`0` ↔ `maxHours` for hours, `00` ↔ `59` otherwise). `:` or Arrow Right moves to the next inline field. The popup **00:00** action (or **00:00:00** with seconds) resets the duration and closes — there is no **Now** action (`initDurationInput` always mounts the panel in duration mode with `showZero: true`, `showNow: false`; not configurable).

```html
<div class="duration-input" id="my-duration" data-duration-default="1:30">
  <span class="field-label" id="my-duration-label">Duration</span>
  <div class="duration-input-control" role="group" aria-labelledby="my-duration-label">
    <input type="text" class="input duration-input-hours" inputmode="numeric" aria-label="Hours" />
    <span class="duration-input-sep" aria-hidden="true">:</span>
    <input type="text" class="input duration-input-minutes" inputmode="numeric" aria-label="Minutes"
      maxlength="2" />
  </div>
  <input type="hidden" class="duration-input-value" name="duration" />
</div>
```

Include seconds with a `.duration-input-seconds` field or `data-duration-seconds` (init will append the seconds segment when the attribute is set).

```javascript
import { initDurationInput, initDurationInputs } from "./components/duration-input.js";

const duration = initDurationInput(document.getElementById("my-duration"), {
  onChange: ({ value, totalSeconds }) => { /* committed — blur / Enter / nudge */ },
  onInput: ({ value, totalSeconds }) => { /* live draft while typing; also syncs `.duration-input-value` */ },
  // defaultValue: "1:30",
  // maxHours: 24,
  // showSeconds: true,
});

duration?.getValue(); // last committed value (not the in-progress draft)
duration?.getSeconds();
duration?.setValue("2:05");
duration?.setSeconds(90);
duration?.open();
duration?.close();

initDurationInputs(document);
```

### File dropzone

Drag-and-drop or click-to-browse file picker. Selected files appear in a list with remove buttons.

```html
<div class="file-dropzone" id="my-dropzone" data-file-accept="image/*" data-file-multiple data-file-max="5">
  <input type="file" class="file-dropzone-input" hidden />
  <button type="button" class="file-dropzone-prompt">
    <span data-icon="upload" data-icon-class="file-dropzone-icon"></span>
    <span class="file-dropzone-text">
      <span class="file-dropzone-primary">Drop files here</span>
      <span class="file-dropzone-secondary">select to browse</span>
    </span>
  </button>
  <ul class="file-dropzone-list hidden" hidden></ul>
</div>
```

```javascript
import { initFileDropzone, initFileDropzones } from "./components/file-dropzone.js";

const dropzone = initFileDropzone(document.getElementById("my-dropzone"), {
  onFiles: ({ files }) => console.log(files),
  onError: ({ message }) => console.warn(message),
  onClear: () => console.log("cleared"),
});

dropzone?.openPicker();
dropzone?.getFiles();
dropzone?.clear();

initFileDropzones(document); // wire every `.file-dropzone`
```

`data-file-accept` maps to the hidden input's `accept`. `data-file-multiple` enables multi-select. `data-file-max` caps how many files can be added (extra files are trimmed; `onError` is called).

On init, the prompt shows a `.file-dropzone-meta` line when there is something non-default to communicate: allowed types (from `accept`) and/or a multi-file count (`Up to N files` or `Multiple files`). A plain single-file dropzone with no `accept` shows no meta line. The element is created if missing.

### File download

Full-width `.btn` rows (standard control height) with an inline download icon. Content is generated on demand when the user clicks the row.

```html
<div class="file-download" id="my-download">
  <ul class="file-download-list">
    <li>
      <button type="button" class="file-download-item btn" data-file-download-name="export.txt"
        aria-label="Download export.txt">
        <span class="file-download-item-name">export<span class="file-download-item-ext">.txt</span></span>
        <span class="file-download-item-meta">Plain text</span>
        <span data-icon="download" data-icon-class="btn-icon-svg"></span>
      </button>
    </li>
  </ul>
</div>
```

```javascript
import { downloadFile, initFileDownload, initFileDownloads } from "./components/file-download.js";

initFileDownload(document.getElementById("my-download"), {
  files: [
    {
      filename: "export.txt",
      getContent: () => `Generated at ${new Date().toISOString()}\n`,
    },
  ],
  onDownload: ({ filename, size }) => console.log(filename, size),
});

// Or trigger directly:
await downloadFile({
  filename: "notes.txt",
  content: "Plain text body",
});

initFileDownloads(document); // wire every `.file-download`
```

Pass a `files` array with per-file `getContent` callbacks. File size is shown in `.file-download-item-meta` when content can be resolved at init time.

### Image preview

Checkerboard viewport for inline SVG, image URLs, or `Blob` / `File`. Empty placeholder until content is set. Fit-to-box with scroll when oversized; optional pixelated rendering for pixel art.

```html
<div class="image-preview" id="my-preview" aria-live="polite"
  data-image-preview-pixelated
  data-image-preview-maximize
  data-image-preview-expand-on-click
  data-image-preview-download
  data-image-preview-download-name="preview.svg"
  data-image-preview-dimensions
  data-image-preview-file-size
  data-image-preview-frames
  data-image-preview-duration
  data-image-preview-meta-extra="Scale 4×"
  data-image-preview-meta="hover"
  data-expandable-surface
  data-expandable-surface-click
  data-expandable-surface-label="Preview">
  <p class="image-preview__empty">No image</p>
</div>
```

```javascript
import { initImagePreview, initImagePreviews } from "./components/image-preview.js";
import { initExpandableSurfaces } from "./components/expandable-surface.js";

const preview = initImagePreview(document.getElementById("my-preview"));
preview?.setMetaExtra("Scale 4×");
preview?.setSvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">…</svg>`);
// preview?.setSrc("app/res/example.png", { alt: "Example" });
// preview?.setBlob(file, { alt: file.name });
// preview?.setMetaExtra(`Scale ${scale}×`); // update app-specific text
// preview?.clear();

initExpandableSurfaces(document); // required when maximise attrs are used
initImagePreviews(document); // wire every `.image-preview`
```

`data-image-preview-pixelated` uses nearest-neighbour scaling. `data-image-preview-maximize` shows the floating fullscreen control; `data-image-preview-expand-on-click` toggles maximise when clicking the viewport (not controls). Either option maps onto expandable-surface (`data-expandable-surface`, optional `data-expandable-surface-click`, and `data-expandable-surface-control="false"` when only click-to-expand is on). Prefer putting `data-expandable-surface` (and `data-expandable-surface-click` when needed) in HTML before `initExpandableSurfaces()`, or call `initExpandableSurfaces()` after `initImagePreview()`.

`data-image-preview-download` adds a floating download control (same hover strip as maximise). Optional `data-image-preview-download-name` sets the default filename. Pre-existing markup `<img>` children are wired for download via their `src`. `data-image-preview-dimensions` and `data-image-preview-file-size` show muted intrinsic size (`W × H px`) and/or source byte size in the bottom-right corner. For inline SMIL SVG (including multi-frame `g#frame-N` groups), `data-image-preview-frames` shows `frame K/N` while animating and `data-image-preview-duration` shows the loop length (e.g. `1.5 s`). Frame/duration meta does not apply to GIF/APNG/WebP loaded via `<img>`.

`setSvg()` sanitizes markup before injection (strips scripts, event handlers, and other active content; keeps SMIL `animate*` / `set` when otherwise clean) and returns `false` when nothing safe remains.

`data-image-preview-meta` controls when that muted strip is visible: `hover` (default — show on hover like the floating buttons), `always`, or `never`. On touch devices without hover, `hover` behaves like `always`. Add `data-image-preview-meta-extra` or pass `metaExtra` to `initImagePreview()` to append app-specific text, such as a scale; `setMetaExtra(text)` updates or clears it at runtime.

Object URLs from `setBlob` are revoked on replace, `clear()`, and `destroy()`.

### Panel layout

Use `.section-panel` as the reusable padded surface. Add `.panel-title` and `.panel-hint` for its heading, `.panel-row` for wrapping controls (`.panel-row--spread` distributes them), `.panel-inline` for inline groups (layout only — does not change font size), and `.panel-grid` with `.panel-grid-2`, `.panel-grid-3`, or `.panel-grid-4` for responsive columns.

```html
<section class="section-panel">
  <h3 class="panel-title">Preferences</h3>
  <p class="panel-hint">Choose how this page behaves.</p>
  <div class="panel-grid panel-grid-2">
    <div class="panel-stack"><!-- stacked fields --></div>
    <div class="panel-stack"><!-- stacked fields --></div>
  </div>
  <hr class="panel-divider" />
  <div class="panel-row panel-row--spread">
    <span class="panel-inline"><!-- compact status --></span>
    <button type="button" class="btn btn-primary">Save</button>
  </div>
</section>
```

The three- and four-column grid variants collapse to one column below 900px; the four-column variant first drops to two columns below 1100px. Use `.panel-split` when columns need full-bleed dividers.

### Panel split

Side-by-side columns inside a padded panel (any host that sets `--panel-padding`, e.g. `.section-panel` or a bordered card). Columns are `.panel-stack` blocks separated by `.panel-divider.panel-divider--vertical`. Use `.panel-divider` alone for a full-bleed horizontal rule between stacked blocks. Add `.panel-split--3` for three columns (divider between each). Add `.panel-split--3x2` for a 3×2 grid with a single vertical rail after column 1 (child order: col1-row1, col1-row2, divider, col2-row1, col3-row1, col2-row2, col3-row2). Add `.panel-split--after-heading` when a title or hint sits above the split so the vertical rules do not bleed into that heading.

```html
<div class="section-panel">
  <div class="panel-split">
    <div class="panel-stack">
      <h3 class="section-title">Left</h3>
      <!-- … -->
    </div>
    <hr class="panel-divider panel-divider--vertical" aria-hidden="true" />
    <div class="panel-stack">
      <h3 class="section-title">Right</h3>
      <!-- … -->
    </div>
  </div>
  <hr class="panel-divider" />
  <p>Content below the split.</p>
</div>
```

On narrow viewports the split stacks and vertical dividers become horizontal rules.

### Section panel

Three-column grid rows for compact forms. Stack fields across rows; use `.section-panel__divider` before actions.

```html
<div class="section-panel">
  <div class="section-panel__grid">
    <label class="field section-panel__field" for="name">
      <span class="field-label">Label</span>
      <input type="text" id="name" class="input" />
    </label>
  </div>
  <div class="section-panel__grid">
    <div class="section-panel__controls">
      <button type="button" class="btn btn-toggle" aria-pressed="false">Toggle</button>
      <div class="toggle" data-toggle-default="false">
        <button type="button" class="toggle-btn" role="switch" aria-checked="false">
          <span class="toggle-track" aria-hidden="true">
            <span class="toggle-thumb">
              <span data-icon="check" data-icon-class="toggle-thumb-icon" aria-hidden="true"></span>
            </span>
          </span>
          <span class="toggle-label">Enable option</span>
        </button>
        <input type="hidden" class="toggle-value" value="false" />
      </div>
    </div>
  </div>
  <div class="section-panel__grid">
    <label class="checkbox section-panel__checkbox" for="remember">
      <input type="checkbox" class="checkbox-input" id="remember" />
      <span>Remember settings</span>
    </label>
  </div>
  <hr class="section-panel__divider" />
  <div class="section-panel__row">
    <div class="section-panel__feedback">
      <div id="section-success" class="banner banner-success hidden" role="status" hidden
        data-banner-expire="1500">
        <span class="banner-icon" data-icon="success" data-icon-class="banner-icon-svg"></span>
        <span class="banner-body">Submitted</span>
      </div>
    </div>
    <button type="button" class="btn btn-primary section-panel__submit">Submit</button>
  </div>
</div>
```

```javascript
import { showBanner, hideBanner } from "./components/banner.js";

submitBtn.addEventListener("click", () => {
  hideBanner(successBanner);
  hideBanner(errorBanner);
  showBanner(hasText ? successBanner : errorBanner);
});
```

See the interactive example on [`demo.html`](demo.html).

### Combo button

```javascript
import { initCombo } from "./components/combo.js";

initCombo(document.getElementById("my-combo"), {
  onMainClick: () => { /* primary action */ },
  onSelect: ({ value, label }) => { /* menu item chosen */ },
});
```

Markup: `.combo-btn` > `.combo-btn-main` + `.combo-btn-toggle` + `ul.combo-menu` with `.combo-menu-item` buttons.

### Combobox

Text field with a filterable suggestion list. Options can live in markup or be supplied in JS. By default the value must match a list item; set `allowCustom: true` or `data-combobox-allow-custom` to accept free text.

```html
<div class="combobox" id="my-combobox">
  <label class="field-label" for="my-combobox-input">City</label>
  <div class="combobox-control">
    <input type="text" id="my-combobox-input" class="input combobox-input" role="combobox"
      aria-expanded="false" aria-autocomplete="list" aria-controls="my-combobox-list" autocomplete="off"
      placeholder="Search…" />
    <ul id="my-combobox-list" class="combobox-list hidden" role="listbox" hidden>
      <li role="presentation">
        <button type="button" class="combobox-option" role="option" data-value="nyc">New York</button>
      </li>
    </ul>
  </div>
</div>
```

```javascript
import { initCombobox, initComboboxes } from "./components/combobox.js";

const combobox = initCombobox(document.getElementById("my-combobox"), {
  onSelect: ({ value, label }) => { /* item chosen from list */ },
  onChange: ({ value, label, input }) => { /* value committed or cleared */ },
  onInput: ({ query, matches }) => { /* filter text changed */ },
  gridMin: 8, // optional; switch to grid when visible option count exceeds 8
  gridCols: 2,
  // options: [{ value: "nyc", label: "New York" }, …],  // replace markup list
  // filter: (query, option) => option.label.startsWith(query),
  // allowCustom: true,
  // defaultValue: "nyc",
});

combobox?.setGridMin(10);
combobox?.syncListGrid(); // after setOptions / filter changes visible count

combobox?.getValue();
combobox?.setValue("nyc");
combobox?.setOptions([{ value: "nyc", label: "New York" }]);

initComboboxes(document); // all `.combobox` blocks
```

Keyboard: ArrowDown / ArrowUp navigate suggestions (left/right too in grid mode), Enter selects, Escape closes and restores the last committed value.

Optional **auto grid** — same semantics as [Dropdown](#dropdown): set `data-combobox-grid="8"` (or `data-combobox-grid-min`, `data-combobox-grid-cols`, `data-combobox-grid="false"`) on the `.combobox` host, or pass `gridMin` / `gridCols` to `initCombobox()`. Layout uses the **visible** option count (after filtering). Adjacent selected cells share one rounded outline, including inner corners. The returned object exposes `setGridMin()`, `setGridCols()`, `getGridConfig()`, and `syncListGrid()`.

#### Multi-select

Set `data-combobox-multi` (or `multi: true`) to toggle multiple options. Behaviour matches single-select for filter, arrows, and Escape; the list **stays open** while toggling options (closes on Escape, blur, or outside click). The input shows selected labels as a comma-separated list. Typing replaces that summary with a filter query; the summary is restored when the list closes (including when the filter is emptied — selection is not cleared by blur). Clear the selection with `setValues([])` / `setValue("")`. Option `data-value`s and custom free-text values must not contain commas (the `.combobox-value` / `getValue()` delimiter); comma-containing values are rejected. Selection count uses a [Badge](#badge) on the control (wrap `.combobox-control` in `.badge-host` with a `.badge`, or omit that markup and let `initCombobox` create it). Initial selection: `aria-selected="true"` on options, a comma-separated `.combobox-value`, or `defaultValues` / `defaultValue` in JS.

```html
<div class="combobox" id="my-combobox-multi" data-combobox-multi>
  <label class="field-label" for="my-combobox-multi-input">Cities</label>
  <span class="badge-host" data-badge-label="Cities">
    <div class="combobox-control">
      <input type="text" id="my-combobox-multi-input" class="input combobox-input" role="combobox"
        aria-expanded="false" aria-autocomplete="list" aria-controls="my-combobox-multi-list"
        autocomplete="off" placeholder="Search cities…" data-badge-control />
      <ul id="my-combobox-multi-list" class="combobox-list hidden" role="listbox" aria-multiselectable="true" hidden>
        <li role="presentation">
          <button type="button" class="combobox-option" role="option" data-value="nyc"
            aria-selected="true">New York</button>
        </li>
        <li role="presentation">
          <button type="button" class="combobox-option" role="option" data-value="chi">Chicago</button>
        </li>
      </ul>
    </div>
    <span class="badge" aria-hidden="true">1</span>
  </span>
  <input type="hidden" class="combobox-value" value="nyc" />
</div>
```

```javascript
const multi = initCombobox(document.getElementById("my-combobox-multi"), {
  onToggle: ({ value, selected, values }) => { /* option toggled */ },
  onChange: ({ values, labels }) => { /* selection changed */ },
  // defaultValues: ["nyc", "chi"],
});

multi?.getValues(); // ["nyc", …]
multi?.setValues(["nyc", "chi"]);
multi?.getSelected(); // [{ value, label, item }, …]
```

Start the badge with the initial count (or `hidden` when zero) so it does not flash before `initCombobox` runs. See the interactive example on [`demo.html`](demo.html).

### Slider

Range input with a compact value field beside the track. Drag the thumb or type a value directly; typed values are clamped to min/max and snapped to `step` on blur or Enter. Escape restores the last committed value while editing.

Formats: `integer` (default), `decimal`, or `percentage` (shows a `%` suffix; values are still stored as plain numbers, e.g. `75` for 75%).

```html
<div class="slider" id="my-slider" data-slider-min="0" data-slider-max="100"
  data-slider-default="50" data-slider-format="percentage">
  <label class="field-label" for="my-slider-range">Opacity</label>
  <div class="slider-row">
    <input type="range" id="my-slider-range" class="slider-range" />
    <div class="slider-input-wrap">
      <input type="text" class="input slider-input" inputmode="decimal" aria-label="Value" />
      <span class="slider-suffix hidden" aria-hidden="true">%</span>
    </div>
    <input type="hidden" class="slider-value" name="opacity" />
  </div>
</div>
```

```javascript
import { initSlider, initSliders } from "./components/slider.js";

const slider = initSlider(document.getElementById("my-slider"), {
  min: 0,
  max: 100,
  step: 1,
  defaultValue: 50,
  format: "percentage", // "integer" | "decimal" | "percentage"
  disabled: false,
  onChange: ({ value, display, source }) => console.log(value, display, source),
  onInput: ({ value }) => { /* live while dragging or typing */ },
});

slider?.getValue();
slider?.setValue(25);
slider?.setDisabled(true);
slider?.isDisabled();
slider?.commitInput(); // commit typed text without blur

initSliders(document); // all `.slider` blocks
```

`data-slider-min`, `data-slider-max`, `data-slider-step`, `data-slider-default`, `data-slider-format`, and `data-slider-disabled` mirror the JS options. The hidden `.slider-value` field stores the numeric value for forms.

### Progress bar

Horizontal fill for a value between min and max. Omit `.progress-bar-label` for a bar only; add it with `data-progress-bar-label="percent"` or `"fraction"` to show `75%` or `7/12` beside the track. Set `data-progress-bar-shine` for a soft highlight that sweeps left→right across the filled segment (disabled while indeterminate, in error, or disabled, and when `prefers-reduced-motion` is set). Set `data-progress-bar-error` for a stuck/failed state: the fill stays at the current value, turns red, and pulses as a whole (mutually exclusive with indeterminate; pulse respects `prefers-reduced-motion`). Set `data-progress-bar-disabled` for a muted, non-animated display (form hidden input is disabled). Set `data-progress-bar-indeterminate` when work is running but progress is unknown; `data-progress-bar-indeterminate-mode` picks the motion — `"sweep"` (default) loops a segment left→right, `"bounce"` sends it left→right and back.

```html
<div class="progress-bar" id="my-progress-bar" data-progress-bar-value="65" data-progress-bar-max="100"
  data-progress-bar-label="percent" data-progress-bar-shine>
  <label class="field-label" id="my-progress-bar-label">Upload progress</label>
  <div class="progress-bar-row">
    <div class="progress-bar-track" role="progressbar" aria-valuemin="0" aria-valuemax="100"
      aria-valuenow="65" aria-labelledby="my-progress-bar-label">
      <span class="progress-bar-fill"></span>
    </div>
    <span class="progress-bar-label" aria-hidden="true">65%</span>
  </div>
  <input type="hidden" class="progress-bar-value" name="upload-progress" value="65" />
</div>
```

Fraction label (`7/12`) — set `data-progress-bar-label="fraction"` and match `data-progress-bar-max` to the denominator:

```html
<div class="progress-bar" data-progress-bar-value="7" data-progress-bar-max="12" data-progress-bar-label="fraction">
  <!-- same .progress-bar-row structure -->
</div>
```

Error (stuck) state — keep the value and set `data-progress-bar-error`:

```html
<div class="progress-bar" data-progress-bar-value="55" data-progress-bar-max="100"
  data-progress-bar-label="percent" data-progress-bar-error>
  <!-- same .progress-bar-row structure -->
</div>
```

Indeterminate — the value is ignored; omit it along with the label. Add `data-progress-bar-indeterminate-mode="bounce"` for the back-and-forth motion instead of the default looping sweep:

```html
<div class="progress-bar" data-progress-bar-indeterminate data-progress-bar-indeterminate-mode="bounce">
  <!-- same .progress-bar-row structure, without aria-valuenow -->
</div>
```

Disabled — muted and frozen (no shine / pulse / indeterminate motion):

```html
<div class="progress-bar" data-progress-bar-value="30" data-progress-bar-max="100"
  data-progress-bar-label="percent" data-progress-bar-disabled>
  <!-- same .progress-bar-row structure -->
</div>
```

```javascript
import { initProgressBar, initProgressBars } from "./components/progress-bar.js";

const progressBar = initProgressBar(document.getElementById("my-progress-bar"), {
  value: 65,
  min: 0,
  max: 100,
  labelFormat: "percent", // "percent" | "fraction"
  indeterminate: false,
  indeterminateMode: "sweep", // "sweep" | "bounce"
  error: false,
  disabled: false,
  onChange: ({ value, percent, source }) => console.log(value, percent, source),
});

progressBar?.getValue();
progressBar?.setValue(80);
progressBar?.getPercent();
progressBar?.setIndeterminate(true);
progressBar?.setIndeterminate(true, { mode: "bounce" });
progressBar?.setIndeterminateMode("sweep");
progressBar?.getIndeterminateMode();
progressBar?.setError(true);
progressBar?.isError();
progressBar?.setDisabled(true);
progressBar?.isDisabled();

initProgressBars(document); // all `.progress-bar` blocks
```

`data-progress-bar-value`, `data-progress-bar-min`, `data-progress-bar-max`, `data-progress-bar-label`, `data-progress-bar-indeterminate`, `data-progress-bar-indeterminate-mode`, `data-progress-bar-error`, `data-progress-bar-disabled`, and `data-progress-bar-shine` mirror the markup options. The track uses `role="progressbar"` with `aria-valuenow` / `aria-valuetext` for screen readers. `setValue()` clears both indeterminate and error.

### Spinner

Loading indicator while a process runs in the background. Use inline for compact status, or wrap a region in `.spinner-host` with a `.spinner-overlay` to block interaction until ready. Sizes: default, `.spinner--sm`, `.spinner--lg`.

```html
<div class="spinner" role="status" aria-live="polite" aria-busy="true" aria-label="Loading">
  <span class="spinner-indicator" aria-hidden="true"></span>
  <span class="spinner-label">Loading data…</span>
</div>
```

Blocking overlay:

```html
<div class="spinner-host" id="my-panel">
  <p>Panel content…</p>
  <button type="button" class="btn">Edit</button>
  <div class="spinner-overlay hidden" hidden>
    <div class="spinner" role="status" aria-live="polite" aria-busy="true" aria-label="Loading data">
      <span class="spinner-indicator" aria-hidden="true"></span>
      <span class="spinner-label">Loading data…</span>
    </div>
  </div>
</div>
```

```javascript
import { initSpinner, initSpinners } from "./components/spinner.js";

const spinner = initSpinner(document.getElementById("my-spinner"), {
  visible: false,
  label: "Fetching results…",
  onChange: ({ visible, label, source }) => console.log(visible, source),
});

spinner?.show();
spinner?.hide();
spinner?.toggle();
spinner?.isVisible();
spinner?.setLabel("Saving…");

const panelSpinner = initSpinner(document.getElementById("my-panel"));
panelSpinner?.show();
// …await work…
panelSpinner?.hide();

initSpinners(document); // `.spinner-host` blocks and `[data-spinner-visible]` spinners
```

`data-spinner-visible` and `data-spinner-label` mirror the JS options. Pass a `.spinner` for inline use or a `.spinner-host` for overlay mode. While visible, the host gets `aria-busy="true"` and `pointer-events: none` on its content.

### Stepper

Numeric quantity control with decrement (−) and increment (+) buttons flanking a compact value field. Type a value directly or use Arrow Up / Down while focused. Values are clamped to min/max and snapped to `step` on blur or Enter.

```html
<div class="stepper" id="my-stepper" data-stepper-min="0" data-stepper-max="10" data-stepper-default="1">
  <label class="field-label" for="my-stepper-input">Quantity</label>
  <div class="stepper-control">
    <button type="button" class="btn btn-icon stepper-decrement" data-stepper-decrement
      aria-label="Decrease">−</button>
    <input type="text" id="my-stepper-input" class="input stepper-input" inputmode="numeric"
      aria-label="Quantity" />
    <button type="button" class="btn btn-icon stepper-increment" data-stepper-increment
      aria-label="Increase">+</button>
    <input type="hidden" class="stepper-value" name="quantity" />
  </div>
</div>
```

```javascript
import { initStepper, initSteppers } from "./components/stepper.js";

const stepper = initStepper(document.getElementById("my-stepper"), {
  min: 0,
  max: 10,
  step: 1,
  defaultValue: 1,
  format: "integer", // "integer" | "decimal"
  disabled: false,
  onChange: ({ value, display, source }) => console.log(value, source),
  onInput: ({ value }) => { /* live while typing */ },
});

stepper?.getValue();
stepper?.setValue(5);
stepper?.increment();
stepper?.decrement();
stepper?.setDisabled(true);
stepper?.commitInput();

initSteppers(document); // all `.stepper` blocks
```

`data-stepper-min`, `data-stepper-max`, `data-stepper-step`, `data-stepper-default`, `data-stepper-format`, and `data-stepper-disabled` mirror the JS options. Decrement and increment buttons disable at the min and max bounds.

### Colour input

Hex colour field with a colour swatch attached to the left of the input (same joined look as the colour picker hex row). The leading `#` is part of the field value (selectable / copyable) and rendered muted. Accepts `#RGB` or `#RRGGBB` (with or without `#` while typing). Values normalise to uppercase `#RRGGBB` on commit. With `data-color-input-alpha` (or `alpha: true`), also accepts `#RGBA` / `#RRGGBBAA`; if no alpha digits are given, commit normalises to full opacity (`#RRGGBBFF`). The swatch shows a checkerboard when empty, incomplete, or under a semi-transparent value.

Optional `data-color-input-open` / `openOnClick`: `none` (default), `picker`, `set`, or `both`. When not `none`, a nested (or passed) **colour set** and/or **colour picker** opens and stays in sync (including while typing a valid hex). Colour set highlights a matching swatch when possible and clears selection when the value is not in the active palette. Colour input remains the hex field — picker and set are separate components.

Optional `data-color-input-open-trigger` / `openTrigger` (when open is not `none`): `either` (default — swatch click or field focus), `swatch` (swatch only), or `input` (field focus only). Aliases: `image` → `swatch`, `field` → `input`. Opening from field focus keeps the caret in the hex input (`open({ focus: false })` on the partner); opening from the swatch still moves focus into the popup.

```html
<div class="color-input" id="my-color-input" data-color-input-default="#0969da">
  <label class="field-label" for="my-color-input-field">Colour</label>
  <div class="color-input-control">
    <span class="color-input-swatch" aria-hidden="true"></span>
    <input type="text" id="my-color-input-field" class="input color-input-field"
      placeholder="#0969DA" autocomplete="off" spellcheck="false" aria-label="Hex colour" />
    <input type="hidden" class="color-input-value" name="color" />
  </div>
</div>

<div class="color-input" id="my-color-input-alpha" data-color-input-alpha
  data-color-input-default="#ff338855">
  <label class="field-label" for="my-color-input-alpha-field">Colour with alpha</label>
  <div class="color-input-control">
    <span class="color-input-swatch" aria-hidden="true"></span>
    <input type="text" id="my-color-input-alpha-field" class="input color-input-field"
      placeholder="#RRGGBBAA" autocomplete="off" spellcheck="false"
      aria-label="Hex colour with alpha" />
    <input type="hidden" class="color-input-value" name="color" />
  </div>
</div>

<div class="color-input" id="my-color-input-set" data-color-input-open="set"
  data-color-input-default="#2196F3">
  <label class="field-label" for="my-color-input-set-field">Colour with set</label>
  <div class="color-input-control">
    <span class="color-input-swatch"></span>
    <input type="text" id="my-color-input-set-field" class="input color-input-field"
      placeholder="#RRGGBB" autocomplete="off" spellcheck="false" aria-label="Hex colour" />
    <input type="hidden" class="color-input-value" name="color" />
  </div>
  <div class="color-set" data-color-set-default="material" data-color-set-value="#2196F3">
    <button type="button" class="btn color-set-trigger" aria-expanded="false"
      aria-label="Open colour set">Colour set</button>
    <div class="color-set-popup hidden" role="dialog" aria-label="Colour set" hidden>
      <div class="color-set-panel">
        <select id="my-color-input-set-select" class="input color-set-select"
          aria-label="Colour set"></select>
        <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
      </div>
    </div>
  </div>
</div>
```

```javascript
import { initColorInput, initColorInputs } from "./components/color-input.js";

const colorInput = initColorInput(document.getElementById("my-color-input"), {
  defaultValue: "#0969da",
  disabled: false,
  onChange: ({ value, display, source }) => console.log(value, source),
  onInput: ({ value, display }) => { /* live while typing */ },
});

colorInput?.getValue(); // "#0969DA" or null
colorInput?.setValue("#ff5500");
colorInput?.setValue(""); // clear
colorInput?.commitInput();
colorInput?.setDisabled(true);

const alphaInput = initColorInput(document.getElementById("my-color-input-alpha"), {
  alpha: true,
  defaultValue: "#ff338855",
  onChange: ({ value }) => console.log(value), // "#FF338855"
});
alphaInput?.allowsAlpha(); // true

// Nested `.color-set` / `.color-picker` are initialised automatically when openOnClick is set.
// openTrigger defaults to "either" (swatch or field focus). Or pass: { openTrigger: "swatch" | "input" }
// Or pass existing instances: initColorInput(el, { openOnClick: "picker", picker: pickerApi })
initColorInput(document.getElementById("my-color-input-set"));

initColorInputs(document); // all `.color-input` blocks
```

`data-color-input-default`, `data-color-input-alpha`, `data-color-input-disabled`, `data-color-input-open`, and `data-color-input-open-trigger` mirror the JS options. `parseHexColor(value, { alpha })` is exported from colour input and from [`app/utils/color.js`](app/utils/color.js).

### Colour set

Named palette gallery. Default mode is a trigger button that opens a popup (date-picker style). Set `data-color-set-embedded` for an always-visible panel. Built-in palettes live as one module each under `app/components/color-set/sets/` and register via `ensureBuiltinColorSets()` (called automatically by `initColorSet`). Add or edit a set by adding/updating a module and importing it from `sets/index.js`.

```html
<div class="color-set" id="my-color-set" data-color-set-default="material">
  <button type="button" class="btn color-set-trigger" aria-expanded="false"
    aria-label="Open colour set">Colour set</button>
  <div class="color-set-popup hidden" role="dialog" aria-label="Colour set" hidden>
    <div class="color-set-panel">
      <select id="my-color-set-select" class="input color-set-select"
        aria-label="Colour set"></select>
      <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
    </div>
  </div>
</div>

<div class="color-set" id="my-color-set-embedded" data-color-set-embedded
  data-color-set-sets="basic,material,metro" data-color-set-default="basic">
  <div class="color-set-panel">
    <select id="my-color-set-embedded-select" class="input color-set-select"
      aria-label="Colour set"></select>
    <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
  </div>
</div>
```

```javascript
import {
  initColorSet,
  initColorSets,
  registerColorSet,
  listColorSets,
} from "./components/color-set/index.js";

const colorSet = initColorSet(document.getElementById("my-color-set"), {
  defaultSet: "material",
  onSelect: ({ value, name, setId }) => console.log(value, name, setId),
});

colorSet?.open();
colorSet?.getValue();
colorSet?.setValue("#2196F3");
colorSet?.setSetId("tailwind");

initColorSets(document);
// Skips hosts that are already initialised (e.g. nested under colour input / picker).

// Custom palette (optional — besides the built-in modules):
registerColorSet({
  id: "brand",
  name: "Brand",
  colors: ["#0969da", { hex: "#1a7f37", name: "Success" }],
});
```

`data-color-set-embedded`, `data-color-set-sets`, `data-color-set-default`, `data-color-set-value`, `data-color-set-alpha`, and `data-color-set-close-on-select` mirror the JS options. Popup mode closes after a swatch click by default (`closeOnSelect: true`). Named swatches use `data-tooltip` (shell tooltips).

### Colour picker

Spectrum / channel colour selector. Default mode is a trigger that opens a popup. Set `data-color-picker-embedded` for an always-visible panel. The value row shows the current swatch, a hex field (shared input styling), and a format dropdown on the field (HEX / RGB / HSL / HSV / CMYK) in the same pattern as the tabular-input type menu. The hex field updates the colour live while typing (same as colour input) once the value is a valid hex; the leading `#` stays in the value and is shown muted; blur / Enter normalises or reverts invalid text. Switching format changes the visual above: HSV and HEX use a saturation/value plane + hue slider (arrow keys / Home / End nudge the plane; Shift multiplies the step); HSL uses saturation/lightness + hue; RGB and CMYK use the shared **slider** component for each channel (range + editable value). Optional `data-color-picker-alpha` adds an alpha channel via the same slider. Optional `data-color-picker-color-set` shows a palette icon button on the value row that toggles an adjacent colour-set panel (requires a `.color-picker-sets` host in markup). `setValue()` returns `false` for empty or invalid hex (it does not fall back to the default blue).

```html
<div class="color-picker" id="my-color-picker" data-color-picker-default="#0969da"
  data-color-picker-color-set>
  <button type="button" class="btn color-picker-trigger" aria-expanded="false"
    aria-label="Open colour picker">Colour picker</button>
  <div class="color-picker-popup hidden" role="dialog" aria-label="Colour picker" hidden>
    <div class="color-picker-shell">
      <div class="color-picker-panel"></div>
      <div class="color-set color-picker-sets hidden" data-color-set-embedded hidden>
        <div class="color-set-panel">
          <select id="my-color-picker-set-select" class="input color-set-select"
            aria-label="Colour set"></select>
          <div class="color-set-grid" role="listbox" aria-label="Colours"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="color-picker" id="my-color-picker-embedded" data-color-picker-embedded
  data-color-picker-default="#1a7f37" data-color-picker-format="hex">
  <div class="color-picker-shell">
    <div class="color-picker-panel"></div>
  </div>
</div>
```

```javascript
import { initColorPicker, initColorPickers } from "./components/color-picker/index.js";

const picker = initColorPicker(document.getElementById("my-color-picker"), {
  format: "hsv",
  colorSet: true,
  onChange: ({ value, format, source }) => console.log(value, format, source),
});

picker?.getValue();
picker?.setValue("#FF5500");
picker?.setFormat("rgb");
picker?.openColorSet();
picker?.open();

initColorPickers(document);
// Skips hosts that are already initialised (e.g. nested under colour input).
```

`data-color-picker-embedded`, `data-color-picker-default`, `data-color-picker-alpha`, `data-color-picker-format`, and `data-color-picker-color-set` mirror the JS options. Escape closes the colour-set panel first (when open), then the picker popup.

### Control sizing

Three different “slim” APIs — they are not interchangeable:

| Class | Effect |
| ----- | ------ |
| `.btn-slim` | Compact button height via `--control-height-slim` |
| `.segmented-control--slim` | Reduced padding on the track; does **not** use `--control-height-slim` |
| `.toggle--slim` | Thin track with an oversized overhanging thumb; not a height token |

Tabular input logical columns always use `.toggle--slim` (no standard-size toggle in that grid).

### Toggle

On/off switch for boolean settings. Uses `role="switch"` and `aria-checked` on the button; a hidden `.toggle-value` field stores `"true"` or `"false"` for forms.

```html
<div class="toggle" id="my-toggle" data-toggle-default="false">
  <button type="button" class="toggle-btn" role="switch" aria-checked="false">
    <span class="toggle-track" aria-hidden="true">
      <span class="toggle-thumb">
        <span data-icon="check" data-icon-class="toggle-thumb-icon toggle-thumb-icon--on" aria-hidden="true"></span>
      </span>
    </span>
    <span class="toggle-label">Enable notifications</span>
  </button>
  <input type="hidden" class="toggle-value" name="notifications" value="false" />
</div>
```

Add `.toggle--slim` for a thin track with an oversized thumb that overhangs the slot. Omit thumb icons (CSS hides them if present).

```html
<div class="toggle toggle--slim" id="my-toggle-slim" data-toggle-default="false">
  <button type="button" class="toggle-btn" role="switch" aria-checked="false">
    <span class="toggle-track" aria-hidden="true">
      <span class="toggle-thumb"></span>
    </span>
    <span class="toggle-label">Compact setting</span>
  </button>
  <input type="hidden" class="toggle-value" name="compact" value="false" />
</div>
```

Tri-state variant (`data-toggle-tristate`) cycles through off, on, and mixed. **`data-toggle-tristate-cycle` / `tristateCycle` apply to toggles only** — tri-state checkboxes use a fixed unchecked → checked → mixed order (see [Inputs](#inputs)). Default toggle order is **off → mixed → on**. Set `data-toggle-tristate-cycle` (or `tristateCycle` in JS) to change direction:

| Cycle | Order |
| ----- | ----- |
| `default` (omit) | off → mixed → on → off |
| `on-mixed` | off → on → mixed → off |
| `mixed-both` | off → mixed → on → mixed → off |

ARIA `switch` is boolean-only, so tri-state buttons use `role="checkbox"` with `aria-checked="mixed"`. Include a minus (`remove`) icon for the mixed thumb, or one is injected automatically.

```html
<div class="toggle" id="my-toggle-tri" data-toggle-tristate data-toggle-default="mixed">
  <button type="button" class="toggle-btn" role="checkbox" aria-checked="mixed">
    <span class="toggle-track" aria-hidden="true">
      <span class="toggle-thumb">
        <span data-icon="check" data-icon-class="toggle-thumb-icon toggle-thumb-icon--on" aria-hidden="true"></span>
        <span data-icon="remove" data-icon-class="toggle-thumb-icon toggle-thumb-icon--mixed" aria-hidden="true"></span>
      </span>
    </span>
    <span class="toggle-label">Apply to selection</span>
  </button>
  <input type="hidden" class="toggle-value" name="apply" value="mixed" />
</div>
```

```javascript
import { initToggle, initToggles } from "./components/toggle.js";

const toggle = initToggle(document.getElementById("my-toggle"), {
  defaultChecked: false,
  disabled: false,
  onChange: ({ checked, source }) => console.log(checked, source),
});

toggle?.getChecked();
toggle?.setChecked(true);
toggle?.toggle();
toggle?.setDisabled(true);

const tri = initToggle(document.getElementById("my-toggle-tri"), {
  onChange: ({ state }) => console.log(state),
});

tri?.getState(); // "true" | "false" | "mixed"
tri?.setState("mixed");
tri?.cycle();
tri?.getTristateCycle(); // "default" | "on-mixed" | "mixed-both" | null

initToggles(document); // all `.toggle` blocks
```

`data-toggle-default`, `data-toggle-tristate`, `data-toggle-tristate-cycle`, and `data-toggle-disabled` mirror the JS options. For a group of switches, wrap items in `.toggle-group`.

### Segmented control

Toggle button group for switching between a small set of options or views — like radio buttons in a joined control. Items use `role="radio"` and `aria-checked`; a hidden `.segmented-control-value` stores the selected value for forms.

Default height matches `.btn` (`--control-height`). Add `.segmented-control--slim` for the compact size. Add `.segmented-control--full` on the root to stretch the track to the field width. Optionally pair items with panels via `aria-controls` (same pattern as tabs).

```html
<div class="segmented-control segmented-control--full" id="my-segmented" data-segmented-control-default="list">
  <div class="segmented-control-list" role="radiogroup" aria-label="View mode">
    <button type="button" class="segmented-control-item" role="radio" aria-checked="true"
      data-segmented-control-value="list">List</button>
    <button type="button" class="segmented-control-item" role="radio" aria-checked="false"
      data-segmented-control-value="grid">Grid</button>
    <button type="button" class="segmented-control-item" role="radio" aria-checked="false"
      data-segmented-control-value="map">Map</button>
  </div>
  <input type="hidden" class="segmented-control-value" name="view" value="list" />
</div>
```

Compact (previous default) size:

```html
<div class="segmented-control segmented-control--slim" id="my-segmented-slim"
  data-segmented-control-default="list">
  <div class="segmented-control-list" role="radiogroup" aria-label="View mode">
    <button type="button" class="segmented-control-item" role="radio" aria-checked="true"
      data-segmented-control-value="list">List</button>
    <button type="button" class="segmented-control-item" role="radio" aria-checked="false"
      data-segmented-control-value="grid">Grid</button>
  </div>
  <input type="hidden" class="segmented-control-value" name="view" value="list" />
</div>
```

With panels:

```html
<div class="segmented-control" id="my-segmented-panels" data-segmented-control-default="week">
  <div class="segmented-control-list" role="radiogroup" aria-label="Time range">
    <button type="button" class="segmented-control-item" role="radio" id="seg-day" aria-checked="false"
      aria-controls="seg-panel-day" data-segmented-control-value="day">Day</button>
    <button type="button" class="segmented-control-item" role="radio" id="seg-week" aria-checked="true"
      aria-controls="seg-panel-week" data-segmented-control-value="week">Week</button>
  </div>
  <input type="hidden" class="segmented-control-value" value="week" />
  <div class="segmented-control-panels">
    <div class="segmented-control-panel hidden" id="seg-panel-day" role="region" aria-labelledby="seg-day" hidden>
      Day view.
    </div>
    <div class="segmented-control-panel" id="seg-panel-week" role="region" aria-labelledby="seg-week">
      Week view.
    </div>
  </div>
</div>
```

```javascript
import { initSegmentedControl, initSegmentedControls } from "./components/segmented-control.js";

const segmented = initSegmentedControl(document.getElementById("my-segmented"), {
  defaultValue: "list",
  disabled: false,
  onChange: ({ value, index, item, panel, source }) => console.log(value, source),
});

segmented?.getValue();
segmented?.selectValue("grid");
segmented?.selectIndex(1);
segmented?.getActiveIndex();
segmented?.setDisabled(true);

initSegmentedControls(document); // all `.segmented-control` blocks
```

`data-segmented-control-default` and `data-segmented-control-disabled` mirror the JS options. Individual items can be disabled with the `disabled` attribute. Arrow keys move selection when the radiogroup is focused; Home and End jump to the first and last enabled item.

### Progress indicator

Multi-step wizard with a step list, one visible panel at a time, and back/next actions. In linear mode (default), users can only jump to steps they have already visited; set `data-progress-indicator-linear="false"` to allow jumping to any step from the header.

**Horizontal** (default) — step list across the top. **Vertical** — add `data-progress-indicator-vertical` (or `vertical: true`) for a left-hand step column with panels and actions on the right. Markup is the same; `initProgressIndicator()` adds `.progress-indicator--vertical` when enabled.

```html
<div class="progress-indicator" id="my-progress-indicator" data-progress-indicator-linear
  data-progress-indicator-default="0">
  <ol class="progress-indicator-list">
    <li class="progress-indicator-item">
      <button type="button" class="progress-indicator-step" id="my-step-1" aria-current="step">
        <span class="progress-indicator-marker" aria-hidden="true">1</span>
        <span class="progress-indicator-label">Account</span>
      </button>
    </li>
    <li class="progress-indicator-item">
      <button type="button" class="progress-indicator-step" id="my-step-2" disabled>
        <span class="progress-indicator-marker" aria-hidden="true">2</span>
        <span class="progress-indicator-label">Review</span>
      </button>
    </li>
  </ol>
  <div class="progress-indicator-panels">
    <div class="progress-indicator-panel" id="my-panel-1" role="region" aria-labelledby="my-step-1">
      <div class="progress-indicator-body">Step one content.</div>
    </div>
    <div class="progress-indicator-panel hidden" id="my-panel-2" role="region" aria-labelledby="my-step-2" hidden>
      <div class="progress-indicator-body">Step two content.</div>
    </div>
  </div>
  <div class="progress-indicator-actions">
    <button type="button" class="btn" data-progress-indicator-back hidden>Back</button>
    <button type="button" class="btn btn-primary" data-progress-indicator-next>Next</button>
  </div>
</div>
```

Vertical layout — same structure, add `data-progress-indicator-vertical`:

```html
<div class="progress-indicator" data-progress-indicator-vertical data-progress-indicator-linear
  data-progress-indicator-default="0">
  <!-- same .progress-indicator-list, .progress-indicator-panels, .progress-indicator-actions -->
</div>
```

```javascript
import { initProgressIndicator, initProgressIndicators } from "./components/progress-indicator.js";

const progressIndicator = initProgressIndicator(document.getElementById("my-progress-indicator"), {
  defaultStep: 0,
  linear: true,
  vertical: false,
  finishLabel: "Finish",
  onChange: ({ index, step, panel, isLastStep }) => {},
  onFinish: ({ index, panel }) => {},
});

progressIndicator?.goToStep(1);
progressIndicator?.nextStep();
progressIndicator?.prevStep();
progressIndicator?.getActiveIndex();
progressIndicator?.getMaxVisitedIndex();
progressIndicator?.isVertical();

initProgressIndicators(document); // all `.progress-indicator` blocks
```

`data-progress-indicator-default` sets the initial step index. `data-progress-indicator-finish-label` overrides the next-button label on the last step (default `Finish`). `data-progress-indicator-vertical` enables the vertical layout. Step and panel counts must match; they are paired by order.

### Dropdown

```javascript
import { initDropdown } from "./components/dropdown.js";

const dropdown = initDropdown(document.getElementById("my-dropdown"), {
  onSelect: ({ value, label }) => { /* item chosen */ },
  gridMin: 8, // switch to grid when item count exceeds 8
  gridCols: 2, // optional; default 2
});

dropdown?.setGridMin(10); // change threshold later
dropdown?.setGridMin(false); // force single-column list
dropdown?.syncMenuGrid(); // after adding/removing items in script
```

Markup: `.dropdown` > `.dropdown-trigger` + `ul.dropdown-menu` with `.dropdown-menu-item` buttons.

Optional **group headers** — non-interactive labels between items. Insert a `<li role="presentation">` with a `.dropdown-menu-group` div before each group’s items. Headers are skipped by keyboard navigation (`itemSelector` is `.dropdown-menu-item` only). Later groups get a top border automatically.

Optional **subtitles** — secondary muted text under the primary label. Wrap label + subtitle in `.dropdown-menu-item-text`:

```html
<button type="button" class="dropdown-menu-item" role="menuitem" data-value="argb32">
  <span class="dropdown-menu-item-text">
    <span class="dropdown-menu-item-label">ARGB32</span>
    <span class="dropdown-menu-item-subtitle">Full colour with alpha</span>
  </span>
</button>
```

Optional **icons** — leading light/dark image pair via `.dropdown-menu-item-icon-wrap` (see Menus & pickers → Dropdown with icons on `demo.html`):

```html
<button type="button" class="dropdown-menu-item" role="menuitem" data-value="app-a">
  <span class="dropdown-menu-item-icon-wrap" aria-hidden="true">
    <img class="dropdown-menu-item-icon brand-icon--light" src="app/res/app-light.svg" alt="" width="20" height="20" />
    <img class="dropdown-menu-item-icon brand-icon--dark" src="app/res/app-dark.svg" alt="" width="20" height="20" />
  </span>
  <span class="dropdown-menu-item-text">
    <span class="dropdown-menu-item-label">Example App A</span>
    <span class="dropdown-menu-item-subtitle">Sample related microapp</span>
  </span>
</button>
```

`onSelect` / toggle APIs use `.dropdown-menu-item-label` when present (subtitle is not included in `label`).

Optional **auto grid** — when a dropdown has more than a threshold of selectable items, the menu can switch to a multi-column grid (see Menus & pickers → Multi-select combobox on `demo.html`).

**Markup** — set on the `.dropdown` host:

| Attribute | Meaning |
| --- | --- |
| `data-dropdown-grid="8"` | Enable auto grid; switch when item count **exceeds** `8` |
| `data-dropdown-grid` | Enable with default threshold (`6`) |
| `data-dropdown-grid="false"` | Force a single-column list |
| `data-dropdown-grid-min="8"` | Same as numeric `data-dropdown-grid` (explicit name) |
| `data-dropdown-grid-cols="2"` | Column count in grid mode (default `2`) |

**JavaScript** — `gridMin` / `gridCols` on `initDropdown()` / `initToggleDropdown()` override markup. Pass `gridMin: false` to disable. The returned object also exposes `setGridMin()`, `setGridCols()`, `getGridConfig()`, and `syncMenuGrid()` (call after changing menu items). Default threshold constant: `DROPDOWN_GRID_DEFAULT_MIN` from [`app/utils/menu.js`](app/utils/menu.js).

Layout is rechecked on init and each time the menu opens. In grid mode, arrow keys move within the column layout (left/right as well as up/down). Adjacent selected cells share one rounded outline, including inner corners.

```html
<div class="dropdown" id="my-dropdown" data-dropdown-grid="8">
  <!-- trigger + menu -->
</div>
```

```html
<ul class="dropdown-menu hidden" role="menu">
  <li role="presentation">
    <div class="dropdown-menu-group">True colour</div>
  </li>
  <li role="none">
    <button type="button" class="dropdown-menu-item" role="menuitem" data-value="argb32">ARGB32</button>
  </li>
  <li role="presentation">
    <div class="dropdown-menu-group">16-bit colour</div>
  </li>
  <li role="none">
    <button type="button" class="dropdown-menu-item" role="menuitem" data-value="rgb565">RGB565</button>
  </li>
</ul>
```

### Toggle dropdown

Multi-select variant: clicking an item toggles it; the menu stays open until you click away or press Escape. Selection count is shown with a [Badge](#badge) on the trigger (hidden when none are selected). Wrap the trigger in `.badge-host` with a `.badge`, or omit that markup and let `initToggleDropdown` create it.

```javascript
import { initToggleDropdown } from "./components/dropdown-toggle.js";

const toggleDropdown = initToggleDropdown(document.getElementById("my-toggle-dropdown"), {
  onToggle: ({ value, label, selected, values, labels }) => {
    console.log(label, selected, values);
  },
});

toggleDropdown?.getSelected(); // [{ value, label, item }, …]
toggleDropdown?.setSelected(["alpha", "gamma"]);
```

```html
<div class="dropdown" id="my-toggle-dropdown">
  <span class="badge-host" data-badge-label="Toggle items">
    <button type="button" class="btn dropdown-trigger" aria-haspopup="menu" aria-expanded="false"
      aria-controls="my-toggle-dropdown-menu" aria-label="Toggle items">
      <span class="dropdown-trigger-label">Toggle items</span>
      <span class="combo-btn-chevron" aria-hidden="true"></span>
    </button>
    <span class="badge hidden" aria-hidden="true" hidden></span>
  </span>
  <ul id="my-toggle-dropdown-menu" class="dropdown-menu hidden" role="menu">
    <li role="none">
      <button type="button" class="dropdown-menu-item" role="menuitemcheckbox" aria-checked="false"
        data-value="alpha">Alpha</button>
    </li>
  </ul>
</div>
```

Start the badge as `hidden` when the initial selection count is zero so it does not flash before `initToggleDropdown` runs.

### Expand

```html
<div class="expand">
  <button type="button" class="expand-trigger" aria-expanded="false" aria-controls="my-expand-panel">
    <span class="expand-icon" data-icon="chevron-right" data-icon-class="expand-icon-svg" aria-hidden="true"></span>
    <span class="expand-label">Advanced options</span>
  </button>
  <div id="my-expand-panel" class="expand-panel hidden" hidden>
    <div class="expand-body">More content here.</div>
  </div>
</div>
```

```javascript
import { initExpand, initExpands } from "./components/expand.js";

initExpands(document); // all .expand blocks

// or one instance:
const expand = initExpand(document.getElementById("my-expand"));
// expand.open(), expand.close(), expand.toggle(), expand.isOpen()
```

### Accordion

Vertical stack of sections. Each `.accordion-item` has a heading button and a collapsible panel. By default only one panel is open at a time; add `data-accordion-multiple` to allow several.

```html
<div class="accordion" data-accordion-default-open="0">
  <div class="accordion-item">
    <h3 class="accordion-heading">
      <button type="button" class="accordion-trigger" id="acc-trigger-1" aria-expanded="false"
        aria-controls="acc-panel-1">
        <span class="accordion-icon" data-icon="chevron-right" data-icon-class="accordion-icon-svg"
          aria-hidden="true"></span>
        <span class="accordion-label">Section one</span>
      </button>
    </h3>
    <div id="acc-panel-1" class="accordion-panel hidden" role="region" aria-labelledby="acc-trigger-1" hidden>
      <div class="accordion-body">Content for section one.</div>
    </div>
  </div>
</div>
```

```javascript
import { initAccordion, initAccordions } from "./components/accordion.js";

initAccordions(document); // all .accordion blocks

const accordion = initAccordion(document.getElementById("my-accordion"), {
  allowMultiple: false,
  defaultOpen: 0,
  onToggle: ({ index, isOpen, trigger }) => {},
});
// accordion.open(0), accordion.close(0), accordion.toggle(0), accordion.closeAll(), accordion.getOpenIndices()
```

`data-accordion-default-open` sets the initially open panel index. `data-accordion-open` on an item opens it on load (use with `data-accordion-multiple` for several). Arrow Up/Down, Home, and End move focus between headers.

### Tabs

```html
<div class="tabs">
  <div class="tabs-list" role="tablist" aria-label="Sections">
    <button type="button" class="tabs-tab" role="tab" id="tab-a" aria-selected="true" aria-controls="panel-a">Overview</button>
    <button type="button" class="tabs-tab" role="tab" id="tab-b" aria-selected="false" aria-controls="panel-b" tabindex="-1">Details</button>
  </div>
  <div id="panel-a" class="tabs-panel" role="tabpanel" aria-labelledby="tab-a">
    <div class="tabs-body">Overview content</div>
  </div>
  <div id="panel-b" class="tabs-panel hidden" role="tabpanel" aria-labelledby="tab-b" hidden>
    <div class="tabs-body">Details content</div>
  </div>
</div>
```

```javascript
import { initTab, initTabs } from "./components/tabs.js";

initTabs(document); // all .tabs blocks

// or one instance:
const tabs = initTab(document.getElementById("my-tabs"));
// tabs.selectTab(1), tabs.getActiveIndex()
```

Arrow keys move between tabs when the tab list is focused.

### Pagination

Split content across numbered pages and navigate in place — no full reload and no URL change. Pair `.pagination-panel` blocks with `.pagination-page` buttons via matching `data-pagination-panel` / `data-pagination-page` (1-based). Use `onChange` when you render content yourself instead of static panels.

```html
<div class="pagination" id="my-pagination" data-pagination-default="1">
  <div class="pagination-panels">
    <div class="pagination-panel" data-pagination-panel="1" role="region" aria-label="Page 1">
      Page one content.
    </div>
    <div class="pagination-panel hidden" data-pagination-panel="2" role="region" aria-label="Page 2" hidden>
      Page two content.
    </div>
  </div>
  <nav class="pagination-nav" aria-label="Results pages">
    <button type="button" class="btn btn-icon pagination-prev" data-pagination-prev
      aria-label="Previous page" disabled
      data-icon="chevron-left" data-icon-class="btn-icon-svg"></button>
    <ul class="pagination-list">
      <li class="pagination-item">
        <button type="button" class="pagination-page is-active" data-pagination-page="1"
          aria-current="page">1</button>
      </li>
      <li class="pagination-item">
        <button type="button" class="pagination-page" data-pagination-page="2" tabindex="-1">2</button>
      </li>
    </ul>
    <button type="button" class="btn btn-icon pagination-next" data-pagination-next
      aria-label="Next page"
      data-icon="chevron-right" data-icon-class="btn-icon-svg"></button>
  </nav>
  <input type="hidden" class="pagination-value" name="page" value="1" />
</div>
```

```javascript
import { initPagination, initPaginations } from "./components/pagination.js";

const pagination = initPagination(document.getElementById("my-pagination"), {
  defaultPage: 1,
  disabled: false,
  onChange: ({ page, pageCount, panel, source }) => console.log(page, source),
});

pagination?.getPage();
pagination?.goToPage(2);
pagination?.nextPage();
pagination?.prevPage();
pagination?.getPageCount();
pagination?.setDisabled(true);

initPaginations(document); // all `.pagination` blocks
```

`data-pagination-default` and `data-pagination-disabled` mirror the JS options. Previous and next disable on the first and last page. Arrow keys move between pages when the nav is focused.

### Table

Styled data tables for lists of records. Wrap a semantic `<table>` in `.table-block` and `.table-wrap`. Use `.table--striped` for alternating rows, `.table--compact` for tighter padding, and `.table-num` to right-align numeric columns.

Optional **sortable** columns: set `data-table-sortable` on `.table-block` and `data-table-sort` on `<th>` cells. Add `data-sort-type="text"`, `"number"`, or `"date"` (default `text`). Put a `.table-sort-button` inside the header or let `initTable()` create one from the header text. Set `data-table-sort-default="ascending"` or `"descending"` on one or more sortable `<th>` cells to sort on load (document order = primary, then secondary, …), or pass `defaultSort: { columnIndex, direction }` / `defaultSort: [{ columnIndex, direction }, …]` to `initTable()`. Header clicks cycle **ascending → descending → unsorted** (restores the row order from init). Hold **Shift** while clicking another header to add or cycle a secondary sort column without clearing the primary; Shift-click through descending removes that column from the sort stack. `onSort` receives the clicked column plus `columns` (ordered active sorts); `getSortColumns()` returns the same list.

Optional **row selection**: set `data-table-selectable` on `.table-block`, a `data-table-select-all` checkbox in the header row, and `data-table-row-select` on each row. Pair rows with `data-table-row-id` for stable ids in callbacks. Body rows show accent-tinted hover feedback with one outer accent border per row (pointer feedback — not the same as checkbox selection). When selectable, clicking anywhere on a row toggles that row (interactive controls inside the row are left alone).

```html
<div class="table-block" id="issues-table" data-table-sortable data-table-selectable>
  <div class="table-wrap">
    <table class="table table--striped">
      <caption class="table-caption">Open issues</caption>
      <thead>
        <tr>
          <th class="table-select-col" scope="col">
            <label class="checkbox">
              <input type="checkbox" class="checkbox-input" data-table-select-all
                aria-label="Select all rows" />
            </label>
          </th>
          <th scope="col" data-table-sort data-sort-type="text">
            <button type="button" class="table-sort-button">Title</button>
          </th>
          <th scope="col" data-table-sort data-sort-type="date"
            data-table-sort-default="descending" class="table-num">
            <button type="button" class="table-sort-button">Created</button>
          </th>
          <th scope="col" data-table-sort data-sort-type="number"
            data-table-sort-default="ascending" class="table-num">
            <button type="button" class="table-sort-button">Comments</button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr data-table-row-id="42">
          <td class="table-select-col">
            <label class="checkbox">
              <input type="checkbox" class="checkbox-input" data-table-row-select
                aria-label="Select row" />
            </label>
          </td>
          <td>Fix nav overlap on mobile</td>
          <td class="table-num">2026-03-01</td>
          <td class="table-num">3</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

```javascript
import { initTable, initTables } from "./components/table.js";

const table = initTable(document.getElementById("issues-table"), {
  sortable: true,
  selectable: true,
  onSort: ({ columnIndex, direction, sortType, columns }) =>
    console.log(columnIndex, direction, sortType, columns),
  onSelectionChange: ({ selectedIds, selectedRows }) => console.log(selectedIds),
});

table?.getSelectedIds();
table?.getSortColumns();
table?.clearSelection();
table?.setDisabled(true);
table?.destroy();

initTables(document);
```

`data-table-sortable`, `data-table-selectable`, and `data-table-disabled` mirror the JS options. `data-table-sort-default` on a sortable `<th>` (or `defaultSort: { columnIndex, direction }`) sets the initial sort. Add `.table-block--wide` to remove the default `40rem` max width.

### Tabular input

Editable data grid for collecting rows of typed values. Mount an empty `.tabular-input` root; `initTabularInput()` renders the table and controls. Column types are **`text`**, **`number`**, and **`logical`** (slim toggle). Other kinds of values (dates, enums, etc.) use **text**.

**Chrome**

- Rename columns by clicking the header label (pointer cursor + “Click to edit” tooltip; Enter to commit, Escape to cancel); resting headers look like normal table headers until edited.
- Column menu (chevron on the right of the name): **Type** group (text / number / logical; values are coerced) and **Column** group with **Remove**, **Add before**, and **Add after**. Only one column menu open at a time. Menus use fixed positioning so they are not clipped by the table scroll container.
- Icon-only **add row** / **add column** (`plus`); **add row** sits in the leading chrome column under reset / move-row; **row remove** shares the trailing column with **add column** (header = add column, body = remove row). Adding a column focuses its header name (text selected, ready to rename); adding a row focuses the new row's first cell.
- **Copy** (beside Fit/Overflow) copies the grid as Excel-friendly TSV (header + rows) for paste into spreadsheets.
- **Paste** replaces the whole grid from the clipboard, sized exactly to the clipboard (columns labeled `Column 1`…`N`; types auto-detected).
- **Paste with Headers** same as Paste, but the first clipboard row becomes column labels and the remaining rows are data.
- Leading column: header **reset** (`delete`); body rows get a square **up/down split** control to shift the row (`chevron-up` / `chevron-down`). First/last row disables the blocked direction.
- Header **reset** opens a size-picker popover next to the button (up to **8×8**); choosing a size replaces the table with a blank text-column grid. Programmatic `reset({ columnCount, rowCount })` skips the picker (defaults to **3×2**).
- Icon chrome uses `data-tooltip` (add/remove row, add column, reset, column menu trigger). Requires `initTooltips()` via `initShell()`.

**Width / canvas breakout**

- When the grid is wider than the page body, it **breaks out centered** up to the canvas (`100vw` minus page padding) instead of scrolling inside the body.
- A **Fit** / **Overflow** toggle (`fullscreen` / `fullscreen-exit`) sits in the footer beside **Copy** (after **add row** in the leading chrome column) and appears **only while overflowing**; use it to constrain back to the body (horizontal scroll) or expand again. Tooltips stay “Fit to page width” / “Expand to canvas width”. Default is breakout on.
- Opt out via `breakout: false` or `data-tabular-input-breakout="false"` (initial preference). `setBreakoutEnabled(boolean)` / `getBreakoutEnabled()` are also available.

**Paste**

- Paste Excel/TSV (`text/plain` with tabs or multiple lines) while focus is in the grid.
- Starts at the focused body cell (else top-left); expands rows/columns as needed; overwrites that rectangle; keeps surplus cells outside it.
- Re-detects each column’s type from its full values (number → logical → text), then coerces cells.
- Plain single-cell paste without tabs/newlines still goes into the focused field as usual.
- Footer **Paste** / **Paste with Headers** read the clipboard (secure context) and replace the entire grid; empty header cells fall back to `Column N`; a headers-only clipboard yields one blank data row. If clipboard read is blocked, the button prompts for **Ctrl+V** and captures the next paste.

**Keyboard**

- **Tab / Shift+Tab** move through header controls and each row's cells, then that row's **delete** button, then the next row; **move row** (up/down) controls come after the data.
- **Arrow keys** move between body cells (left/right are caret-edge-aware in text and number fields; up/down always change row).
- Number cells are text inputs with `inputmode="decimal"` so the caret can walk digits; non-numeric keystrokes are rejected, in-progress drafts (`-`, `1,`, `1.`, `1e-`) are allowed, and the value is normalized on blur. Arrow up/down never steps the value.

```html
<div class="tabular-input" id="inventory-grid" aria-label="Inventory"></div>
```

```javascript
import { initTabularInput, initTabularInputs } from "./components/tabular-input.js";

const grid = initTabularInput(document.getElementById("inventory-grid"), {
  columns: [
    { id: "name", label: "Name", type: "text" },
    { id: "qty", label: "Qty", type: "number" },
    { id: "active", label: "Active", type: "logical" },
  ],
  rows: [
    { id: "r1", cells: { name: "Widget", qty: 12, active: true } },
  ],
  onChange: ({ columns, rows, source }) => console.log(source, columns, rows),
});

grid?.getData();
grid?.addRow();
grid?.addColumn({ label: "Notes", type: "text" });
grid?.addColumn({ label: "Before qty" }, { index: 1 }); // insert at index
grid?.removeRow("r1");
grid?.moveRow("r1", { delta: -1 });
grid?.removeColumn("qty");
grid?.renameColumn("name", "Item");
grid?.setColumnType("active", "text");
grid?.reset(); // blank 3×2; no size picker
grid?.reset({ columnCount: 4, rowCount: 5 });
grid?.setData({ columns: [...], rows: [...] });
grid?.setDisabled(true);
grid?.setBreakoutEnabled(false);
grid?.getBreakoutEnabled();
grid?.destroy();

initTabularInputs(document); // all `.tabular-input` roots
```

`data-tabular-input-disabled` mirrors the `disabled` option. `data-tabular-input-breakout` mirrors the `breakout` option (default on). `onChange` `source` values include `"input"`, `"add-row"`, `"remove-row"`, `"move-row"`, `"add-column"`, `"remove-column"`, `"rename"`, `"type-change"`, `"paste"`, `"reset"`, and `"api"`.

Icons used: `plus`, `delete` (reset), `remove` (row/column), `type-text`, `type-number`, `type-logical`, `chevron-down`, `fullscreen`, `fullscreen-exit`, `copy`, `paste`, `paste-special` — defined in [`app/utils/icons.js`](app/utils/icons.js).

### Page navigation

Injected by `initShell()` via [`app/shell/render-shell.js`](app/shell/render-shell.js). Collects `main :is(h2, h3)[id]` headings automatically and shows plain title links (tier links match `.segment-title` weight; nested section links match `.section-title`). Give each heading a unique `id` and use `h2.segment-title` / `h3.section-title` (`scroll-margin-top` is included). Pass `pageNav: false` to `initShell()` to disable page navigation, including its injected markup.

```javascript
import { initShell } from "./shell/shell.js";

initShell(); // default: main :is(h2, h3)[id]

// Custom heading scan (e.g. h3 under a docs root):
initShell({
  pageNav: {
    headingSelector: "main h3[id]",
    headingRoot: document.getElementById("docs"),
  },
});
```

Standalone use without the full shell — insert markup from `PAGE_NAV_MARKUP` in `render-shell.js`, then:

```javascript
import { initPageNavPanel } from "./shell/page-nav.js";

const nav = initPageNavPanel(); // defaults to #page-nav
nav?.rebuild(); // call after adding/removing headings dynamically
nav?.destroy(); // remove listeners when tearing down
```

Jump up scrolls to the top; jump down scrolls to the bottom. Jump buttons are always visible at the bottom-right. The section list opens on hover: when the right-edge strip sits in the gutter (clear of `main`), the full strip activates it; when the strip overlaps `main`, only hovering the jump buttons opens it (so page controls stay clickable). Focus inside the panel also keeps it open. The blue ring shows scroll progress. If no matching headings exist, the section list is hidden and only the jump buttons remain.

Mark a top-level nav group by adding `data-page-nav-tier` to its `h2.segment-title`. The next headings in document order nest under it until another tier heading appears. Tier links use full weight; nested section links are slightly smaller and muted.

### Rich text editor (Toast UI)

Markdown and WYSIWYG editing with live preview. Includes the [table merged-cell](https://github.com/nhn/tui.editor/tree/master/plugins/table-merged-cell) plugin. Pasted or dropped images are inlined as base64 data URLs (no upload server).

The vendor bundle is large (~500KB+ minified). Omit `app/vendor/toastui-editor*` and related modules if you do not need rich text.

**Page setup** — link Toast UI CSS in `<head>` and load vendor scripts before your ES module entry (see [`demo.html`](demo.html)):

```html
<link rel="stylesheet" href="app/toastui-editor.css" />
```

`app/toastui-editor.css` imports the base editor CSS, dark theme (`app/vendor/toastui-editor/theme/toastui-editor-dark.min.css`), and the table merged-cell plugin styles.

```html
<script defer src="app/vendor/toastui-editor/toastui-editor-all.min.js"></script>
<script defer src="app/vendor/toastui-editor-plugin-table-merged-cell/toastui-editor-plugin-table-merged-cell.min.js"></script>
```

**Markup:**

```html
<div class="field rich-text-editor" id="my-editor"
  data-rich-text-editor-height="320px"
  data-rich-text-editor-edit-type="wysiwyg"
  data-rich-text-editor-preview="vertical"
  data-rich-text-editor-placeholder="Write something…">
  <span class="field-label">Body</span>
  <div class="rich-text-editor-mount" aria-label="Rich text editor"></div>
</div>
```

| `data-*` attribute | Option | Default |
| ---------------- | ------ | ------- |
| `data-rich-text-editor-height` | `height` | `300px` |
| `data-rich-text-editor-edit-type` | `initialEditType` (`markdown` \| `wysiwyg`) | `wysiwyg` |
| `data-rich-text-editor-preview` | `previewStyle` (`vertical` \| `tab`) | `vertical` |
| `data-rich-text-editor-placeholder` | `placeholder` | — |
| `data-rich-text-editor-value` | `initialValue` | `""` |
| `data-rich-text-editor-autofocus` | `autofocus` | `false` |

```javascript
import { initRichTextEditor, initRichTextEditors } from "./components/rich-text-editor.js";

const editor = initRichTextEditor(document.getElementById("my-editor"), {
  height: "320px",
  initialEditType: "wysiwyg",
  previewStyle: "vertical",
  initialValue: "## Hello\n\nStart writing…",
  placeholder: "Write something…",
  plugins: ["tableMergedCell"], // default; pass [] or plugins: false to disable
  onChange: ({ markdown, html, source }) => console.log(source, markdown.length),
});

editor?.getMarkdown();
editor?.getHTML();
editor?.getEditType(); // `markdown` | `wysiwyg`
editor?.setEditType("markdown");
editor?.setMarkdown("…");
editor?.setHTML("…"); // may not round-trip cleanly to Markdown
editor?.destroy();

initRichTextEditors(document); // every `.rich-text-editor` with a mount node
```

Theme (light/dark) follows the page `data-theme` attribute and updates on `microapp-theme-change` from [`app/shell/theme.js`](app/shell/theme.js).

Markdown ↔ WYSIWYG uses the framework [segmented control](#segmented-control) (`.segmented-control--slim`) in the editor footer (Toast UI’s native mode switch is hidden). Toolbar icon tips use framework [tooltips](#tooltips) (`data-tooltip`); Toast UI’s native tooltip is hidden. Converting between Markdown and HTML is lossy for complex formatting (tables, nested lists, etc.) — treat one format as canonical when persisting content.

### Charts (TanStack Charts)

Thin host around vendored [TanStack Charts](https://tanstack.com/charts/latest) (`mountChart`). You author the chart definition (`defineChart`, marks, scales); this framework only mounts it into a `.charts` host and refreshes on theme change. Upstream is **pre-alpha** — expect API churn.

The host inherits `--font` / `--text`. Axis titles and tick labels are restyled in [`controls-charts.css`](app/css/controls-charts.css) to `--muted` at theme secondary sizes (`--charts-axis-title-size` / `--charts-tick-size`). Set `axis.tickLabels.fontSize` (CSS pixels) to match `--charts-tick-size` so guide layout matches the painted size — axis title size is CSS-only (upstream has no title `fontSize` option yet).

Prefer **narrow** vendor entry files (e.g. `bar.js`, `scene.js`) over the root barrel so unused marks stay out of the module graph.

**Page setup** — add an import map **before** any `type="module"` script when using marks that bare-import D3 (including `barY` / `barX`, which pull `stack-internal` → `d3-shape`):

```html
<script type="importmap">
{
  "imports": {
    "d3-scale": "./app/vendor/d3-scale/d3-scale.esm.js",
    "d3-shape": "./app/vendor/d3-shape/d3-shape.esm.js"
  }
}
</script>
```

**Markup:**

```html
<div class="charts" id="my-chart" data-charts-height="320"
  aria-label="Example fruit sales"></div>
```

| `data-*` attribute | Option | Default |
| ---------------- | ------ | ------- |
| `data-charts-height` | `height` (CSS pixels) | `320` |
| `aria-label` | `ariaLabel` | `"Chart"` |

```javascript
import { initChart, initCharts } from "./components/charts.js";
import { defineChart } from "./vendor/tanstack-charts/scene.js";
import { barY } from "./vendor/tanstack-charts/bar.js";
import { tooltip } from "./vendor/tanstack-charts/tooltip.js";
import { scaleBand } from "./vendor/tanstack-charts/scales/band.js";
import { scaleLinear } from "./vendor/tanstack-charts/scales/linear.js";

const rows = [
  { fruit: "Apples", sold: 42 },
  { fruit: "Bananas", sold: 28 },
];

const definition = defineChart({
  marks: [
    barY(rows, {
      id: "fruit-sales",
      x: "fruit",
      y: "sold",
      fill: "var(--accent)",
    }),
  ],
  x: {
    scale: () => scaleBand().padding(0.18),
    axis: {
      label: "Fruit",
      tickLabels: { fontSize: 13 }, // match --charts-tick-size
    },
  },
  y: {
    scale: scaleLinear,
    nice: true,
    grid: true,
    axis: {
      label: "Sold",
      tickLabels: { fontSize: 13 },
    },
  },
  tooltip,
});

const chart = initChart(document.getElementById("my-chart"), {
  definition,
  ariaLabel: "Example fruit sales",
});

chart?.update({ definition }); // replace definition / height / ariaLabel
chart?.getHost(); // underlying TanStack host
chart?.destroy();

// Or scan by id → options (each entry needs a definition):
initCharts(document, { "my-chart": { definition } });
```

Pinned versions live as `TANSTACK_CHARTS_VERSION`, `D3_SCALE_VERSION`, and `D3_SHAPE_VERSION` in [`app/components/charts.js`](app/components/charts.js). See vendor READMEs under `app/vendor/tanstack-charts/`, `d3-scale/`, and `d3-shape/` for refresh steps.

### Diagrams (Mermaid)

Thin host around vendored [Mermaid](https://mermaid.js.org/) (text → SVG). Put diagram source in a child `.diagram-source`, or pass `source` to `initDiagram` / `update`. The host re-renders on theme change (`default` / `dark`). Diagram-type chunks **lazy-load at runtime** from `app/vendor/mermaid/chunks/` (needs a local server or GitHub Pages) — unused diagram types are not fetched until referenced.

**Markup:**

```html
<div class="diagram" id="my-diagram" aria-label="Example sequence">
  <pre class="diagram-source">sequenceDiagram
  participant User
  participant App
  User->>App: Open
  App-->>User: Done</pre>
</div>
```

| Attribute / option | Meaning | Default |
| ------------------ | ------- | ------- |
| `.diagram-source` text or `source` | Mermaid definition | required on init |
| `aria-label` / `ariaLabel` | Accessible name | `"Diagram"` |

```javascript
import { initDiagram, initDiagrams } from "./components/diagram.js";

const diagram = initDiagram(document.getElementById("my-diagram"));
// or:
initDiagrams(document);
// or with JS source / overrides by id:
initDiagrams(document, {
  "my-diagram": { source: "flowchart TD\n  A-->B", ariaLabel: "Flow" },
});

diagram?.update({ source: "sequenceDiagram\n  A->>B: Hi" });
diagram?.update({ source: "" }); // clears canvas; shows “Diagram source is empty”
diagram?.destroy();
```

Pinned version: `MERMAID_VERSION` in [`app/components/diagram.js`](app/components/diagram.js). See [`app/vendor/mermaid/README.md`](app/vendor/mermaid/README.md) for refresh steps and how to shrink the vendor tree. Math in labels uses Mermaid’s built-in KaTeX (`$$…$$`); there is no separate page KaTeX component.

**Trimming:** Prefer removing the whole component + `app/vendor/mermaid/` via **finalize-app** when the fork does not use diagrams. Mermaid already lazy-loads diagram-type chunks, so unused types do not download at runtime. To shrink the **repo** further you may delete unused `*Diagram*.mjs` / `*-definition-*.mjs` chunks under `chunks/mermaid.esm.min/` — those diagram types will then fail to load. Do **not** prune shared `chunk-*.mjs` files.

### Code highlighting (Prism)

Optional syntax highlighting for docs or demos. See [`demo.html`](demo.html) for a full-width example with toolbar actions, hover copy/maximise, and mode controls.

```html
<link rel="stylesheet" href="app/prism.css" />
<script defer src="app/vendor/prism/prism.min.js"></script>
<script defer src="app/vendor/prism/prism-python.min.js"></script>
<script defer src="app/vendor/prism/prism-line-numbers.min.js"></script>
```

```html
<div class="code-block"
  data-code-mode="edit"
  data-code-toolbar="top"
  data-code-toolbar-actions="clear,copy,paste,maximize,highlight,line-numbers"
  data-code-surface-actions="copy,maximize"
  data-expandable-surface
  data-expandable-surface-label="Code sample">
  <div class="code-block-body" data-expandable-surface-trigger>
    <pre class="line-numbers language-python"><code class="language-python">def greet(name: str) -> str:
    return f"Hello, {name}!"
</code></pre>
  </div>
</div>
```

```javascript
import { initCodeBlocks } from "./components/code-block.js";
import { initExpandableSurfaces } from "./components/expandable-surface.js";

initCodeBlocks(document);
initExpandableSurfaces(document);
```

**Toolbar** — set `data-code-toolbar` to `top`, `bottom`, or `none`. List controls in `data-code-toolbar-actions` (comma-separated): `clear`, `copy`, `paste`, `maximize`, `highlight`, `line-numbers`. Defaults to `highlight,line-numbers` when omitted. Align any control with `data-code-toolbar-align` as `action:left|right` (comma-separated); **highlight, line-numbers, and maximize default to `right`**, everything else to `left`. Clear / Copy / Paste show icon + label; highlight, line-numbers, and maximize are icon-only with tooltips. Clear and Paste are disabled in `view` mode; Clear and Copy (toolbar and hover) are disabled when the block is empty. Maximize requires `data-expandable-surface` (uses `data-expandable-surface-open`).

**Hover surface actions** — set `data-code-surface-actions` to `copy`, `maximize`, or both (`none` / empty / `false` hides the strip). Legacy `data-code-copy="false"` omits surface copy. When `data-expandable-surface` is present and surface actions are omitted, defaults include `copy,maximize`.

Line numbers require highlighting to be on. In `select` and `edit` modes, hovering a code line or its gutter number applies the standard accent-tinted hover background; clicking a gutter number selects that line's text. Triple-clicking code text selects the whole block. Copy/paste use [`app/utils/clipboard.js`](app/utils/clipboard.js) (Clipboard API with insecure-context fallbacks).

**Interaction modes** — set `data-code-mode` on `.code-block`:

| Mode | Behaviour |
| ---- | --------- |
| `view` | Read-only display; text cannot be selected; Clear/Paste disabled |
| `select` | Read-only; text selectable (default) |
| `edit` | Transparent textarea over highlighted `<pre>` (shared metrics so caret matches glyphs) |

Runtime API from `initCodeBlock()`: `setMode`, `getMode`, `getSource`, `setSource`, `setToolbarPosition`, `setToolbarActions`, `setToolbarAlign`, `setSurfaceActions`, `setLineNumbers`, `setHighlight`.

### Expandable surface

Reusable expanded overlay for code blocks, multi-line inputs, image previews, or any block marked with `data-expandable-surface`. A maximise control appears on hover when enabled (for code blocks, when `maximize` is in `data-code-surface-actions`); toolbar Maximize buttons use `data-expandable-surface-open`. Set `data-expandable-surface-control="false"` to omit the floating button. Set `data-expandable-surface-click` to toggle when clicking non-interactive areas of the surface. Expand moves the surface to the page body width (`--page-width`); Escape or backdrop click closes it.

```html
<div class="field" data-expandable-surface data-expandable-surface-label="Notes">
  <span class="field-label">Notes</span>
  <div data-expandable-surface-trigger>
    <textarea class="textarea" rows="4"></textarea>
  </div>
</div>
```

```javascript
import { initExpandableSurfaces } from "./components/expandable-surface.js";

initExpandableSurfaces(document);
```

Add other language components under `app/vendor/prism/` as needed from [Prism](https://prismjs.com/).

### Icons

All inline UI icons are defined in [`app/utils/icons-framework.js`](app/utils/icons-framework.js) (framework catalogue) and [`app/utils/icons-app.js`](app/utils/icons-app.js) (fork / app additions). [`app/utils/icons.js`](app/utils/icons.js) merges them (app wins on key clash) and mounts via `initIcons()`.

Browse and copy SVG paths from [Icônes — Google Material Icons (Round variant)](https://icones.js.org/collection/ic?s=info&variant=Round) (`ic` collection, `variant=Round`).

HTML:

```html
<button type="button" data-icon="light-mode" data-icon-class="theme-icon" aria-label="Light"></button>
```

JavaScript:

```javascript
import { createIcon, initIcons } from "./utils/icons.js";

initIcons(document); // mounts every [data-icon] in the page

const svg = createIcon("lines", { className: "btn-icon-svg" });
button.append(svg);
```

Add fork / app icons to `APP_ICONS` in [`app/utils/icons-app.js`](app/utils/icons-app.js). Framework catalogue changes go in `FRAMEWORK_ICONS` in `icons-framework.js`. App logo supports a light/dark pair (`app/res/app-light.svg`, `app/res/app-dark.svg`) or a single `app/res/app.svg` — see **Branding** and [`app/utils/brand-icon.js`](app/utils/brand-icon.js). Favicon syncs in `brand-icon.js`.

Licensed icon sets (e.g. Material Icons) can use optional metadata on each entry:

```javascript
import { ICON_ATTRIBUTIONS } from "./utils/icons.js";

// In icons-app.js:
export const APP_ICONS = {
  info: {
    viewBox: "0 0 24 24",
    markup: `<path fill="currentColor" d="…"/>`,
    attribution: ICON_ATTRIBUTIONS.materialIcons,
    name: "round-info", // source collection id (Icônes / Material Icons)
  },
};
```

- `name` — original icon name in the source collection (metadata only; not used at runtime)
- `attribution` — license notice, inserted as an HTML comment inside the SVG
- `ref` — alias to another icon key in the merged registry (e.g. `lines: { ref: "note" }`)

Pass `includeAttribution: false` to `createIcon()` if you need the SVG without the comment.
