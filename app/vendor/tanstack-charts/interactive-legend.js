import {
  layoutCategoricalLegendItems,
  resolveCategoricalLegendItems
} from "./legend-layout-internal.js";
import { filterMarkSceneByPoint } from "./mark-scene-filter-internal.js";
import { valueKey } from "./scales.js";
const defaultItemWidth = 110;
const controlGap = 8;
const controlPadding = 6;
const controlItemHeight = 44;
function interactiveColorLegend(options) {
  const placement = options.placement ?? "bottom";
  const minimumItemWidth = Math.max(64, options.itemWidth ?? defaultItemWidth);
  const selectedKeys = new Set(options.visible.value.map(valueKey));
  const isVisible = (value) => selectedKeys.has(valueKey(value));
  return {
    placement,
    seriesVisible: isVisible,
    filterMark(scene, { seriesFromColor }) {
      return seriesFromColor ? filterMarkSceneByPoint(
        scene,
        (point) => point.group === null || isVisible(point.group)
      ) : scene;
    },
    height(itemCount, context) {
      assertCategorical(context.colors.kind);
      const layout = layoutCategoricalLegendItems(
        itemCount,
        context.chart.width + controlGap,
        minimumItemWidth + controlGap
      );
      return controlPadding * 2 + layout.rows * controlItemHeight + Math.max(0, layout.rows - 1) * controlGap;
    },
    render(context) {
      assertCategorical(context.colors.kind);
      return renderStaticFallback(
        context,
        isVisible,
        options.format,
        minimumItemWidth
      );
    },
    control(context) {
      assertCategorical(context.colors.kind);
      const items = resolveCategoricalLegendItems(
        context.colors,
        options.format
      ).map((item) => {
        const visible = isVisible(item.value);
        return {
          ...item,
          visible,
          ariaLabel: options.itemAriaLabel?.(item.value, { visible }) ?? `Toggle ${item.label} series`
        };
      });
      const layout = layoutCategoricalLegendItems(
        items.length,
        context.bounds.width + controlGap,
        minimumItemWidth + controlGap
      );
      return {
        kind: "interactive-color-legend",
        key: "interactive-color-legend",
        extension: interactiveLegendControlExtension,
        fallbackNodeKey: "legend",
        bounds: context.bounds,
        ariaLabel: options.ariaLabel ?? "Series visibility",
        columns: layout.columns,
        gap: controlGap,
        padding: controlPadding,
        items,
        emptyLabel: options.emptyLabel ?? "No series shown",
        toggle(value) {
          const toggledKey = valueKey(value);
          const nextVisible = context.colors.domain.filter(
            (candidate) => valueKey(candidate) === toggledKey ? !selectedKeys.has(toggledKey) : selectedKeys.has(valueKey(candidate))
          );
          const visible = nextVisible.some(
            (candidate) => valueKey(candidate) === toggledKey
          );
          options.visible.onChange(nextVisible, {
            reason: {
              type: "toggle",
              value,
              visible
            }
          });
        }
      };
    }
  };
}
function assertCategorical(kind) {
  if (kind !== void 0 && kind !== "categorical") {
    throw new TypeError(
      "interactiveColorLegend requires a categorical color scale"
    );
  }
}
function renderStaticFallback(context, isVisible, format, minimumItemWidth) {
  const { bounds, colors, theme } = context;
  const items = resolveCategoricalLegendItems(colors, format);
  const layout = layoutCategoricalLegendItems(
    items.length,
    bounds.width,
    minimumItemWidth
  );
  const children = [];
  items.forEach((item, index) => {
    const column = index % layout.columns;
    const row = Math.floor(index / layout.columns);
    const x = bounds.x + column * layout.itemWidth;
    const y = bounds.y + controlPadding + controlItemHeight / 2 + row * (controlItemHeight + controlGap);
    const visible = isVisible(item.value);
    children.push(
      {
        kind: "dot",
        key: `interactive-legend-dot:${item.key}`,
        x: x + 4,
        y,
        radius: 4,
        style: {
          fill: visible ? item.color : "none",
          stroke: item.color,
          strokeWidth: 1.5,
          opacity: visible ? 1 : 0.58
        }
      },
      {
        kind: "label",
        key: `interactive-legend-label:${item.key}`,
        x: x + 13,
        y,
        text: item.label,
        baseline: "middle",
        fontSize: 11,
        style: {
          fill: theme.foreground,
          fillOpacity: visible ? 0.76 : 0.46
        }
      }
    );
  });
  return {
    kind: "group",
    key: "legend",
    className: "ts-chart__legend ts-chart__legend--interactive-fallback",
    ariaHidden: true,
    children
  };
}
const interactiveLegendControlExtension = {
  id: "interactive-color-legend",
  create: createInteractiveLegendControl
};
function createInteractiveLegendControl({
  container
}) {
  let root;
  let status;
  const buttons = /* @__PURE__ */ new Map();
  return {
    update(nextControl) {
      const control = asInteractiveLegendControl(nextControl);
      const element = ensureRoot(container);
      if (!element.isConnected || element.parentElement !== container) {
        container.append(element);
      }
      element.setAttribute("aria-label", control.ariaLabel);
      element.style.left = `${control.bounds.x}px`;
      element.style.top = `${control.bounds.y}px`;
      element.style.width = `${control.bounds.width}px`;
      element.style.height = `${control.bounds.height}px`;
      element.style.gridTemplateColumns = `repeat(${control.columns}, minmax(0, 1fr))`;
      element.style.gap = `${control.gap}px`;
      element.style.padding = `${control.padding}px 0`;
      const retained = /* @__PURE__ */ new Set();
      for (const item of control.items) {
        retained.add(item.key);
        const button = buttons.get(item.key) ?? createButton(element, item.key);
        buttons.set(item.key, button);
        syncButton(button, item, control);
      }
      for (const [key, button] of buttons) {
        if (retained.has(key)) continue;
        button.remove();
        buttons.delete(key);
      }
      let cursor = element.firstElementChild;
      for (const item of control.items) {
        const button = buttons.get(item.key);
        if (!button) continue;
        if (button !== cursor)
          element.insertBefore(button, cursor ?? status ?? null);
        cursor = button.nextElementSibling;
      }
      if (status && status !== element.lastElementChild) element.append(status);
      const empty = control.items.every((item) => !item.visible);
      if (status) status.textContent = empty ? control.emptyLabel : "";
    },
    contains(target) {
      return Boolean(target && root?.contains(target));
    },
    destroy() {
      root?.remove();
      root = void 0;
      status = void 0;
      buttons.clear();
    }
  };
  function ensureRoot(host) {
    if (root) return root;
    root = host.ownerDocument.createElement("div");
    root.className = "ts-chart__interactive-legend";
    root.setAttribute("role", "group");
    root.style.position = "absolute";
    root.style.boxSizing = "border-box";
    root.style.display = "grid";
    root.style.alignItems = "center";
    root.style.pointerEvents = "auto";
    status = host.ownerDocument.createElement("span");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    visuallyHide(status);
    root.append(status);
    host.append(root);
    return root;
  }
}
function createButton(root, key) {
  const button = root.ownerDocument.createElement("button");
  button.type = "button";
  button.dataset.chartLegendKey = key;
  button.style.boxSizing = "border-box";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.gap = "7px";
  button.style.minWidth = "0";
  button.style.minHeight = `${controlItemHeight}px`;
  button.style.padding = "8px 12px";
  button.style.border = "1px solid color-mix(in srgb, CanvasText 28%, transparent)";
  button.style.borderRadius = "999px";
  button.style.color = "CanvasText";
  button.style.cursor = "pointer";
  button.style.font = "600 13px/1 system-ui, sans-serif";
  button.style.outlineOffset = "3px";
  const swatch = root.ownerDocument.createElement("span");
  swatch.dataset.chartLegendSwatch = "";
  swatch.style.boxSizing = "border-box";
  swatch.style.width = "11px";
  swatch.style.height = "11px";
  swatch.style.flex = "0 0 auto";
  swatch.style.borderRadius = "3px";
  const label = root.ownerDocument.createElement("span");
  label.dataset.chartLegendLabel = "";
  button.append(swatch, label);
  return button;
}
function syncButton(button, item, control) {
  button.dataset.seriesId = String(item.value);
  button.dataset.chartLegendValue = String(item.value);
  button.dataset.visible = String(item.visible);
  button.setAttribute("aria-label", item.ariaLabel);
  button.setAttribute("aria-pressed", String(item.visible));
  button.style.background = item.visible ? "color-mix(in srgb, CanvasText 7%, Canvas)" : "Canvas";
  button.style.textDecoration = item.visible ? "none" : "line-through";
  button.onclick = (event) => {
    control.toggle(item.value);
  };
  const swatch = button.querySelector("[data-chart-legend-swatch]");
  const label = button.querySelector("[data-chart-legend-label]");
  if (swatch) {
    swatch.style.border = `2px solid ${item.color}`;
    swatch.style.background = item.visible ? item.color : "transparent";
  }
  if (label) label.textContent = item.label;
}
function asInteractiveLegendControl(control) {
  if (!("kind" in control) || control.kind !== "interactive-color-legend") {
    throw new TypeError("Expected an interactive color legend control");
  }
  return control;
}
function visuallyHide(element) {
  element.style.position = "absolute";
  element.style.width = "1px";
  element.style.height = "1px";
  element.style.padding = "0";
  element.style.margin = "-1px";
  element.style.overflow = "hidden";
  element.style.clip = "rect(0, 0, 0, 0)";
  element.style.whiteSpace = "nowrap";
  element.style.border = "0";
}
export {
  interactiveColorLegend
};
