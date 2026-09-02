# mermaid (vendored)

Pinned **11.16.1** browser ESM runtime from the package `dist/`:

- `mermaid.esm.min.mjs` — entry (lazy-loads diagram chunks)
- `chunks/mermaid.esm.min/*.mjs` — diagram and shared chunks (`.mjs` only; no `.map` / `.d.ts`)

Import with a **relative** path from app modules, e.g.
`../vendor/mermaid/mermaid.esm.min.mjs`. Chunks resolve next to the entry via
relative `./chunks/…` imports (needs a local server or GitHub Pages).

## Refresh

```bash
npm pack mermaid@11.16.1
# extract package/dist/mermaid.esm.min.mjs → app/vendor/mermaid/
# extract package/dist/chunks/mermaid.esm.min/*.mjs → app/vendor/mermaid/chunks/mermaid.esm.min/
# omit *.map and *.d.ts
```

## Trimming

- Prefer removing this whole directory with the diagram component via **finalize-app** when unused.
- At runtime Mermaid only fetches diagram-type chunks that are needed.
- Advanced: deleting unused `*Diagram*.mjs` / `*-definition-*.mjs` files shrinks the
  checkout but those diagram types will fail to load. Do not delete shared
  `chunk-*.mjs` files.

See `app/components/diagram.js` for the version constant and host API.
