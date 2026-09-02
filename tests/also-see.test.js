import test from "node:test";
import assert from "node:assert/strict";
import {
  alsoSeeHasItems,
  alsoSeeMenuColumns,
  mergeAlsoSeeSections,
  normalizeAlsoSee,
  normalizeSiteUrl,
  renderAlsoSeeMarkup,
} from "../app/shell/render-shell.js";

test("normalizeSiteUrl strips trailing slash, query, and hash", () => {
  assert.equal(
    normalizeSiteUrl("https://Example.com/app/?x=1#y"),
    "https://example.com/app"
  );
  assert.equal(
    normalizeSiteUrl("https://example.com/app/"),
    "https://example.com/app"
  );
});

test("normalizeAlsoSee excludes the current appUrl from flat links", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Self",
        url: "https://filcuk.github.io/sma1-framework/",
      },
      {
        label: "Other",
        url: "https://pqms.gh.fitec.dev/",
      },
    ],
    "https://filcuk.github.io/sma1-framework",
    ["*"]
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].topic, null);
  assert.equal(sections[0].items.length, 1);
  assert.equal(sections[0].items[0].label, "Other");
});

test("normalizeAlsoSee keeps topic sections and drops empty ones after appUrl filter", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Power BI",
        items: [
          {
            label: "Self",
            url: "https://filcuk.github.io/pbi-tabulator/",
          },
          {
            label: "Other",
            url: "https://filcuk.github.io/pqm-stepper/",
          },
        ],
      },
      {
        topic: "Only self",
        items: [
          {
            label: "Self",
            url: "https://filcuk.github.io/pbi-tabulator/",
          },
        ],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "https://filcuk.github.io/pbi-tabulator/",
    ["*"]
  );

  assert.equal(sections.length, 2);
  assert.equal(sections[0].topic, "Power BI");
  assert.deepEqual(
    sections[0].items.map((item) => item.label),
    ["Other"]
  );
  assert.equal(sections[1].topic, null);
  assert.equal(sections[1].items[0].label, "Profile");
});

test("normalizeAlsoSee filters topics by whitelist (case-insensitive)", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Power BI",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        topic: "Database",
        items: [{ label: "B", url: "https://example.com/b" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    ["power bi"]
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].topic, "Power BI");
  assert.equal(sections[0].items[0].label, "A");
});

test("normalizeAlsoSee includes ungrouped links only when \"\" is whitelisted", () => {
  const without = normalizeAlsoSee(
    [
      {
        topic: "Embedded",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    ["Embedded"]
  );
  assert.equal(without.length, 1);
  assert.equal(without[0].topic, "Embedded");

  const withUngrouped = normalizeAlsoSee(
    [
      {
        topic: "Embedded",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    ["Embedded", ""]
  );
  assert.equal(withUngrouped.length, 2);
  assert.equal(withUngrouped[0].topic, "Embedded");
  assert.equal(withUngrouped[1].topic, null);
  assert.equal(withUngrouped[1].items[0].label, "Profile");
});

test("normalizeAlsoSee \"*\" keeps all topics; empty filter keeps none", () => {
  const data = [
    {
      topic: "Power BI",
      items: [{ label: "A", url: "https://example.com/a" }],
    },
    {
      label: "Profile",
      url: "https://github.com/filcuk",
    },
  ];

  const all = normalizeAlsoSee(data, "", ["*"]);
  assert.equal(all.length, 2);
  assert.equal(all[0].topic, "Power BI");
  assert.equal(all[1].topic, null);

  assert.equal(normalizeAlsoSee(data, "", []).length, 0);
  assert.equal(normalizeAlsoSee(data, "", ["-Power BI"]).length, 0);
});

test("normalizeAlsoSee \"*\" with exclusions drops listed topics", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Power BI",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        topic: "Database",
        items: [{ label: "B", url: "https://example.com/b" }],
      },
      {
        topic: "Embedded",
        items: [{ label: "C", url: "https://example.com/c" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    ["*", "-Database", "-power bi"]
  );

  assert.equal(sections.length, 2);
  assert.equal(sections[0].topic, "Embedded");
  assert.equal(sections[1].topic, null);
  assert.equal(sections[1].items[0].label, "Profile");
});

test("normalizeAlsoSee \"-\" excludes ungrouped when using \"*\"", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Embedded",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    ["*", "-"]
  );

  assert.equal(sections.length, 1);
  assert.equal(sections[0].topic, "Embedded");
});

test("normalizeAlsoSee empty topic whitelist keeps nothing", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Power BI",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
    ],
    "",
    []
  );

  assert.equal(sections.length, 0);
});

