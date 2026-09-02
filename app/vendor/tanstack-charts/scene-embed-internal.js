import { sceneChildId } from "./scene-child-id-internal.js";
import { sceneChildId as sceneChildId2 } from "./scene-child-id-internal.js";
function embedChartScene(scene, options) {
  const namespace = childNamespace(options.ownerId, options.childId);
  const pointMap = /* @__PURE__ */ new Map();
  const mapPoint = (point) => {
    const existing = pointMap.get(point);
    if (existing) return existing;
    const mapped = {
      ...point,
      key: namespace.identity(point.key),
      markId: namespace.identity(point.markId),
      x: point.x + options.x,
      y: point.y + options.y
    };
    pointMap.set(point, mapped);
    return mapped;
  };
  const mapFocusAnchor = (anchor) => pointMap.get(anchor) ?? {
    ...anchor,
    key: namespace.identity(anchor.key),
    markId: namespace.identity(anchor.markId)
  };
  const points = scene.points.map(mapPoint);
  return {
    nodes: mapScenePoints(
      withoutDefaultFocusLayers(scene.nodes),
      mapPoint,
      mapFocusAnchor,
      namespace
    ),
    points,
    focusGuides: (scene.focusGuides ?? []).map((guide) => ({
      ...guide,
      key: namespace.identity(guide.key),
      markId: namespace.identity(guide.markId),
      chart: offsetBounds(guide.chart, options.x, options.y),
      surface: offsetBounds(guide.surface, options.x, options.y),
      projectX: guide.projectX ? (value) => offsetProjection(guide.projectX(value), options.x) : void 0,
      projectY: guide.projectY ? (value) => offsetProjection(guide.projectY(value), options.y) : void 0,
      scope: guide.scope ? namespace.identity(guide.scope) : namespace.prefix
    }))
  };
}
function offsetProjection(value, offset) {
  return value === void 0 ? void 0 : value + offset;
}
function offsetBounds(bounds, x, y) {
  return { ...bounds, x: bounds.x + x, y: bounds.y + y };
}
function childNamespace(ownerId, childId) {
  const prefix = sceneChildId(ownerId, childId);
  return {
    prefix,
    identity: (value) => {
      if (value === childId) return prefix;
      if (value.startsWith(`${childId}:`)) {
        return `${prefix}${value.slice(childId.length)}`;
      }
      if (value === prefix || value.startsWith(`${prefix}:`)) return value;
      return `${prefix}:${value}`;
    }
  };
}
function withoutDefaultFocusLayers(nodes) {
  return nodes.flatMap((node) => {
    if (node.kind !== "group") return [node];
    if (node.focus && node.className?.includes("ts-chart__focus-layer--default")) {
      return [];
    }
    return [
      {
        ...node,
        children: withoutDefaultFocusLayers(node.children)
      }
    ];
  });
}
function mapScenePoints(nodes, mapPoint, mapFocusAnchor, namespace, prefixKeys = false) {
  return nodes.map((node) => {
    const shouldPrefixKeys = prefixKeys || node.kind === "group" && (node.focus !== void 0 || node.className === "ts-chart__marks");
    const key = shouldPrefixKeys ? namespace.identity(node.key) : node.key;
    if (node.kind === "group") {
      return {
        ...node,
        key,
        ...node.pointOwner ? { pointOwner: mapPoint(node.pointOwner) } : {},
        children: mapScenePoints(
          node.children,
          mapPoint,
          mapFocusAnchor,
          namespace,
          shouldPrefixKeys
        ),
        ...node.focus ? {
          focus: {
            ...node.focus,
            points: node.focus.points.map(mapPoint),
            anchors: (node.focus.anchors ?? node.focus.points).map(
              mapFocusAnchor
            ),
            ...node.focus.candidates ? {
              candidates: mapScenePoints(
                node.focus.candidates,
                mapPoint,
                mapFocusAnchor,
                namespace,
                shouldPrefixKeys
              )
            } : {},
            ...node.focus.activePoints ? { activePoints: node.focus.activePoints.map(mapPoint) } : {}
          }
        } : {},
        ...node.states ? {
          states: {
            ...node.states,
            points: node.states.points.map(mapPoint)
          }
        } : {}
      };
    }
    if (node.kind === "label" || !node.interaction) {
      if (!shouldPrefixKeys && !node.pointOwner) return node;
      return {
        ...node,
        key,
        ...node.pointOwner ? { pointOwner: mapPoint(node.pointOwner) } : {}
      };
    }
    return {
      ...node,
      key,
      ...node.pointOwner ? { pointOwner: mapPoint(node.pointOwner) } : {},
      interaction: node.interaction.point ? { ...node.interaction, point: mapPoint(node.interaction.point) } : {
        ...node.interaction,
        points: node.interaction.points.map(mapPoint)
      }
    };
  });
}
export {
  embedChartScene,
  sceneChildId2 as sceneChildId
};
