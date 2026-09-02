---
name: manage-color
description: >-
  Set or validate a microapp fork’s primary accent colours (light and dark
  --accent), set the theme-inverse --accent-fg for WCAG AA contrast on accent
  fills, and write overrides to fork-owned app/css/app.css. Use when changing
  primary/brand/accent colour, checking accent fill contrast, or when init-app
  collects a custom primary.
---

# Manage color

Configure fork brand accents without editing synced [`app/tokens.css`](../../../app/tokens.css). Aligns with [../_shared/invariants.md](../_shared/invariants.md).

## Token contract

| Token | Role | Who sets it |
| ----- | ---- | ----------- |
| `--accent` | Primary fill / links / focus | Fork (light + dark) |
| `--accent-hover` | Hover / pressed | Derived in `tokens.css` via `color-mix` — do not write unless the user insists on a custom hover |
| `--accent-fg` | Text and icons on accent fills; always the inverse tone of the theme’s standard text | Fixed by theme, then checked for AA |

Framework defaults (GitHub blues) already pass AA. Candidates for `--accent-fg`: `#ffffff` and `#0d1117` only (match the design system).

`--accent-fg` is a polarity rule, not a literal RGB inversion of `--text`: use
the light foreground `#ffffff` in the light theme and the dark foreground
`#0d1117` in the dark theme. Therefore primary-button text is light in light
theme and dark in dark theme. Do not choose between these candidates solely by
which has the higher contrast ratio.

**Never** put brand colour overrides in `tokens.css` on a fork — sync/migrate can overwrite it. Write to [`app/css/app.css`](../../../app/css/app.css).

## Inputs

| Input | Required? |
| ----- | --------- |
| Light `--accent` hex | Yes (or “keep framework default”) |
| Dark `--accent` hex | Yes (or “keep framework default”) |
| Explicit `--accent-fg` per theme | Optional — only for a custom shade that preserves the theme’s required light/dark polarity |

If either theme keeps the framework default, skip writing that theme’s block (leave tokens as shipped).

## Workflow

```text
Manage-color progress:
- [ ] 1. Collect light + dark accent (or offer generated options)
- [ ] 2. Resolve theme-inverse --accent-fg (contrast ≥ 4.5:1)
- [ ] 3. Write app/css/app.css overrides
- [ ] 4. Report ratios (accent + mixed hover vs fg)
```

### 1. Collect

Ask for missing light/dark hex values. Accept `#rgb` / `#rrggbb` (normalise to `#rrggbb`).

### 1a. Offer generated options when needed

If an accent is missing, fails contrast, or the user asks for a new colour,
offer a small set of clearly labelled candidate options before writing any
colour. Use the user’s stated brand, hue, mood, or existing UI as constraints;
do not silently invent a shade or replace the user’s colour.

Ideally present the options on a Cursor Canvas when available. The Canvas
should use CSS swatches and example primary buttons for both light and dark
themes, and label every option with:

- Light and dark `--accent` hex values
- The required theme-inverse `--accent-fg` values
- Accent and derived-hover contrast ratios
- Any trade-off, such as a less saturated or darker shade needed for AA

If Canvas is unavailable, present the same options concisely in chat. Wait for
the user to choose an option (or provide another colour) before writing
`app/css/app.css`. Re-run the contrast checks on the selected values.

### 2. Resolve theme-inverse `--accent-fg`

For each accent that will be written, use the fixed inverse tone for that
theme, then verify it against the accent:

- Light theme: `#ffffff` (light foreground against the light theme’s dark
  standard text)
- Dark theme: `#0d1117` (dark foreground against the dark theme’s light
  standard text)

```bash
node .cursor/skills/manage-color/scripts/contrast.mjs <accent-hex> <theme-inverse-fg-hex>
```

- The fixed theme-inverse foreground must reach **4.5:1** for normal text.
- If the user supplied `--accent-fg`, verify that it preserves the required
  light/dark polarity and passes; if not, stop and ask for a different accent
  or foreground.
- If the required theme-inverse foreground does not reach 4.5:1, **stop** —
  ask for a different accent shade. Do **not** switch to the other polarity or
  invent a nearby colour without confirmation.

Light-theme default fg is `#ffffff`; dark-theme default is `#0d1117`. Omit
`--accent-fg` from `app.css` when the required value matches that theme’s token
default.

### 3. Write `app/css/app.css`

Merge into the existing file; preserve unrelated rules. Typical result:

```css
/**
 * Fork-owned styles. Never overwritten by framework sync.
 * Add app-specific rules here (or pull in additional local sheets).
 */

:root {
  --accent: #0969da;
}

:root[data-theme="dark"] {
  --accent: #58a6ff;
  /* --accent-fg only when using a custom dark-polarity foreground */
}
```

Do **not** write `--accent-hover` unless the user explicitly requests a custom hover hex (then set it in the same blocks).

### 4. Report

Print for each theme:

- Accent vs chosen fg ratio
- Derived hover note: `color-mix(in srgb, accent 80%, black|white)` vs fg (use `contrast.mjs --hover light|dark <accent-hex> [fg-hex]` when helpful)

## Hard rules

- Do not edit `tokens.css` for fork brand colour.
- Do not change `--banner-*`, danger, or other semantic colours here.
- Do not silently invent accent shades to “fix” contrast. Offer labelled,
  contrast-checked options for the user to choose when they want help.
