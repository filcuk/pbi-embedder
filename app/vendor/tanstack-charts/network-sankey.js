import {
  sankey as createSankey,
  sankeyCenter,
  sankeyJustify,
  sankeyLeft,
  sankeyRight
} from "d3-sankey";
import { resolveCompositeChildMotion } from "./composite-motion-internal.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { resolveNetworkGraph } from "./network-graph-internal.js";
import {
  composeResolvedChildMarks,
  resolvedChildMarkId
} from "./resolved-layout-child.js";
import { valueKey } from "./scales.js";
import { transformValues } from "./transform-internal.js";
function sankeyDiagram(options) {
  const graph = resolveNetworkGraph(
    options.nodes,
    options.links,
    {
      nodeKey: options.nodeKey,
      source: options.source,
      target: options.target
    },
    "sankeyDiagram"
  );
  const values = transformValues(graph.links, options.value);
  values.forEach(
    (value, index) => assertNonnegativeFinite(value, `value at link index ${index}`)
  );
  if (graph.nodes.length > 0 && !values.some((value) => value > 0)) {
    throw new TypeError(
      "sankeyDiagram: a nonempty graph requires at least one positive link value"
    );
  }
  const linkKeys = resolveLinkKeys(
    graph.links,
    graph.sourceKeys,
    graph.targetKeys,
    options.linkKey
  );
  const iterations = options.iterations ?? 6;
  assertNonnegativeInteger(iterations, "iterations");
  const align = options.align ?? "justify";
  const aligner = sankeyAligner(align);
  return createMarkWithScaleValues(({ markIndex }) => {
    const id = options.id ?? `sankey-${markIndex}`;
    let childMotions = /* @__PURE__ */ new Map();
    const motion = (context) => resolveCompositeChildMotion(options.motion, childMotions, context);
    return {
      id,
      channels: {},
      motion,
      resolveLayout: ({ chart }) => {
        const nodeWidth = resolveLayoutNumber(
          options.nodeWidth,
          chart,
          24,
          "nodeWidth",
          true
        );
        const nodePadding = resolveLayoutNumber(
          options.nodePadding,
          chart,
          8,
          "nodePadding",
          false
        );
        const inset = resolveInset(options.inset, chart);
        const extent = {
          x0: chart.x + inset.left,
          y0: chart.y + inset.top,
          x1: chart.x + chart.width - inset.right,
          y1: chart.y + chart.height - inset.bottom
        };
        if (extent.x1 - extent.x0 < nodeWidth) {
          throw new TypeError(
            "sankeyDiagram: inset leaves less horizontal space than nodeWidth"
          );
        }
        if (extent.y1 <= extent.y0) {
          throw new TypeError(
            "sankeyDiagram: inset leaves no vertical layout space"
          );
        }
        const laidOut = graph.nodes.length === 0 ? { nodes: [], links: [] } : createSankey().nodeId((node) => node.key).nodeAlign(
          (node, columnCount) => aligner(
            node,
            columnCount
          )
        ).nodeWidth(nodeWidth).nodePadding(nodePadding).extent([
          [extent.x0, extent.y0],
          [extent.x1, extent.y1]
        ]).iterations(iterations).nodeSort(resolveNodeSort(options.nodeSort)).linkSort(resolveLinkSort(options.linkSort))({
          nodes: graph.nodes.map((data, index) => ({
            data,
            key: graph.nodeKeys[index],
            sourceIndex: index
          })),
          links: graph.links.map((data, index) => ({
            data,
            key: linkKeys[index],
            source: graph.sourceKeys[index],
            target: graph.targetKeys[index],
            value: values[index],
            sourceIndex: index
          }))
        });
        const output = materializeSankey(
          laidOut.nodes,
          laidOut.links,
          graph.nodeIndexes
        );
        const marks = options.marks({ id, chart, ...output });
        if (!Array.isArray(marks) || marks.length === 0) {
          throw new TypeError(
            "sankeyDiagram: marks must return at least one chart mark"
          );
        }
        const children = marks.map(
          (mark, childIndex) => mark.initialize({ markIndex: childIndex })
        );
        const composition = composeResolvedChildMarks(id, children);
        childMotions = new Map(
          children.flatMap((child, childIndex) => {
            const childMotion = child.motion ?? marks[childIndex]?.motion;
            if (childMotion === void 0) return [];
            return [[resolvedChildMarkId(id, child.id), childMotion]];
          })
        );
        return composition;
      }
    };
  }, options.motion);
}
function materializeSankey(workingNodes, workingLinks, nodeIndexes) {
  const incoming = workingNodes.map(
    () => []
  );
  const outgoing = workingNodes.map(
    () => []
  );
  const nodes = workingNodes.map((node, index) => {
    const bounds = resolvedNodeBounds(node, index);
    const key = node.key;
    return {
      kind: "node",
      key,
      data: node.data,
      source: Object.freeze([node.data]),
      sourceIndexes: Object.freeze([node.sourceIndex]),
      index: resolvedInteger(node.index, `node index ${index}`),
      depth: resolvedInteger(node.depth, `node depth ${index}`),
      height: resolvedInteger(node.height, `node height ${index}`),
      layer: resolvedInteger(node.layer, `node layer ${index}`),
      value: resolvedFinite(node.value, `node value ${index}`),
      ...bounds,
      x: (bounds.x0 + bounds.x1) / 2,
      y: (bounds.y0 + bounds.y1) / 2,
      incomingLinks: incoming[index],
      outgoingLinks: outgoing[index]
    };
  });
  const links = workingLinks.map((link, index) => {
    const sourceKey = resolvedWorkingNode(link.source, index, "source").key;
    const targetKey = resolvedWorkingNode(link.target, index, "target").key;
    const sourceIndex = nodeIndexes.get(sourceKey);
    const targetIndex = nodeIndexes.get(targetKey);
    const sourceNode = nodes[sourceIndex];
    const targetNode = nodes[targetIndex];
    return Object.freeze({
      kind: "link",
      key: link.key,
      data: link.data,
      sourceRows: Object.freeze([link.data]),
      sourceIndexes: Object.freeze([link.sourceIndex]),
      source: sourceKey,
      target: targetKey,
      sourceKey,
      targetKey,
      sourceIndex,
      targetIndex,
      sourceNode,
      targetNode,
      value: resolvedFinite(link.value, `link value ${index}`),
      width: resolvedFinite(link.width, `link width ${index}`),
      x1: sourceNode.x1,
      y1: resolvedFinite(link.y0, `link source y ${index}`),
      x2: targetNode.x0,
      y2: resolvedFinite(link.y1, `link target y ${index}`)
    });
  });
  workingNodes.forEach((node, index) => {
    for (const link of node.targetLinks ?? []) {
      incoming[index].push(links[link.sourceIndex]);
    }
    for (const link of node.sourceLinks ?? []) {
      outgoing[index].push(links[link.sourceIndex]);
    }
    Object.freeze(incoming[index]);
    Object.freeze(outgoing[index]);
    Object.freeze(nodes[index]);
  });
  return { nodes: Object.freeze(nodes), links: Object.freeze(links) };
}
function resolveLinkKeys(links, sourceKeys, targetKeys, linkKey) {
  if (linkKey !== void 0) {
    const keys = transformValues(links, linkKey);
    assertUniqueLinkKeys(keys);
    return keys;
  }
  const inferred = links.map(
    (link) => link != null && typeof link === "object" ? link.id : void 0
  );
  if (inferred.every(isChartKey) && new Set(inferred).size === inferred.length) {
    return inferred;
  }
  const occurrences = /* @__PURE__ */ new Map();
  return links.map((_link, index) => {
    const pair = JSON.stringify([
      valueKey(sourceKeys[index]),
      valueKey(targetKeys[index])
    ]);
    const occurrence = occurrences.get(pair) ?? 0;
    occurrences.set(pair, occurrence + 1);
    return `link:${pair}:${occurrence}`;
  });
}
function assertUniqueLinkKeys(keys) {
  const seen = /* @__PURE__ */ new Set();
  keys.forEach((key, index) => {
    if (!isChartKey(key)) {
      throw new TypeError(
        `sankeyDiagram: linkKey at index ${index} must be a string or finite number`
      );
    }
    if (seen.has(key)) {
      throw new TypeError(
        `sankeyDiagram: duplicate link key ${typeof key}:${JSON.stringify(key)}`
      );
    }
    seen.add(key);
  });
}
function resolveNodeSort(sort) {
  if (sort === void 0 || sort === null) return sort;
  return (left, right) => {
    const compared = sort(
      nodeContext(left),
      nodeContext(right)
    );
    assertFinite(compared, "nodeSort result");
    return compared;
  };
}
function resolveLinkSort(sort) {
  if (sort === void 0 || sort === null) return sort;
  return (left, right) => {
    const compared = sort(
      linkContext(left),
      linkContext(right)
    );
    assertFinite(compared, "linkSort result");
    return compared;
  };
}
function nodeContext(node) {
  return {
    ...endpointContext(node),
    depth: resolvedInteger(node.depth, "nodeSort node depth"),
    height: resolvedInteger(node.height, "nodeSort node height"),
    value: resolvedFinite(node.value, "nodeSort node value")
  };
}
function endpointContext(node) {
  return {
    kind: "node",
    key: node.key,
    data: node.data,
    source: [node.data],
    sourceIndexes: [node.sourceIndex],
    index: resolvedInteger(node.index, "node index")
  };
}
function linkContext(link) {
  const source = resolvedWorkingNode(link.source, link.sourceIndex, "source");
  const target = resolvedWorkingNode(link.target, link.sourceIndex, "target");
  return {
    kind: "link",
    key: link.key,
    data: link.data,
    sourceRows: [link.data],
    sourceIndexes: [link.sourceIndex],
    source: source.key,
    target: target.key,
    sourceKey: source.key,
    targetKey: target.key,
    sourceIndex: source.sourceIndex,
    targetIndex: target.sourceIndex,
    sourceNode: endpointContext(source),
    targetNode: endpointContext(target),
    value: link.value
  };
}
function resolvedWorkingNode(endpoint, index, name) {
  if (typeof endpoint === "object") return endpoint;
  throw new TypeError(
    `sankeyDiagram: unresolved ${name} at link index ${index}`
  );
}
function resolvedNodeBounds(node, index) {
  return {
    x0: resolvedFinite(node.x0, `node x0 ${index}`),
    x1: resolvedFinite(node.x1, `node x1 ${index}`),
    y0: resolvedFinite(node.y0, `node y0 ${index}`),
    y1: resolvedFinite(node.y1, `node y1 ${index}`)
  };
}
function sankeyAligner(align) {
  const selected = typeof align === "function" ? align : align === "left" ? sankeyLeft : align === "right" ? sankeyRight : align === "center" ? sankeyCenter : align === "justify" ? sankeyJustify : void 0;
  if (!selected) {
    throw new TypeError(`sankeyDiagram: invalid alignment "${String(align)}"`);
  }
  return (node, columnCount) => {
    const layer = selected(node, columnCount);
    if (!Number.isInteger(layer) || layer < 0 || layer >= columnCount) {
      throw new TypeError(
        `sankeyDiagram: align result must be an integer between 0 and ${columnCount - 1}`
      );
    }
    return layer;
  };
}
function resolveLayoutNumber(value, chart, fallback, name, positive) {
  const resolved = typeof value === "function" ? value(chart) : value;
  const number = resolved ?? fallback;
  if (!Number.isFinite(number) || (positive ? number <= 0 : number < 0)) {
    throw new TypeError(
      `sankeyDiagram: ${name} must be a ${positive ? "positive" : "nonnegative"} finite number`
    );
  }
  return number;
}
function resolveInset(value, chart) {
  const resolved = typeof value === "function" ? value(chart) : value;
  const inset = typeof resolved === "number" ? { top: resolved, right: resolved, bottom: resolved, left: resolved } : {
    top: resolved?.top ?? 0,
    right: resolved?.right ?? 0,
    bottom: resolved?.bottom ?? 0,
    left: resolved?.left ?? 0
  };
  for (const [name, amount] of Object.entries(inset)) {
    assertNonnegativeFinite(amount, `inset.${name}`);
  }
  return inset;
}
function resolvedFinite(value, name) {
  assertFinite(value, name);
  return value;
}
function resolvedInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`sankeyDiagram: layout produced an invalid ${name}`);
  }
  return value;
}
function assertFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`sankeyDiagram: layout produced a non-finite ${name}`);
  }
}
function assertNonnegativeFinite(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `sankeyDiagram: ${name} must be a nonnegative finite number`
    );
  }
}
function assertNonnegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`sankeyDiagram: ${name} must be a nonnegative integer`);
  }
}
function isChartKey(value) {
  return typeof value === "string" || typeof value === "number" && Number.isFinite(value);
}
export {
  sankeyDiagram
};