test("mergeAlsoSeeSections merges matching topics and dedupes by URL", () => {
  const merged = mergeAlsoSeeSections(
    [
      {
        topic: "Embedded",
        items: [
          {
            label: "Remote A",
            subtitle: "",
            url: "https://example.com/a",
            icon: "",
            iconLight: "",
            iconDark: "",
          },
        ],
      },
      {
        topic: null,
        items: [
          {
            label: "Profile",
            subtitle: "",
            url: "https://github.com/filcuk",
            icon: "",
            iconLight: "",
            iconDark: "",
          },
        ],
      },
    ],
    [
      {
        topic: "embedded",
        items: [
          {
            label: "Remote A dup",
            subtitle: "",
            url: "https://example.com/a/",
            icon: "",
            iconLight: "",
            iconDark: "",
          },
          {
            label: "Local B",
            subtitle: "",
            url: "https://example.com/b",
            icon: "",
            iconLight: "",
            iconDark: "",
          },
        ],
      },
      {
        topic: "Examples",
        items: [
          {
            label: "Local C",
            subtitle: "",
            url: "https://example.com/c",
            icon: "",
            iconLight: "",
            iconDark: "",
          },
        ],
      },
    ]
  );

  assert.equal(merged.length, 3);
  assert.equal(merged[0].topic, "Embedded");
  assert.deepEqual(
    merged[0].items.map((item) => item.label),
    ["Remote A", "Local B"]
  );
  assert.equal(merged[1].topic, "Examples");
  assert.equal(merged[1].items[0].label, "Local C");
  assert.equal(merged[2].topic, null);
  assert.equal(merged[2].items[0].label, "Profile");
});

test("normalizeAlsoSee places ungrouped section last", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Profile",
        url: "https://github.com/filcuk",
      },
      {
        topic: "Embedded",
        items: [{ label: "A", url: "https://example.com/a" }],
      },
      {
        label: "Extra",
        url: "https://example.com/extra",
      },
    ],
    "",
    ["*"]
  );

  assert.equal(sections.length, 2);
  assert.equal(sections[0].topic, "Embedded");
  assert.equal(sections[1].topic, null);
  assert.deepEqual(
    sections[1].items.map((item) => item.label),
    ["Profile", "Extra"]
  );
});

test("renderAlsoSeeMarkup emits topic groups with shared columns", () => {
  const markup = renderAlsoSeeMarkup([
    {
      topic: "Database",
      order: null,
      items: [
        {
          label: "CS Builder",
          subtitle: "Zero-knowledge",
          url: "https://example.com/cs",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg: "",
          iconSvgLight: "",
          iconSvgDark: "",
          order: null,
        },
      ],
    },
  ]);

  assert.match(markup, /dropdown-menu-group">Database</);
  assert.match(markup, /data-also-see-columns="1"/);
  assert.match(markup, /href="https:\/\/example\.com\/cs"/);
  assert.match(markup, /CS Builder/);
  assert.doesNotMatch(markup, /footer-also-see-topic/);
  assert.equal(alsoSeeHasItems([]), false);
  assert.equal(
    alsoSeeHasItems([{ topic: "X", order: null, items: [] }]),
    false
  );
});

test("alsoSeeMenuColumns picks the grid with fewest trailing gaps", () => {
  const section = (count) => ({
    topic: `T${count}`,
    order: null,
    items: Array.from({ length: count }, () => ({ label: "x", url: "y" })),
  });

  assert.equal(alsoSeeMenuColumns([]), 1);
  assert.equal(alsoSeeMenuColumns([section(1), section(1)]), 1);
  // 4 + 1 + 1 + 2 links: two columns beat three (fewer holes) and one (taller).
  assert.equal(
    alsoSeeMenuColumns([section(4), section(1), section(1), section(2)]),
    2
  );
  assert.equal(alsoSeeMenuColumns([section(6), section(3)]), 3);
});

test("renderAlsoSeeMarkup makes every topic full width", () => {
  const fourLinks = [1, 2, 3, 4].map((n) => ({
    label: `App ${n}`,
    subtitle: "",
    url: `https://example.com/${n}`,
    icon: "",
    iconLight: "",
    iconDark: "",
    iconSvg: "",
    iconSvgLight: "",
    iconSvgDark: "",
    order: null,
  }));

  const markup = renderAlsoSeeMarkup([
    {
      topic: "Power BI",
      order: 10,
      items: fourLinks,
    },
    {
      topic: null,
      order: null,
      items: [
        {
          label: "Profile",
          subtitle: "",
          url: "https://github.com/filcuk",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg: "",
          iconSvgLight: "",
          iconSvgDark: "",
          order: null,
        },
      ],
    },
  ]);

  // 4 links + 1 ungrouped link: two columns leave the fewest holes.
  assert.match(markup, /data-also-see-columns="2"/);
  assert.match(markup, /footer-also-see-section-break[\s\S]*Profile/);
  assert.doesNotMatch(markup, /--also-see-span/);
  assert.doesNotMatch(markup, /footer-also-see-topic/);
  assert.doesNotMatch(markup, /dropdown-menu-separator/);
});

test("normalizeAlsoSee keeps a single icon without inventing a theme pair", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Legacy",
        url: "https://example.com/legacy",
        icon: "https://example.com/icon.svg",
      },
    ],
    "",
    ["*"]
  );

  assert.equal(sections[0].items[0].icon, "https://example.com/icon.svg");
  assert.equal(sections[0].items[0].iconLight, "");
  assert.equal(sections[0].items[0].iconDark, "");
});

