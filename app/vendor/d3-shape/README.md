# d3-shape (vendored)

Pinned **3.2.0** self-contained ESM bundle used to satisfy TanStack Charts’
bare `import … from "d3-shape"` (e.g. `stack-internal.js` via `barY`).

Source: `https://esm.sh/d3-shape@3.2.0/es2022/d3-shape.bundle.mjs`

Map it in the page import map alongside `d3-scale`:

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
