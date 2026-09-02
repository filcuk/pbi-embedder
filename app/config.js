/** Fork-sensitive defaults — edit when creating your app from this framework. */
export const APP_CONFIG = {
  /** Public site URL (GitHub Pages / custom domain). Used to hide this app in “also see”. */
  appUrl: "https://fifak.github.io/pbi-embedder/",
  repoUrl: "https://github.com/fifak/pbi-embedder",
  themeStorageKey: "pbi-embedder-theme",
  themeChangeEvent: "pbi-embedder-theme-change",
  /**
   * Remote JSON for the footer “also see” menu.
   * Top-level array of `{ topic, items, order? }` sections and/or flat link objects.
   * Optional `order` on topics/links; `accent` / `accentHover` hex colours, or
   * `accentLight` / `accentDark` (and hover) theme pairs — `accent*` scopes
   * menu item highlight chrome; `accentHover*` is for the also-see trigger
   * (item hover/press still use `--accent`); `iconSvg` / `iconSvgLight` /
   * `iconSvgDark` for embedded SVG (wins over URL icons). Prefer a
   * raw.githubusercontent.com or GitHub Pages URL. Empty = skip fetch. On
   * success, shows the remote list (merged with local when
   * `alsoSeeIncludeLocal` is true). Local is never used as a fallback.
   */
  alsoSeeUrl:
    "https://raw.githubusercontent.com/filcuk/shared/refs/heads/main/apps/links.json",
  /**
   * Topic filter for the **remote** also-see list (`"*"`, `""`, `"Topic"`,
   * `"-Topic"`). Local `alsoSee` is not filtered when `alsoSeeIncludeLocal`
   * is true. Uncomment one example below.
   */
  alsoSeeTopics: ["*"], // all remote links
  // alsoSeeTopics: [], // no remote links
  // alsoSeeTopics: ["*", "-Power BI"], // all remote except Power BI
  // alsoSeeTopics: ["Embedded", ""], // only Embedded + ungrouped
  /**
   * When true, include local `alsoSee` in full (alone if there is no remote, or
   * merged with the filtered remote — same topic names share one section; items
   * de-duplicated by URL). When false, local is never shown.
   */
  alsoSeeIncludeLocal: false,
  alsoSee: [],
};
