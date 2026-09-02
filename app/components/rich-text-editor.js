/**
 * Rich text editor — Toast UI Editor wrapper (Markdown + WYSIWYG).
 *
 * Requires vendor scripts and `app/toastui-editor.css` on the page:
 *   app/vendor/toastui-editor/toastui-editor-all.min.js
 *   app/vendor/toastui-editor-plugin-table-merged-cell/toastui-editor-plugin-table-merged-cell.min.js
 *
 * Mode switching uses the framework segmented control (Toast UI’s native switch is hidden).
 * Toolbar tips use framework `data-tooltip` (Toast UI’s native tooltip is hidden).
 *
 * Markup:
 *   <div class="field rich-text-editor" id="my-editor"
 *     data-rich-text-editor-height="320px"
 *     data-rich-text-editor-edit-type="wysiwyg"
 *     data-rich-text-editor-preview="vertical"
 *     data-rich-text-editor-placeholder="Write something…">
 *     <span class="field-label">Body</span>
 *     <div class="rich-text-editor-mount" aria-label="Rich text editor"></div>
 *   </div>
 *
 * data-rich-text-editor-height — editor height (default `300px`)
 * data-rich-text-editor-edit-type — `markdown` | `wysiwyg` (default `wysiwyg`)
 * data-rich-text-editor-preview — `vertical` | `tab` (default `vertical`)
 * data-rich-text-editor-placeholder — placeholder text
 * data-rich-text-editor-value — initial Markdown/HTML content
 * data-rich-text-editor-autofocus — focus the editor on init (default off; Toast UI defaults on)
 */

import { initSegmentedControl } from "./segmented-control.js";
import { APP_CONFIG } from "../config.js";
import { parseBooleanAttr } from "../utils/dom.js";

/** @type {const} */
export const TOASTUI_EDITOR_VERSION = "3.2.2";

const EDIT_TYPES = ["markdown", "wysiwyg"];
const PREVIEW_STYLES = ["vertical", "tab"];
const DEFAULT_PLUGINS = ["tableMergedCell"];

const THEME_CLASS = "toastui-editor-dark";

function isToastUiEditorReady() {
  return Boolean(window.toastui?.Editor);
}

function getToastUiEditor() {
  return window.toastui?.Editor ?? null;
}

function getTableMergedCellPlugin() {
  return window.toastui?.Editor?.plugin?.tableMergedCell ?? null;
}

function resolveTheme() {
  const theme = document.documentElement.dataset.theme;
  return theme === "dark" ? "dark" : "light";
}

function applyEditorTheme(mountEl, resolved) {
  const isDark = resolved === "dark";
  mountEl.classList.toggle(THEME_CLASS, isDark);
  mountEl
    .querySelector(".toastui-editor-defaultUI")
    ?.classList.toggle(THEME_CLASS, isDark);
}

function parseEditType(value) {
  return EDIT_TYPES.includes(value) ? value : "wysiwyg";
}

function parsePreviewStyle(value) {
  return PREVIEW_STYLES.includes(value) ? value : "vertical";
}

function readDataOption(rootEl, key, fallback) {
  const fromDataset = rootEl?.dataset?.[key];
  if (fromDataset !== undefined && fromDataset !== "") return fromDataset;
  return fallback;
}

function resolveAutofocus(rootEl, autofocusOption) {
  if (typeof autofocusOption === "boolean") return autofocusOption;
  return parseBooleanAttr(rootEl?.dataset.richTextEditorAutofocus) ?? false;
}

function resolvePlugins(pluginOption) {
  if (pluginOption === false || pluginOption?.length === 0) return [];

  const names = Array.isArray(pluginOption) ? pluginOption : DEFAULT_PLUGINS;
  const plugins = [];

  for (const name of names) {
    if (name === "tableMergedCell") {
      const plugin = getTableMergedCellPlugin();
      if (plugin) plugins.push(plugin);
    }
  }

  return plugins;
}

function readImageAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function createModeSwitch(defaultValue) {
  const wrap = document.createElement("div");
  wrap.className = "rich-text-editor-mode";

  const control = document.createElement("div");
  control.className = "segmented-control segmented-control--slim";
  control.dataset.segmentedControlDefault = defaultValue;

  const list = document.createElement("div");
  list.className = "segmented-control-list";
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "Editor mode");

  for (const value of EDIT_TYPES) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "segmented-control-item";
    item.setAttribute("role", "radio");
    item.setAttribute("aria-checked", value === defaultValue ? "true" : "false");
    item.dataset.segmentedControlValue = value;
    item.textContent = value === "markdown" ? "Markdown" : "WYSIWYG";
    list.appendChild(item);
  }

  control.appendChild(list);
  wrap.appendChild(control);
  return wrap;
}

function mountModeSwitch(mountEl, editor, defaultValue) {
  const uiRoot = mountEl.querySelector(".toastui-editor-defaultUI");
  if (!uiRoot) return null;

  const modeWrap = createModeSwitch(defaultValue);
  uiRoot.appendChild(modeWrap);

  const controlEl = modeWrap.querySelector(".segmented-control");
  const modeControl = initSegmentedControl(controlEl, {
    defaultValue,
    onChange({ value, source }) {
      if (source === "init") return;
      editor.changeMode(value);
    },
  });

  function onEditorModeChange(mode) {
    const next = parseEditType(mode);
    if (modeControl.getValue() === next) return;
    modeControl.selectValue(next, { source: "editor", emit: false });
  }

  editor.on("changeMode", onEditorModeChange);

  return {
    modeWrap,
    modeControl,
    onEditorModeChange,
  };
}

