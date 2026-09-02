# Development

Local checks, preview, and maintainer tooling for this framework repository.

## Setup

```bash
npm ci
npx serve .     # http://localhost:3000 — ES modules need a local server
```

## Quality checks

```bash
npm run lint
npm test
npm run manifest:framework   # regenerate framework-manifest.json after catalogue changes
npm run verify:framework     # check tree vs framework.lock.json + manifest hashes
```

See [USAGE.md](USAGE.md) for forking, Pages deploy, and the component catalogue.

## README demo scroll capture

Regenerate a looping scroll of [`demo.html`](demo.html) for README media. This is **dev-only** tooling under `scripts/` — it does not ship in `app/` or change the demo page for users.

Behaviour:

- **Removes** site header, footer, and page-nav from the DOM (not just hidden)
- Turns off sticky section headers
- **Duplicates `#main`** so after the last section you overscroll into the first section again (infinite carousel)
- Captures **screenshots only while scrolling** — no frozen lead-in at the top or hold on the footer
- Encodes **animated AVIF** by default (optional WebP / WebM / GIF via `--format`); looping the file should look endless

### Prerequisites

```bash
npm ci
npx playwright install chromium   # once per machine
```

Encoding uses system `ffmpeg` if on `PATH`, otherwise the bundled [`ffmpeg-static`](https://www.npmjs.com/package/ffmpeg-static) binary from `npm ci` (needs `libaom-av1` + `avif` muxer for the default format).

### Record

```bash
npm run capture:demo
```

| File | Notes |
| ---- | ----- |
| `res/demo-scroll.avif` | Default — animated AVIF (AV1), infinite loop |
| `res/demo-scroll.webp` | With `--format webp` |
| `res/demo-scroll.webm` | With `--format webm` |
| `res/demo-scroll.gif` | With `--format gif` |

Defaults: **dark** theme, viewport **1400×1000**, **45s** / **30 fps** capture (auto-boosts frame count if scroll steps would be too large), format **avif**.

AVIF / WebP delivery defaults aim for **≤ ~10 MB**: AVIF starts at CRF 32 / 20 fps / 800px (`libaom-av1`), WebP at quality 70; both ease quality → fps → width until under `--max-mb` (default `10`; `0` disables). Capture stays dense so motion remains smooth after fps downsampling.

### Useful options

```bash
npm run capture:demo -- --help
npm run capture:demo -- --preview              # headed browser; inspect the carousel seam
npm run capture:demo -- --show-titles          # keep Theme / Properties headings (hidden by default)
npm run capture:demo -- --headed               # show Chromium while capturing frames
npm run capture:demo -- --theme light
npm run capture:demo -- --format webp          # animated WebP instead of AVIF
npm run capture:demo -- --format webm          # often smoothest in desktop players
npm run capture:demo -- --format gif
npm run capture:demo -- --format avif,webp     # several at once
npm run capture:demo -- --max-mb 10            # default size budget (avif/webp)
npm run capture:demo -- --width 1400 --out-width 900   # capture wide, export narrower
npm run capture:demo -- --reuse-frames                 # re-encode only (uses res/.demo-scroll-frames)
npm run capture:demo -- --reuse-frames --out-width 800 --avif-crf 28
npm run capture:demo -- --clean-frames                 # delete frames after encode
npm run capture:demo -- --avif-crf 28 --out-fps 24 --max-mb 0
npm run capture:demo -- --duration 16000 --fps 60 --width 900 --height 560
npm run capture:demo -- --basename demo-scroll-dark --theme dark
```

`--width` / `--height` are the **browser viewport** used while capturing. `--out-width` only scales the encoded AVIF/WebP (and size-budget passes may shrink it further). `--dpr` is unrelated: it multiplies screenshot resolution for sharper pixels (e.g. `2` = Retina), and usually makes files larger.

Frames are kept in `res/.demo-scroll-frames/` after capture (with `frames-meta.json`) so you can tweak encode settings via `--reuse-frames` without re-scrolling the demo. Pass `--clean-frames` to remove them when finished.

| Path | Role |
| ---- | ---- |
| [`scripts/capture-demo-scroll.mjs`](scripts/capture-demo-scroll.mjs) | CLI, frame capture, ffmpeg encode |
| [`scripts/lib/capture-demo-prepare.mjs`](scripts/lib/capture-demo-prepare.mjs) | Injected prep (strip chrome/titles, clone `#main`) |

### Release habit

When the demo changed in a meaningful way, regenerate media before cutting a framework release (`release-framework` checklist includes this as optional).