test("normalizeAlsoSee keeps valid per-link accent colours", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Branded",
        url: "https://example.com/branded",
        accent: "#8250df",
        accentHover: "#6639ba",
      },
    ],
    "",
    ["*"]
  );

  const item = sections[0].items[0];
  assert.equal(item.accent, "#8250df");
  assert.equal(item.accentHover, "#6639ba");
  assert.equal(item.accentLight, "");
  assert.equal(item.accentDark, "");
  assert.equal(item.accentHoverLight, "");
  assert.equal(item.accentHoverDark, "");
});

test("normalizeAlsoSee prefers accentLight/accentDark over accent", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Themed",
        url: "https://example.com/themed",
        accent: "#8250df",
        accentHover: "#6639ba",
        accentLight: "#1a7f37",
        accentDark: "#3fb950",
        accentHoverLight: "#116329",
        accentHoverDark: "#56d364",
      },
    ],
    "",
    ["*"]
  );

  const item = sections[0].items[0];
  assert.equal(item.accent, "");
  assert.equal(item.accentHover, "");
  assert.equal(item.accentLight, "#1a7f37");
  assert.equal(item.accentDark, "#3fb950");
  assert.equal(item.accentHoverLight, "#116329");
  assert.equal(item.accentHoverDark, "#56d364");
});

test("normalizeAlsoSee clones a missing accentLight/accentDark side", () => {
  const lightOnly = normalizeAlsoSee(
    [
      {
        label: "Light",
        url: "https://example.com/light",
        accentLight: "#1a7f37",
      },
    ],
    "",
    ["*"]
  )[0].items[0];
  assert.equal(lightOnly.accentLight, "#1a7f37");
  assert.equal(lightOnly.accentDark, "#1a7f37");

  const darkOnly = normalizeAlsoSee(
    [
      {
        label: "Dark",
        url: "https://example.com/dark",
        accentDark: "#3fb950",
        accentHoverDark: "#56d364",
      },
    ],
    "",
    ["*"]
  )[0].items[0];
  assert.equal(darkOnly.accentLight, "#3fb950");
  assert.equal(darkOnly.accentDark, "#3fb950");
  assert.equal(darkOnly.accentHoverLight, "#56d364");
  assert.equal(darkOnly.accentHoverDark, "#56d364");
});

test("normalizeAlsoSee rejects non-hex accent values", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Unsafe",
        url: "https://example.com/unsafe",
        accent: "red; background: url(https://example.com/tracker)",
        accentHover: "oklch(50% 0.2 120)",
        accentLight: "green",
        accentDark: "var(--accent)",
      },
    ],
    "",
    ["*"]
  );

  const item = sections[0].items[0];
  assert.equal(item.accent, "");
  assert.equal(item.accentHover, "");
  assert.equal(item.accentLight, "");
  assert.equal(item.accentDark, "");
});

