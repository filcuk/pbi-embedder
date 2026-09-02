import { tree } from "d3-hierarchy";
import {
  buildFlatHierarchy,
  flatHierarchyNodeContext
} from "./hierarchy-flat-internal.js";
function treeLayout(source, options) {
  const orientation = options.orientation ?? "left";
  assertOrientation(orientation);
  const [breadth, depth] = options.nodeSize ?? [1, 1];
  assertPositiveFinite(breadth, "nodeSize breadth");
  assertPositiveFinite(depth, "nodeSize depth");
  const hierarchy = buildFlatHierarchy(
    source,
    options,
    "treeLayout"
  );
  const contexts = /* @__PURE__ */ new WeakMap();
  const context = (node) => {
    const existing = contexts.get(node);
    if (existing) return existing;
    const created = Object.freeze(nodeContext(node));
    contexts.set(node, created);
    return created;
  };
  const sort = options.sort;
  if (sort) {
    hierarchy.root.sort((left, right) => {
      const compared = sort(
        context(left),
        context(right)
      );
      assertFinite(compared, "sort result");
      return compared;
    });
  }
  const layout = tree().nodeSize([breadth, depth]);
  const separation = options.separation;
  if (separation) {
    layout.separation((left, right) => {
      const separated = separation(
        context(left),
        context(right)
      );
      assertNonnegativeFinite(separated, "separation result");
      return separated;
    });
  }
  const root = layout(hierarchy.root);
  const outputByNode = /* @__PURE__ */ new Map();
  const nodes = root.descendants().map((node) => {
    const [x, y] = orient(node.x, node.y, orientation);
    const output = {
      ...context(node),
      x,
      y
    };
    outputByNode.set(node, output);
    return output;
  });
  const links = root.links().map(({ source: sourceNode, target: targetNode }) => {
    const source2 = outputByNode.get(
      sourceNode
    );
    const target = outputByNode.get(
      targetNode
    );
    const sourceIndex = sourceNode.data.sourceIndex;
    const targetIndex = targetNode.data.sourceIndex;
    return {
      id: target.id,
      source: source2.id,
      target: target.id,
      data: target.data,
      sourceNode: source2,
      targetNode: target,
      sourceIndex,
      targetIndex,
      sourceRows: target.source,
      sourceIndexes: target.sourceIndexes,
      x1: source2.x,
      y1: source2.y,
      x2: target.x,
      y2: target.y
    };
  });
  return { nodes, links };
}
function nodeContext(node) {
  return flatHierarchyNodeContext(node);
}
function orient(breadth, depth, orientation) {
  switch (orientation) {
    case "left":
      return [depth, -breadth];
    case "right":
      return [-depth, -breadth];
    case "top":
      return [breadth, -depth];
    case "bottom":
      return [breadth, depth];
  }
}
function assertOrientation(value) {
  if (value !== "left" && value !== "right" && value !== "top" && value !== "bottom") {
    throw new TypeError(`treeLayout: invalid orientation "${value}"`);
  }
}
function assertPositiveFinite(value, description) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(
      `treeLayout: ${description} must be positive and finite`
    );
  }
}
function assertNonnegativeFinite(value, description) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(
      `treeLayout: ${description} must be nonnegative and finite`
    );
  }
}
function assertFinite(value, description) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`treeLayout: ${description} must be finite`);
  }
}
export {
  treeLayout
};
