# d3-scale (vendored)

Pinned **4.0.2** self-contained ESM bundle used to satisfy TanStack Charts’
bare `import … from "d3-scale"` (e.g. `bar.js`).

Source: `https://esm.sh/d3-scale@4.0.2/es2022/d3-scale.bundle.mjs`

Map it in the page import map (with `d3-shape` when using `barY` / `barX`):

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