/** Map Toast UI toolbar `aria-label`s onto framework `data-tooltip` (initTooltips). */
function wireToolbarTooltips(mountEl) {
  const uiRoot = mountEl.querySelector(".toastui-editor-defaultUI");
  if (!uiRoot) return null;

  const BUTTON_SEL =
    ".toastui-editor-defaultUI-toolbar button[aria-label], .toastui-editor-dropdown-toolbar button[aria-label]";

  function sync() {
    uiRoot.querySelectorAll(BUTTON_SEL).forEach((btn) => {
      const label = btn.getAttribute("aria-label")?.trim();
      if (!label) {
        delete btn.dataset.tooltip;
        delete btn.dataset.tooltipPosition;
        return;
      }
      btn.dataset.tooltip = label;
      btn.dataset.tooltipPosition = "bottom";
    });
  }

  sync();

  const observer = new MutationObserver(sync);
  observer.observe(uiRoot, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label"],
  });

  return () => observer.disconnect();
}

export function initRichTextEditor(
  rootEl,
  {
    height,
    initialEditType,
    previewStyle,
    placeholder,
    initialValue,
    plugins,
    autofocus,
    onChange,
  } = {}
) {
  if (!rootEl || !isToastUiEditorReady()) return null;

  const Editor = getToastUiEditor();
  const mountEl = rootEl.querySelector(".rich-text-editor-mount");
  if (!Editor || !mountEl) return null;

  const resolvedHeight =
    height ?? readDataOption(rootEl, "richTextEditorHeight", "300px");
  const resolvedEditType = parseEditType(
    initialEditType ??
      readDataOption(rootEl, "richTextEditorEditType", "wysiwyg")
  );
  const resolvedPreviewStyle = parsePreviewStyle(
    previewStyle ?? readDataOption(rootEl, "richTextEditorPreview", "vertical")
  );
  const resolvedPlaceholder =
    placeholder ?? readDataOption(rootEl, "richTextEditorPlaceholder", "");
  const resolvedInitialValue =
    initialValue ?? readDataOption(rootEl, "richTextEditorValue", "");
  const resolvedAutofocus = resolveAutofocus(rootEl, autofocus);

  const editor = new Editor({
    el: mountEl,
    height: resolvedHeight,
    initialEditType: resolvedEditType,
    previewStyle: resolvedPreviewStyle,
    placeholder: resolvedPlaceholder || undefined,
    initialValue: resolvedInitialValue,
    autofocus: resolvedAutofocus,
    hideModeSwitch: true,
    theme: resolveTheme(),
    plugins: resolvePlugins(plugins),
    hooks: {
      addImageBlobHook(blob, callback) {
        readImageAsDataUrl(blob)
          .then((dataUrl) => callback(dataUrl, blob.name || "image"))
          .catch(() => callback("", blob.name || "image"));
      },
    },
  });

  applyEditorTheme(mountEl, resolveTheme());

  const modeSwitch = mountModeSwitch(mountEl, editor, resolvedEditType);
  const unwireToolbarTooltips = wireToolbarTooltips(mountEl);

  if (!resolvedAutofocus && typeof editor.blur === "function") {
    editor.blur();
  }

  function emitChange(source) {
    onChange?.({
      markdown: editor.getMarkdown(),
      html: editor.getHTML(),
      source,
    });
  }

  function onEditorChange() {
    emitChange("input");
  }

  function onThemeChange(event) {
    const resolved = event.detail?.resolved;
    if (resolved === "dark" || resolved === "light") {
      applyEditorTheme(mountEl, resolved);
    }
  }

  editor.on("change", onEditorChange);
  document.addEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);

  let destroyed = false;

  return {
    getMarkdown() {
      return editor.getMarkdown();
    },
    getHTML() {
      return editor.getHTML();
    },
    getEditType() {
      if (typeof editor.isMarkdownMode === "function" && editor.isMarkdownMode()) {
        return "markdown";
      }
      return "wysiwyg";
    },
    setEditType(value) {
      const next = parseEditType(value);
      editor.changeMode(next);
      modeSwitch?.modeControl.selectValue(next, { source: "api", emit: false });
    },
    setMarkdown(value) {
      editor.setMarkdown(value ?? "");
      emitChange("setMarkdown");
    },
    setHTML(value) {
      editor.setHTML(value ?? "");
      emitChange("setHTML");
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      editor.off("change", onEditorChange);
      unwireToolbarTooltips?.();
      if (modeSwitch) {
        editor.off("changeMode", modeSwitch.onEditorModeChange);
        modeSwitch.modeWrap.remove();
      }
      document.removeEventListener(APP_CONFIG.themeChangeEvent, onThemeChange);
      editor.destroy();
    },
  };
}

/** Wire every `.rich-text-editor` with a mount node in `root`. */
export function initRichTextEditors(root = document) {
  const instances = [];

  for (const el of root.querySelectorAll(".rich-text-editor")) {
    if (!el.querySelector(".rich-text-editor-mount")) continue;
    const instance = initRichTextEditor(el);
    if (instance) instances.push(instance);
  }

  return instances;
}
