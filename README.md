# Power BI Embedder

Tools for embedding documents in M and DAX whilst bypassing data limits or file type constraints.

Live site: [filcuk.github.io/pbi-embedder](https://filcuk.github.io/pbi-embedder/)

## What it does

1. Choose **input** and **output** formats: Tabular, JSON, M-JSON, or Base64.
2. Edit or paste the input (or **Load sample**).
3. When output is M-JSON, tune quote style, format (Original / Format / Compact), include parsing, and optional quote conversion.
4. When input or output is Base64, optionally GZip-compress the JSON payload before encoding (on by default). When output is Base64, include parsing wraps a Power Query decode/`Table.FromRecords` query.
5. Copy the result (code toolbar, or **Copy** above tabular output for Excel-friendly TSV).

Selection and input content are remembered in the browser (`localStorage`).

## Development

Built on the [SMA1 Framework](https://github.com/filcuk/sma1-framework) — plain HTML, CSS, and ES modules, deployed to GitHub Pages.

```bash
npm ci
npm run lint
npm test
npm run verify:framework
npx serve .
```

`npm test` runs the fork test suite (`scripts/test-app.mjs`) — catalogue tests for trimmed framework components are skipped.  
App conversion logic lives under `app/tools/` (`convert.js`, `selection.js`, `persist.js`, `output-table.js`).

## License

MIT — see [LICENSE](LICENSE).
