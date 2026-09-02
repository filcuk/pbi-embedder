import { resolveCompositeChildMotion } from "./composite-motion-internal.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { valueKey } from "./scales.js";
import { createChartScene } from "./scene.js";
import { chartSceneSource } from "./scene-source.js";
import { embedChartScene, sceneChildId } from "./scene-embed-internal.js";
import {
  fill,
  getViewLayoutMetadataInternal,
  grid,
  inset,
  layer,
  resolveViewLayoutInternal
} from "./view-layout.js";
function shareX(source, target) {
  return viewScaleLink("share", "x", source, target);
}
function shareY(source, target) {
  return viewScaleLink("share", "y", source, target);
}
function alignX(source, target) {
  return viewScaleLink("align", "x", source, target);
}
function alignY(source, target) {
  return viewScaleLink("align", "y", source, target);
}
function viewScaleLink(mode, axis, source, target) {
  const sourceId = source.trim();
  const targetId = target.trim();
  if (!sourceId || !targetId) {
    throw new TypeError(
      "View scale links require nonempty source and target ids"
    );
  }
  return {
    mode,
    axis,
    source: sourceId,
    target: targetId
  };
}
const layoutPassLimit = 4;
const layoutTolerance = 0.25;
function composeViews(options) {
  const id = compositionId(options.id, "composeViews", "view-composition-0");
  const prepared = prepareComposition(
    options.views,
    options.layout,
    options.links ?? [],
    id
  );
  return createViewComposition(id, options.layout, prepared);
}
function viewGrid(options) {
  const id = compositionId(options.id, "viewGrid", "view-grid-0");
  const lowered = lowerViewGrid(options);
  const prepared = prepareComposition(
    lowered.views,
    lowered.layout,
    lowered.links,
    id
  );
  return createViewComposition(id, lowered.layout, prepared);
}
function createViewComposition(id, viewLayout, prepared) {
  const childMotions = /* @__PURE__ */ new Map();
  const mark = createMarkWithScaleValues(
    () => {
      return {
        id,
        channels: {},
        render: ({ chart, theme, layout }) => {
          const resolvedFrames = resolveViewLayoutInternal(viewLayout, chart);
          const frameById = new Map(
            resolvedFrames.map((frame) => [frame.id, frame])
          );
          const bounds = prepared.views.map((view, index) => {
            const frame = frameById.get(view.id);
            if (!frame) {
              throw new TypeError(
                `View composition "${id}" did not resolve child "${view.id}"`
              );
            }
            if (frame.order !== index) {
              throw new TypeError(
                `View composition "${id}" resolved an unstable paint order for child "${view.id}"`
              );
            }
            return frame;
          });
          assertLinkedFrames(id, prepared.views, prepared.links, bounds);
          const definitions = prepared.views.map(
            (view, index) => resolveChildDefinition(view, bounds[index], theme)
          );
          const marginLocks = prepared.views.map(
            () => ({})
          );
          let compiled = compileViews(
            id,
            prepared.views,
            definitions,
            bounds,
            marginLocks,
            layout
          );
          for (let pass = 0; pass < layoutPassLimit; pass += 1) {
            const next = alignedMargins(
              id,
              compiled,
              prepared.alignmentGroups,
              marginLocks
            );
            if (sameMarginLocks(marginLocks, next)) break;
            next.forEach((margin, index) => {
              marginLocks[index] = margin;
            });
            compiled = compileViews(
              id,
              prepared.views,
              definitions,
              bounds,
              marginLocks,
              layout
            );
          }
          assertAlignedRanges(id, compiled, prepared.alignmentGroups);
          assertSharedScales(id, compiled, prepared.links);
          childMotions.clear();
          const points = [];
          const focusGuides = [];
          const children = compiled.map(({ view, bounds: cell, scene }) => {
            collectChildMotions(id, view.id, scene, childMotions);
            const embedded = embedChartScene(scene, {
              ownerId: id,
              childId: view.id,
              x: cell.x,
              y: cell.y
            });
            points.push(
              ...embedded.points
            );
            focusGuides.push(...embedded.focusGuides);
            return {
              kind: "group",
              key: `${sceneChildId(id, view.id)}:view`,
              className: "ts-chart__view",
              translateX: cell.x,
              translateY: cell.y,
              clip: { x: 0, y: 0, width: cell.width, height: cell.height },
              children: embedded.nodes
            };
          });
          return {
            nodes: [
              {
                kind: "group",
                key: id,
                className: "ts-chart__views",
                children
              }
            ],
            points,
            ...focusGuides.length ? { focusGuides } : {}
          };
        }
      };
    },
    (context) => resolveCompositeChildMotion(void 0, childMotions, context)
  );
  return {
    marks: [mark],
    guides: false,
    margin: 0,
    x: null,
    y: null
  };
}
function lowerViewGrid(options) {
  if (!options.views.length) {
    throw new TypeError("viewGrid requires at least one view");
  }
  const views = {};
  const cells = {};
  const items = /* @__PURE__ */ new Map();
  for (const view of options.views) {
    const id = view.id.trim();
    if (!id) throw new TypeError("viewGrid view ids cannot be empty");
    if (items.has(id)) {
      throw new TypeError(`viewGrid contains duplicate view id "${id}"`);
    }
    items.set(id, view);
    views[id] = view.chart;
    cells[id] = { row: view.row, column: view.column };
  }
  const links = [];
  for (const [id, view] of items) {
    for (const axis of ["x", "y"]) {
      const sharedTarget = view.share?.[axis];
      const alignedTarget = view.align?.[axis];
      if (sharedTarget && alignedTarget) {
        throw new TypeError(
          `View "${id}" cannot set both share.${axis} and align.${axis}; sharing already aligns the range`
        );
      }
      const targetId = sharedTarget ?? alignedTarget;
      if (!targetId) continue;
      const target = items.get(targetId);
      if (!target) {
        throw new TypeError(
          `View "${id}" ${sharedTarget ? "share" : "align"}.${axis} references unknown view "${targetId}"`
        );
      }
      if (axis === "x" && view.column !== target.column || axis === "y" && view.row !== target.row) {
        throw new TypeError(
          `View "${id}" can link ${axis} only to a view in the same ${axis === "x" ? "column" : "row"} track`
        );
      }
      links.push({
        source: id,
        target: targetId,
        axis,
        mode: sharedTarget ? "share" : "align"
      });
    }
  }
  return {
    views,
    layout: grid({
      rows: options.rows,
      columns: options.columns,
      cells,
      ...options.gap === void 0 ? {} : { gap: options.gap },
      ...options.rowGap === void 0 ? {} : { rowGap: options.rowGap },
      ...options.columnGap === void 0 ? {} : { columnGap: options.columnGap }
    }),
    links
  };
}
function prepareComposition(definitions, layout, authoredLinks, ownerId) {
  const entries = Object.entries(definitions);
  if (!entries.length) {
    throw new TypeError("composeViews requires at least one named view");
  }
  const byId = /* @__PURE__ */ new Map();
  const namespaces = /* @__PURE__ */ new Map();
  for (const [authoredId, chart] of entries) {
    const id = authoredId.trim();
    if (!id) throw new TypeError("composeViews view ids cannot be empty");
    if (byId.has(id)) {
      throw new TypeError(`composeViews contains duplicate view id "${id}"`);
    }
    assertChildDefinition(id, chart);
    const view = { id, chart };
    byId.set(id, view);
    const namespace = sceneChildId(ownerId, id);
    const existingNamespace = namespaces.get(namespace);
    if (existingNamespace) {
      throw new TypeError(
        `Views "${existingNamespace}" and "${id}" resolve to the same scene namespace "${namespace}"`
      );
    }
    namespaces.set(namespace, id);
  }
  const metadata = getViewLayoutMetadataInternal(layout);
  const placed = /* @__PURE__ */ new Set();
  for (const id of metadata.placed) {
    if (placed.has(id)) {
      throw new TypeError(`View layout places "${id}" more than once`);
    }
    placed.add(id);
    if (!byId.has(id)) {
      throw new TypeError(`View layout places unknown view "${id}"`);
    }
  }
  for (const id of metadata.referenced) {
    if (!byId.has(id)) {
      throw new TypeError(`View layout references unknown view "${id}"`);
    }
  }
  for (const id of byId.keys()) {
    if (!placed.has(id)) {
      throw new TypeError(`View layout does not place named view "${id}"`);
    }
  }
  const views = metadata.placed.map((id) => byId.get(id));
  const links = [];
  const linkedAxes = /* @__PURE__ */ new Set();
  for (const authored of authoredLinks) {
    if (authored.axis !== "x" && authored.axis !== "y") {
      throw new TypeError(
        `View scale link requires axis "x" or "y"; received "${String(authored.axis)}"`
      );
    }
    if (authored.mode !== "share" && authored.mode !== "align") {
      throw new TypeError(
        `View scale link requires mode "share" or "align"; received "${String(authored.mode)}"`
      );
    }
    const source = byId.get(authored.source);
    const target = byId.get(authored.target);
    if (!source || !target) {
      throw new TypeError(
        `View ${authored.mode}.${authored.axis} link references unknown ${source ? "target" : "source"} view "${source ? authored.target : authored.source}"`
      );
    }
    if (source === target) {
      throw new TypeError(
        `View "${source.id}" cannot link its ${authored.axis} range to itself`
      );
    }
    const identity = `${source.id}:${authored.axis}`;
    if (linkedAxes.has(identity)) {
      throw new TypeError(
        `View "${source.id}" has more than one ${authored.axis} scale link`
      );
    }
    linkedAxes.add(identity);
    links.push({
      source,
      target,
      axis: authored.axis,
      shared: authored.mode === "share"
    });
  }
  assertAcyclicLinks(views, links);
  return {
    views,
    links,
    alignmentGroups: {
      x: linkedGroups(views, links, "x"),
      y: linkedGroups(views, links, "y")
    }
  };
}
function compositionId(authored, factory, fallback) {
  const id = authored?.trim() || fallback;
  if (authored !== void 0 && !authored.trim()) {
    throw new TypeError(`${factory} id cannot be empty`);
  }
  return id;
}
function assertChildDefinition(id, definition) {
  if (!definition || typeof definition !== "object" || !("chart" in definition) && !Array.isArray(definition.marks)) {
    throw new TypeError(`View "${id}" requires a chart definition`);
  }
  const hostOptions = [
    "maxFocusDistance",
    "focus",
    "focusRing",
    "cursor",
    "spatialIndex",
    "svgAnimation",
    "keyboard",
    "pointer",
    "selection",
    "controls",
    "tooltip",
    "motion"
  ];
  const hostOption = hostOptions.find(
    (option) => definition[option] !== void 0
  );
  if (hostOption) {
    throw new TypeError(
      `View "${id}" cannot own chart host option "${hostOption}"; configure it on the outer definition`
    );
  }
  if ("chart" in definition) return;
  if (definition.gradients?.length) {
    throw new TypeError(
      `View "${id}" cannot embed gradients until child scene resources can be adopted by the outer scene`
    );
  }
  if (definition.theme?.background !== void 0) {
    throw new TypeError(
      `View "${id}" cannot own a scene background; use an ordinary background mark inside the child definition`
    );
  }
  for (const axis of ["x", "y"]) {
    const configured = definition[axis];
    const presentation = !configured || configured.axis === false ? void 0 : configured.axis ?? {};
    if (presentation?.motion !== void 0 || presentation?.ticks && presentation.ticks.motion !== void 0 || presentation?.tickLabels && presentation.tickLabels.motion !== void 0 || typeof presentation?.label === "object" && presentation.label.motion !== void 0) {
      throw new TypeError(
        `View "${id}" cannot own ${axis}-guide motion; configure guide motion on a non-embedded chart`
      );
    }
  }
}
function resolveChildDefinition(view, frame, theme) {
  const definition = view.chart;
  const resolved = "chart" in definition ? (() => {
    const { chart, ...options } = definition;
    return {
      ...chart({
        width: frame.width,
        height: frame.height,
        defaultTheme: theme
      }),
      ...options
    };
  })() : definition;
  assertChildDefinition(view.id, resolved);
  return mergeTheme(resolved, theme);
}
function compileViews(ownerId, views, definitions, bounds, locks, layout) {
  return views.map((view, index) => {
    const cell = bounds[index];
    try {
      const scene = createChartScene(
        withMarginLocks(definitions[index], locks[index]),
        { width: cell.width, height: cell.height },
        layout
      );
      if (scene.controls?.length) {
        throw new TypeError(
          `View "${view.id}" cannot own host controls; configure controlled behaviors and interactive legends on the outer definition`
        );
      }
      return {
        view,
        bounds: cell,
        scene
      };
    } catch (error) {
      throw new TypeError(
        `View composition "${ownerId}" child "${view.id}" could not compile: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  });
}
function assertLinkedFrames(ownerId, views, links, bounds) {
  const byId = new Map(
    views.map((view, index) => [view.id, bounds[index]])
  );
  for (const link of links) {
    const source = byId.get(link.source.id);
    const target = byId.get(link.target.id);
    const sourceStart = link.axis === "x" ? source.x : source.y;
    const targetStart = link.axis === "x" ? target.x : target.y;
    const sourceSize = link.axis === "x" ? source.width : source.height;
    const targetSize = link.axis === "x" ? target.width : target.height;
    if (Math.abs(sourceStart - targetStart) > layoutTolerance || Math.abs(sourceSize - targetSize) > layoutTolerance) {
      throw new TypeError(
        `View composition "${ownerId}" cannot link ${link.axis} between "${link.source.id}" and "${link.target.id}" because their allocated ${link.axis === "x" ? "horizontal" : "vertical"} frames differ`
      );
    }
  }
}
function withMarginLocks(definition, locks) {
  if (!Object.keys(locks).length) return definition;
  const authored = typeof definition.margin === "number" ? {
    top: definition.margin,
    right: definition.margin,
    bottom: definition.margin,
    left: definition.margin
  } : definition.margin ?? {};
  return { ...definition, margin: { ...authored, ...locks } };
}
function alignedMargins(ownerId, compiled, groups, current) {
  const next = current.map((margin) => ({ ...margin }));
  for (const indexes of groups.x) {
    const left = Math.max(
      ...indexes.map(
        (index) => compiled[index].bounds.x + compiled[index].scene.chart.x
      )
    );
    const right = Math.min(
      ...indexes.map((index) => {
        const entry = compiled[index];
        return entry.bounds.x + entry.scene.chart.x + entry.scene.chart.width;
      })
    );
    if (right - left < 1) {
      throw new TypeError(
        `View composition "${ownerId}" cannot align x ranges because linked margins leave no shared plot width`
      );
    }
    for (const index of indexes) {
      const entry = compiled[index];
      next[index].left = Math.max(0, left - entry.bounds.x);
      next[index].right = Math.max(
        0,
        entry.bounds.x + entry.bounds.width - right
      );
    }
  }
  for (const indexes of groups.y) {
    const top = Math.max(
      ...indexes.map(
        (index) => compiled[index].bounds.y + compiled[index].scene.chart.y
      )
    );
    const bottom = Math.min(
      ...indexes.map((index) => {
        const entry = compiled[index];
        return entry.bounds.y + entry.scene.chart.y + entry.scene.chart.height;
      })
    );
    if (bottom - top < 1) {
      throw new TypeError(
        `View composition "${ownerId}" cannot align y ranges because linked margins leave no shared plot height`
      );
    }
    for (const index of indexes) {
      const entry = compiled[index];
      next[index].top = Math.max(0, top - entry.bounds.y);
      next[index].bottom = Math.max(
        0,
        entry.bounds.y + entry.bounds.height - bottom
      );
    }
  }
  return next;
}
function assertAlignedRanges(ownerId, compiled, groups) {
  for (const axis of ["x", "y"]) {
    for (const indexes of groups[axis]) {
      const first = globalPlotRange(compiled[indexes[0]], axis);
      for (const index of indexes.slice(1)) {
        const current = globalPlotRange(compiled[index], axis);
        if (Math.abs(first[0] - current[0]) > layoutTolerance || Math.abs(first[1] - current[1]) > layoutTolerance) {
          throw new TypeError(
            `View composition "${ownerId}" could not converge linked ${axis} plot ranges`
          );
        }
      }
    }
  }
}
function assertSharedScales(ownerId, compiled, links) {
  const byId = new Map(compiled.map((entry) => [entry.view.id, entry]));
  for (const link of links) {
    if (!link.shared) continue;
    const source = byId.get(link.source.id);
    const target = byId.get(link.target.id);
    const left = source.scene.scales[link.axis];
    const right = target.scene.scales[link.axis];
    const reason = incompatibleScaleReason(
      source,
      target,
      link.axis,
      left,
      right
    );
    if (reason) {
      throw new TypeError(
        `View composition "${ownerId}" child "${source.view.id}" cannot share ${link.axis} with "${target.view.id}": ${reason}`
      );
    }
  }
}
function incompatibleScaleReason(leftView, rightView, axis, left, right) {
  if (!left.domain.length || !right.domain.length) {
    return "both views must configure and materialize that scale";
  }
  if (left.type !== right.type) {
    return `resolved scale types differ (${left.type} versus ${right.type})`;
  }
  if (!sameValues(left.domain, right.domain)) {
    return "resolved domains differ; configure one explicit shared domain";
  }
  if (Math.abs(left.bandwidth - right.bandwidth) > layoutTolerance) {
    return "resolved bandwidths differ";
  }
  for (const value of scaleProbes(left, right)) {
    const leftPosition = globalScalePosition(leftView, axis, left, value);
    const rightPosition = globalScalePosition(rightView, axis, right, value);
    if (Number.isFinite(leftPosition) && Number.isFinite(rightPosition) && Math.abs(leftPosition - rightPosition) > layoutTolerance) {
      return `resolved mappings differ at ${String(value)}`;
    }
  }
  return void 0;
}
function scaleProbes(left, right) {
  const values = [
    ...left.domain,
    ...left.ticks.map((tick) => tick.value),
    ...right.ticks.map((tick) => tick.value)
  ];
  const first = left.domain[0];
  const last = left.domain.at(-1);
  if (typeof first === "number" && typeof last === "number") {
    for (const ratio of [0.25, 0.5, 0.75]) {
      values.push(first + (last - first) * ratio);
    }
  } else if (first instanceof Date && last instanceof Date) {
    for (const ratio of [0.25, 0.5, 0.75]) {
      values.push(
        new Date(first.getTime() + (last.getTime() - first.getTime()) * ratio)
      );
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return values.filter((value) => {
    const key = valueKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function globalScalePosition(view, axis, scale, value) {
  return (axis === "x" ? view.bounds.x : view.bounds.y) + scale.map(value);
}
function globalPlotRange(entry, axis) {
  return axis === "x" ? [
    entry.bounds.x + entry.scene.chart.x,
    entry.bounds.x + entry.scene.chart.x + entry.scene.chart.width
  ] : [
    entry.bounds.y + entry.scene.chart.y,
    entry.bounds.y + entry.scene.chart.y + entry.scene.chart.height
  ];
}
function linkedGroups(views, links, axis) {
  const parents = views.map((_view, index) => index);
  const find = (index) => {
    while (parents[index] !== index) {
      parents[index] = parents[parents[index]];
      index = parents[index];
    }
    return index;
  };
  const join = (left, right) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };
  const indexById = new Map(views.map((view, index) => [view.id, index]));
  for (const link of links) {
    if (link.axis !== axis) continue;
    join(indexById.get(link.source.id), indexById.get(link.target.id));
  }
  const groups = /* @__PURE__ */ new Map();
  views.forEach((_view, index) => {
    const root = find(index);
    const group = groups.get(root);
    if (group) group.push(index);
    else groups.set(root, [index]);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}
function assertAcyclicLinks(views, links) {
  for (const axis of ["x", "y"]) {
    const targetBySource = new Map(
      links.filter((link) => link.axis === axis).map((link) => [link.source.id, link.target.id])
    );
    const complete = /* @__PURE__ */ new Set();
    const active = /* @__PURE__ */ new Set();
    const visit = (id) => {
      if (complete.has(id)) return;
      if (active.has(id)) {
        throw new TypeError(
          `View composition contains a cycle in ${axis} links at "${id}"`
        );
      }
      active.add(id);
      const target = targetBySource.get(id);
      if (target) visit(target);
      active.delete(id);
      complete.add(id);
    };
    views.forEach((view) => visit(view.id));
  }
}
function collectChildMotions(ownerId, viewId, scene, motions) {
  const source = scene[chartSceneSource];
  if (!source) return;
  const [definition, initialized] = source;
  const viewNamespace = sceneChildId(ownerId, viewId);
  initialized.forEach((mark, index) => {
    const motion = mark.motion ?? definition.marks[index]?.motion;
    if (motion !== void 0) {
      motions.set(sceneChildId(viewNamespace, mark.id), motion);
    }
  });
}
function mergeTheme(definition, theme) {
  return {
    ...definition,
    theme: {
      ...theme,
      ...definition.theme,
      palette: definition.theme?.palette ?? theme.palette
    }
  };
}
function sameMarginLocks(left, right) {
  return left.every((margin, index) => {
    const candidate = right[index];
    return ["top", "right", "bottom", "left"].every(
      (side) => margin[side] === candidate[side] || Math.abs((margin[side] ?? 0) - (candidate[side] ?? 0)) <= layoutTolerance
    );
  });
}
function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => valueKey(value) === valueKey(right[index]));
}
export {
  alignX,
  alignY,
  composeViews,
  fill,
  grid,
  inset,
  layer,
  shareX,
  shareY,
  viewGrid
};
