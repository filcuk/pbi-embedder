import {
  createScenePointLookup,
  sceneNodeOwnedPoints
} from "./scene-point-ownership-internal.js";
import { matchesFocusAnchor } from "./focus-layer.js";
function resolveMarkStateScene(scene, focus, pointer = null) {
  if (!focus || !sceneHasMarkStates(scene.nodes)) return { scene };
  let transition;
  const transitions = {};
  const visit = (nodes2, inheritedPoints, definitions, data, inheritedLookup) => nodes2.map((node) => {
    const state = node.kind === "group" ? node.states : void 0;
    const points = state?.points ?? inheritedPoints;
    const nodeDefinitions = state?.definitions ?? definitions;
    const nodeData = state?.data ?? data;
    const lookup = state ? createScenePointLookup(state.points) : inheritedLookup;
    const candidates = points ? lookup ? sceneNodeOwnedPoints(node, points, lookup) : points : emptyPoints;
    const resolved = node.kind !== "group" && nodeDefinitions && nodeData && candidates.length ? resolveNodeState(
      node,
      candidates,
      nodeData,
      nodeDefinitions,
      focus,
      pointer
    ) : { node };
    if (resolved.transition) {
      transition = mergeTransition(transition, resolved.transition);
      for (const point of candidates) {
        transitions[point.markId] = mergeTransition(
          transitions[point.markId],
          resolved.transition
        );
      }
    }
    const next = resolved.node;
    return next.kind === "group" ? {
      ...next,
      children: visit(
        next.children,
        candidates.length ? candidates : points,
        nodeDefinitions,
        nodeData,
        lookup
      )
    } : next;
  });
  const nodes = visit(scene.nodes);
  return {
    scene: { ...scene, nodes },
    transition,
    ...Object.keys(transitions).length ? { transitions } : {}
  };
}
function sceneHasMarkStates(nodes) {
  return nodes.some(
    (node) => node.kind === "group" && (node.states !== void 0 || sceneHasMarkStates(node.children))
  );
}
function resolveNodeState(node, candidates, data, definitions, focus, pointer) {
  let output = node;
  let transition;
  for (const definition of definitions) {
    const context = matchingContext(
      candidates,
      data,
      definition,
      focus,
      pointer
    );
    if (!context) continue;
    output = applyStateStyle(output, definition.style, context);
    if (definition.transition) {
      transition = mergeTransition(transition, definition.transition);
    }
  }
  return { node: output, transition };
}
function matchingContext(candidates, data, definition, focus, pointer) {
  if (typeof definition.when !== "function" && definition.when.focus === "unmatched" && candidates.some((point) => matchesFocusAnchor(point, focus, "group"))) {
    return void 0;
  }
  for (const point of candidates) {
    const context = {
      datum: point.datum,
      index: point.datumIndex,
      data,
      point,
      focus,
      pointer,
      matches: (match) => matchesFocusAnchor(point, focus, match)
    };
    const matches = typeof definition.when === "function" ? definition.when(context) : matchesSelector(definition.when, context);
    if (matches) return context;
  }
  return void 0;
}
function matchesSelector(selector, context) {
  const source = selector.source;
  if (source !== void 0 && !(Array.isArray(source) ? source.includes(context.focus.source) : source === context.focus.source)) {
    return false;
  }
  if (selector.pinned !== void 0 && selector.pinned !== context.focus.pinned) {
    return false;
  }
  return selector.focus === "unmatched" ? !context.matches("group") : context.matches(selector.focus);
}
function applyStateStyle(node, definition, context) {
  const style = { ...node.style };
  for (const property of styleProperties) {
    const value = resolveValue(definition[property], context);
    if (value !== void 0)
      style[property] = value;
  }
  let output = { ...node, style };
  const dx = resolveValue(definition.dx, context) ?? 0;
  const dy = resolveValue(definition.dy, context) ?? 0;
  const r = resolveValue(definition.r, context);
  const radius = resolveValue(definition.radius, context);
  const inset = resolveValue(definition.inset, context);
  const fontSize = resolveValue(definition.fontSize, context);
  const fontWeight = resolveValue(definition.fontWeight, context);
  const rotate = resolveValue(definition.rotate, context);
  switch (output.kind) {
    case "dot":
      output = {
        ...output,
        x: output.x + dx,
        y: output.y + dy,
        radius: r ?? output.radius
      };
      break;
    case "rect": {
      const currentInset = output.inset ?? 0;
      let nextInset = Math.max(0, inset ?? currentInset);
      if (Number.isFinite(output.maxThickness) && (output.insetAxis === "x" || output.insetAxis === "y")) {
        const currentThickness = output.insetAxis === "x" ? output.width : output.height;
        const bandThickness = currentThickness + currentInset * 2;
        const requestedThickness = Math.max(0, bandThickness - nextInset * 2);
        const cappedThickness = Math.min(
          requestedThickness,
          Math.max(0, output.maxThickness)
        );
        nextInset = (bandThickness - cappedThickness) / 2;
      }
      const amount = nextInset - currentInset;
      const insetX = output.insetAxis !== "y" ? amount : 0;
      const insetY = output.insetAxis !== "x" ? amount : 0;
      output = {
        ...output,
        x: output.x + insetX + dx,
        y: output.y + insetY + dy,
        width: Math.max(0, output.width - insetX * 2),
        height: Math.max(0, output.height - insetY * 2),
        radius: radius ?? output.radius,
        inset: nextInset
      };
      break;
    }
    case "label":
      output = {
        ...output,
        x: output.x + dx,
        y: output.y + dy,
        fontSize: fontSize ?? output.fontSize,
        fontWeight: fontWeight ?? output.fontWeight,
        rotate: rotate ?? output.rotate
      };
      break;
  }
  return output;
}
const styleProperties = [
  "fill",
  "fillOpacity",
  "stroke",
  "strokeOpacity",
  "strokeWidth",
  "opacity",
  "strokeDasharray"
];
function resolveValue(value, context) {
  return typeof value === "function" ? value(context) : value;
}
const emptyPoints = [];
function mergeTransition(current, next) {
  if (!current || current.type !== next.type) return next;
  if (current.type === "spring" && next.type === "spring") {
    return { ...current, ...next };
  }
  if (current.type !== "tween" || next.type !== "tween") return next;
  return {
    ...current,
    ...next,
    duration: Math.max(current.duration ?? 250, next.duration ?? 250)
  };
}
export {
  resolveMarkStateScene,
  sceneHasMarkStates
};
