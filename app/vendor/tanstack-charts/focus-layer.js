import { valueKey } from "./scales.js";
import {
  createScenePointLookup,
  sceneNodeOwnedPoints
} from "./scene-point-ownership-internal.js";
const emptyPoints = [];
function resolveFocusPresentation(scene, focus, pointer, cursor) {
  const focusedScene = resolveFocusScene(scene, focus).scene;
  const focusedUnder = focusedSceneNodes(focusedScene, focus, "under");
  const focusedOver = focusedSceneNodes(focusedScene, focus, "over");
  const guides = resolveFocusGuides(scene, focus, pointer, cursor);
  return {
    under: [...guides.under, ...focusedUnder],
    over: [...focusedOver, ...guides.over]
  };
}
function resolveFocusGuides(scene, focus, pointer, cursor) {
  const under = [];
  const over = [];
  if (!cursor && !focus) return { under, over };
  for (const guide of scene.focusGuides ?? []) {
    const localFocus = focus && guideOwnsFocus(guide, focus) ? focus : null;
    if (!cursor && focus && !localFocus) continue;
    const node = guide.resolve({
      scene,
      guide,
      focus: localFocus,
      pointer,
      cursor
    });
    if (!node) continue;
    (guide.placement === "under" ? under : over).push(node);
  }
  return { under, over };
}
function resolveFocusScene(scene, focus) {
  if (!focus) return { scene, retargeted: false };
  let retargeted = false;
  const visit = (nodes2) => nodes2.map((node) => {
    if (node.kind !== "group") return node;
    if (node.focus?.retarget) {
      const points = node.focus.points.filter(
        (point) => matchesFocusAnchor(point, focus, node.focus.match)
      );
      const lookup = createScenePointLookup(node.focus.points);
      const selected = stabilizeSelectedNodes(
        filterNodesWithLookup(
          node.focus.candidates ?? node.children,
          points,
          node.focus.points,
          lookup
        ),
        points,
        node.focus.points,
        lookup,
        node.key
      );
      if (!selected.length) return node;
      retargeted = true;
      return {
        ...node,
        focus: { ...node.focus, activePoints: points },
        children: selected
      };
    }
    const children = visit(node.children);
    return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node;
  });
  const nodes = visit(scene.nodes);
  return retargeted ? { scene: { ...scene, nodes }, retargeted } : { scene, retargeted };
}
function focusedSceneNodes(scene, focus, placement) {
  if (!focus) return [];
  return collectFocusedNodes(scene.nodes, focus, placement);
}
function focusedNodeKeys(layer, focus) {
  if (!layer.focus || !focus) return /* @__PURE__ */ new Set();
  const keys = /* @__PURE__ */ new Set();
  visitNodes(selectedFocusChildren(layer, focus), (node) => keys.add(node.key));
  return keys;
}
function collectFocusedNodes(nodes, focus, placement) {
  const output = [];
  for (const node of nodes) {
    if (node.kind !== "group") continue;
    if (node.focus) {
      if (node.focus.placement !== placement) continue;
      const children2 = selectedFocusChildren(node, focus);
      if (children2.length) output.push({ ...node, focus: void 0, children: children2 });
      continue;
    }
    const children = collectFocusedNodes(node.children, focus, placement);
    if (children.length) output.push({ ...node, children });
  }
  return output;
}
function selectedFocusChildren(layer, focus) {
  const state = layer.focus;
  if (state.retarget) return layer.children;
  if (state.anchors) {
    const anchors = state.anchors.filter(
      (anchor) => matchesFocusAnchor(anchor, focus, state.match)
    );
    return filterNodesByAnchors(layer.children, anchors);
  }
  const points = state.points.filter(
    (point) => matchesFocusAnchor(point, focus, state.match)
  );
  return filterNodes(layer.children, points, state.points);
}
function filterNodes(nodes, selectedPoints, candidatePoints) {
  return filterNodesWithLookup(
    nodes,
    selectedPoints,
    candidatePoints,
    createScenePointLookup(candidatePoints)
  );
}
function filterNodesByAnchors(nodes, anchors) {
  const output = [];
  for (const node of nodes) {
    if (node.kind !== "group") {
      if (anchors.some((anchor) => keysRelate(node.key, anchor.key))) {
        output.push(node);
      }
      continue;
    }
    const children = filterNodesByAnchors(node.children, anchors);
    if (children.length) {
      output.push({ ...node, children });
    } else if (anchors.some((anchor) => anchor.key.startsWith(`${node.key}:`))) {
      output.push(node);
    }
  }
  return output;
}
function filterNodesWithLookup(nodes, selectedPoints, candidatePoints, lookup) {
  const output = [];
  for (const node of nodes) {
    if (node.kind !== "group") {
      if (sceneNodeOwnedPoints(node, candidatePoints, lookup, emptyPoints).some(
        (point) => selectedPoints.includes(point)
      )) {
        output.push(node);
      }
      continue;
    }
    const structuralPoint = focusCandidatePoint(node, candidatePoints);
    if (structuralPoint) {
      if (selectedPoints.includes(structuralPoint)) output.push(node);
      continue;
    }
    const atomicPoints = atomicGroupPoints(node, candidatePoints, lookup);
    if (atomicPoints.length) {
      if (atomicPoints.some((point) => selectedPoints.includes(point))) {
        output.push(node);
      }
      continue;
    }
    const structuralPoints = sceneNodeOwnedPoints(
      node,
      candidatePoints,
      lookup,
      emptyPoints
    );
    const childPoints = structuralPoints.length ? structuralPoints : candidatePoints;
    const children = filterNodesWithLookup(
      node.children,
      selectedPoints,
      childPoints,
      lookup
    );
    if (children.length) {
      output.push({ ...node, children });
    }
  }
  return output;
}
function stabilizeSelectedNodes(nodes, points, candidatePoints, lookup, layerKey) {
  const slots = new Map(points.map((point, index) => [point, index]));
  const visit = (node, path) => {
    const related = sceneNodeOwnedPoints(
      node,
      candidatePoints,
      lookup,
      emptyPoints
    ).filter((point2) => slots.has(point2));
    const point = related.length === 1 ? related[0] : void 0;
    let key = node.key;
    if (point && node.key !== point.markId) {
      const slot = `${layerKey}:selection:${slots.get(point) ?? 0}`;
      if (node.key === point.key) key = slot;
      else if (node.key.startsWith(`${point.key}:`)) {
        key = `${slot}${node.key.slice(point.key.length)}`;
      } else if (point.key.startsWith(`${node.key}:`)) {
        key = `${slot}:ancestor:${path}`;
      } else {
        key = `${slot}:node:${path}`;
      }
    }
    return node.kind === "group" ? {
      ...node,
      key,
      children: node.children.map(
        (child, index) => visit(child, `${path}:${index}`)
      )
    } : { ...node, key };
  };
  return nodes.map((node, index) => visit(node, String(index)));
}
function atomicGroupPoints(node, candidatePoints, lookup) {
  const candidate = focusCandidatePoint(node, candidatePoints);
  if (candidate) return [candidate];
  if (node.pointOwner) {
    const owned = sceneNodeOwnedPoints(
      node,
      candidatePoints,
      lookup,
      emptyPoints
    );
    if (owned.length) return owned;
  }
  const exact = lookup.keys.get(node.key)?.filter((point) => point.key === node.key);
  return exact === void 0 ? emptyPoints : exact.filter((point) => candidatePoints.includes(point));
}
function focusCandidatePoint(node, candidatePoints) {
  const index = node.focusCandidateIndex;
  if (index === void 0 || !Number.isInteger(index) || index < 0) {
    return void 0;
  }
  return candidatePoints[index];
}
function matchesFocusAnchor(candidate, focus, match) {
  if (match === "x") {
    return candidate.xValue !== void 0 && sameValue(candidate.xValue, focus.primary.xValue);
  }
  if (match === "y") {
    return candidate.yValue !== void 0 && sameValue(candidate.yValue, focus.primary.yValue);
  }
  if (match === "series") {
    return sameValue(candidate.group, focus.primary.group);
  }
  if (match === "key") {
    return candidate.key === focus.primary.key || candidate.datum === focus.primary.datum;
  }
  if (match === "group") {
    return focus.group.some((point) => sameFocusedPoint(candidate, point));
  }
  return sameFocusedPoint(candidate, focus.primary);
}
const matchesFocusPoint = matchesFocusAnchor;
function sameFocusedPoint(left, right) {
  if (left === right || left.key === right.key) return true;
  if (!Object.is(left.datum, right.datum)) return false;
  return isReference(left.datum) || left.datumIndex === right.datumIndex;
}
function keysRelate(left, right) {
  return left === right || left.startsWith(`${right}:`) || right.startsWith(`${left}:`);
}
function sameValue(left, right) {
  return valueKey(left) === valueKey(right);
}
function isReference(value) {
  return typeof value === "object" && value !== null || typeof value === "function";
}
function visitNodes(nodes, visit) {
  for (const node of nodes) {
    visit(node);
    if (node.kind === "group") visitNodes(node.children, visit);
  }
}
function guideOwnsFocus(guide, focus) {
  return guide.scope === void 0 || focus.primary.key === guide.scope || focus.primary.key.startsWith(`${guide.scope}:`);
}
export {
  focusedNodeKeys,
  focusedSceneNodes,
  matchesFocusAnchor,
  matchesFocusPoint,
  resolveFocusGuides,
  resolveFocusPresentation,
  resolveFocusScene
};
