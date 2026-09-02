# 🤏 SMA1 Framework

A feature-rich framework **for building small, static apps**.  
Ready for GitHub Pages deployment. LLM skills included.  

Test all components: [demo](https://filcuk.github.io/sma1-framework/demo.html)

![Scrolling demo](res/demo-scroll.avif)

## Quick start

1. Click **Use this template** on GitHub to create a new repo.
2. Follow **[USAGE.md](USAGE.md)** to customize the homepage, remove the demo if you do not need it, and configure branding.
3. Build your UI in `index.html` and wire logic in [`app/main.js`](app/main.js).
4. Push to `main`, then in **Settings → Pages** set **Source** to **GitHub Actions**.
5. After the deploy workflow runs, open `https://<user>.github.io/<repo>/` (or `demo.html` if you kept it).

## Documentation

| Guide | Contents |
| ----- | -------- |
| **[demo.html](demo.html)** | Interactive showcase of all components |
| **[USAGE.md](USAGE.md)** | Forking the framework, project layout, local preview, GitHub Pages, component catalogue, and markup/JS examples |
| **[DEVELOPMENT.md](DEVELOPMENT.md)** | Maintainer tooling: lint/test, README demo scroll capture |
| **[DESIGN.md](DESIGN.md)** | Design philosophy: action feedback, tooltip modes, selection highlights, aesthetics |
| **[DISCLAIMER.md](DISCLAIMER.md)** | LLM assistance, warranty, and third-party license notices |
| **[AGENTS.md](AGENTS.md)** | Rules for AI assistants (LLM skills & workflow automation) working in this repo |
| **[.cursor/skills/](.cursor/skills/)** | LLM skills: multi-step automations for repo maintenance, codegen, upgrades, and more |

## Stack

- Plain HTML, CSS custom properties, and ES modules
- Light / dark / system theme with flash-free `theme-init.js`
- Shared page chrome (footer, theme toggle, page nav) via `initShell()`
- Optional vendors: [Prism.js](https://prismjs.com/) (code blocks), [Toast UI Editor](https://github.com/nhn/tui.editor) (rich text)
- Deployed with GitHub Actions to GitHub Pages

## Development

```bash
npm ci          # Install deps
npm run lint    # Run linter
npm test        # Run automated tests
npx serve .     # Start a local server
```

Maintainer notes (README scroll capture, etc.): **[DEVELOPMENT.md](DEVELOPMENT.md)**.

## License

MIT - see [LICENSE](LICENSE).