test("renderAlsoSeeMarkup scopes accent colours to their link", () => {
  const markup = renderAlsoSeeMarkup([
    {
      topic: null,
      order: null,
      items: [
        {
          label: "Branded",
          subtitle: "",
          url: "https://example.com/branded",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg: "",
          iconSvgLight: "",
          iconSvgDark: "",
          accent: "#8250df",
          accentLight: "",
          accentDark: "",
          accentHover: "#6639ba",
          accentHoverLight: "",
          accentHoverDark: "",
          order: null,
        },
      ],
    },
  ]);

  assert.match(
    markup,
    /style="--accent: #8250df; --accent-hover: #6639ba"/
  );
  assert.doesNotMatch(markup, /footer-also-see-item--accent-pair/);
});

test("renderAlsoSeeMarkup scopes theme-pair accent colours to their link", () => {
  const markup = renderAlsoSeeMarkup([
    {
      topic: null,
      order: null,
      items: [
        {
          label: "Themed",
          subtitle: "",
          url: "https://example.com/themed",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg: "",
          iconSvgLight: "",
          iconSvgDark: "",
          accent: "",
          accentLight: "#1a7f37",
          accentDark: "#3fb950",
          accentHover: "",
          accentHoverLight: "#116329",
          accentHoverDark: "#56d364",
          order: null,
        },
      ],
    },
  ]);

  assert.match(markup, /footer-also-see-item--accent-pair/);
  assert.match(markup, /footer-also-see-item--accent-hover-pair/);
  assert.match(
    markup,
    /style="--also-see-accent-light: #1a7f37; --also-see-accent-dark: #3fb950; --also-see-accent-hover-light: #116329; --also-see-accent-hover-dark: #56d364"/
  );
  assert.doesNotMatch(markup, /--accent:/);
});

test("renderAlsoSeeMarkup allows mixed single accent and hover pair", () => {
  const markup = renderAlsoSeeMarkup([
    {
      topic: null,
      order: null,
      items: [
        {
          label: "Mixed",
          subtitle: "",
          url: "https://example.com/mixed",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg: "",
          iconSvgLight: "",
          iconSvgDark: "",
          accent: "#8250df",
          accentLight: "",
          accentDark: "",
          accentHover: "",
          accentHoverLight: "#6639ba",
          accentHoverDark: "#a371f7",
          order: null,
        },
      ],
    },
  ]);

  assert.doesNotMatch(markup, /footer-also-see-item--accent-pair/);
  assert.match(markup, /footer-also-see-item--accent-hover-pair/);
  assert.match(
    markup,
    /style="--accent: #8250df; --also-see-accent-hover-light: #6639ba; --also-see-accent-hover-dark: #a371f7"/
  );
});

test("normalizeAlsoSee prefers iconLight/iconDark theme pair", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Modern",
        url: "https://example.com/modern",
        icon: "https://example.com/ignored.svg",
        iconLight: "https://example.com/app-light.svg",
        iconDark: "https://example.com/app-dark.svg",
      },
    ],
    "",
    ["*"]
  );

  const item = sections[0].items[0];
  assert.equal(item.icon, "");
  assert.equal(item.iconLight, "https://example.com/app-light.svg");
  assert.equal(item.iconDark, "https://example.com/app-dark.svg");
});

test("renderAlsoSeeMarkup uses one img for icon and a pair for light/dark", () => {
  const single = renderAlsoSeeMarkup([
    {
      topic: null,
      items: [
        {
          label: "Single",
          subtitle: "",
          url: "https://example.com/a",
          icon: "https://example.com/icon.svg",
          iconLight: "",
          iconDark: "",
        },
      ],
    },
  ]);
  assert.match(
    single,
    /dropdown-menu-item-icon" src="https:\/\/example\.com\/icon\.svg"/
  );
  assert.doesNotMatch(single, /brand-icon--light/);
  assert.doesNotMatch(single, /brand-icon--dark/);

  const pair = renderAlsoSeeMarkup([
    {
      topic: null,
      items: [
        {
          label: "Pair",
          subtitle: "",
          url: "https://example.com/b",
          icon: "",
          iconLight: "https://example.com/app-light.svg",
          iconDark: "https://example.com/app-dark.svg",
        },
      ],
    },
  ]);
  assert.match(
    pair,
    /brand-icon--light" src="https:\/\/example\.com\/app-light\.svg"/
  );
  assert.match(
    pair,
    /brand-icon--dark" src="https:\/\/example\.com\/app-dark\.svg"/
  );
});

test("normalizeAlsoSee sorts topics and links by order", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "Later",
        order: 20,
        items: [
          { label: "B", url: "https://example.com/b", order: 20 },
          { label: "A", url: "https://example.com/a", order: 10 },
        ],
      },
      {
        topic: "Earlier",
        order: 10,
        items: [{ label: "C", url: "https://example.com/c", order: 5 }],
      },
      {
        label: "Ungrouped high",
        url: "https://example.com/u2",
        order: 20,
      },
      {
        label: "Ungrouped low",
        url: "https://example.com/u1",
        order: 10,
      },
    ],
    "",
    ["*"]
  );

  assert.deepEqual(
    sections.map((section) => section.topic),
    ["Earlier", "Later", null]
  );
  assert.deepEqual(
    sections[1].items.map((item) => item.label),
    ["A", "B"]
  );
  assert.deepEqual(
    sections[2].items.map((item) => item.label),
    ["Ungrouped low", "Ungrouped high"]
  );
});

test("normalizeAlsoSee puts missing order after numbered entries", () => {
  const sections = normalizeAlsoSee(
    [
      {
        topic: "No order",
        items: [
          { label: "Missing", url: "https://example.com/m" },
          { label: "First", url: "https://example.com/f", order: 1 },
        ],
      },
      {
        topic: "Numbered",
        order: 5,
        items: [{ label: "N", url: "https://example.com/n" }],
      },
    ],
    "",
    ["*"]
  );

  assert.deepEqual(
    sections.map((section) => section.topic),
    ["Numbered", "No order"]
  );
  assert.deepEqual(
    sections[1].items.map((item) => item.label),
    ["First", "Missing"]
  );
  assert.equal(sections[0].order, 5);
  assert.equal(sections[1].order, null);
  assert.equal(sections[1].items[0].order, 1);
  assert.equal(sections[1].items[1].order, null);
});

test("mergeAlsoSeeSections keeps lower topic order and re-sorts links", () => {
  const merged = mergeAlsoSeeSections(
    [
      {
        topic: "Embedded",
        order: 30,
        items: [
          {
            label: "Remote late",
            subtitle: "",
            url: "https://example.com/a",
            icon: "",
            iconLight: "",
            iconDark: "",
            order: 20,
          },
        ],
      },
    ],
    [
      {
        topic: "embedded",
        order: 10,
        items: [
          {
            label: "Local early",
            subtitle: "",
            url: "https://example.com/b",
            icon: "",
            iconLight: "",
            iconDark: "",
            order: 5,
          },
        ],
      },
      {
        topic: "Examples",
        order: 20,
        items: [
          {
            label: "Local C",
            subtitle: "",
            url: "https://example.com/c",
            icon: "",
            iconLight: "",
            iconDark: "",
            order: 1,
          },
        ],
      },
    ]
  );

  assert.deepEqual(
    merged.map((section) => [section.topic, section.order]),
    [
      ["Embedded", 10],
      ["Examples", 20],
    ]
  );
  assert.deepEqual(
    merged[0].items.map((item) => item.label),
    ["Local early", "Remote late"]
  );
});

test("normalizeAlsoSee prefers iconSvg over URL icons", () => {
  const sections = normalizeAlsoSee(
    [
      {
        label: "Sponsor",
        url: "https://github.com/sponsors/filcuk",
        icon: "https://example.com/ignored.svg",
        iconSvg:
          '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1v14"/></svg>',
      },
    ],
    "",
    ["*"]
  );

  const item = sections[0].items[0];
  assert.match(item.iconSvg, /viewBox="0 0 16 16"/);
  assert.equal(item.icon, "");
  assert.equal(item.iconLight, "");
  assert.equal(item.iconDark, "");
});

test("renderAlsoSeeMarkup emits sanitized inline SVG icons", () => {
  const markup = renderAlsoSeeMarkup([
    {
      topic: null,
      order: null,
      items: [
        {
          label: "Sponsor",
          subtitle: "",
          url: "https://github.com/sponsors/filcuk",
          icon: "",
          iconLight: "",
          iconDark: "",
          iconSvg:
            '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1v14"/></svg>',
          iconSvgLight: "",
          iconSvgDark: "",
          order: null,
        },
      ],
    },
  ]);

  assert.match(markup, /<svg\b[^>]*class="dropdown-menu-item-icon"/);
  assert.match(markup, /viewBox="0 0 16 16"/);
  assert.doesNotMatch(markup, /<img\b/);
});
