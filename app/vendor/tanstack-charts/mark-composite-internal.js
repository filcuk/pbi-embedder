import { resolveCompositeChildMotion } from "./composite-motion-internal.js";
import { sceneChildId } from "./scene-child-id-internal.js";
import {
  createScenePointLookup,
  sceneNodeOwnedPoints
} from "./scene-point-ownership-internal.js";
function composeInitializedMarks(parentId, children, options) {
  validateChildren(parentId, children, options.owner);
  const channels = mergeChildChannels(parentId, children, options);
  const scales = options.coordinates === "pixel" ? resolvedPixelScales(children) : void 0;
  const labels = children.flatMap(
    (child, childIndex) => child.layoutLabels ? [{ child, childIndex }] : []
  );
  const childMotions = new Map(
    children.flatMap(
      (child) => child.motion === void 0 ? [] : [[compositeChildMarkId(parentId, child.id), child.motion]]
    )
  );
  return {
    channels,
    ...children.some((child) => child.seriesFromColor) ? { seriesFromColor: true } : {},
    childMotions,
    ...labels.length ? {
      layoutLabels: (context) => labels.flatMap(({ child, childIndex }) => {
        const namespace = childNamespace(parentId, child.id);
        return child.layoutLabels(
          childContext(context, scales, childIndex)
        ).map((label) => namespaceLabel(label, namespace));
      })
    } : {},
    render: (context) => {
      const nodes = [];
      const points = [];
      const firstBaseMarkIndex = children.findIndex((child) => !child.focus);
      children.forEach((child, childIndex) => {
        const rendered = child.render(childContext(context, scales, childIndex));
        const childPoints = collectRenderedPoints(rendered);
        const namespace = childNamespace(parentId, child.id);
        const namespaced = namespaceScene(
          rendered.nodes,
          childPoints,
          namespace
        );
        const interactive = options.interactiveChildren === void 0 || options.interactiveChildren.has(child.id);
        const childNodes = interactive ? namespaced.nodes : stripSceneInteractions(namespaced.nodes, namespaced.points);
        if (!interactive) {
          nodes.push(...childNodes);
          return;
        }
        if (child.focus) {
          const retarget = child.focus.retarget === true;
          nodes.push({
            kind: "group",
            key: `${namespace.prefix}:focus`,
            className: "ts-chart__focus-layer",
            ariaHidden: true,
            focus: {
              match: child.focus.match ?? "primary",
              points: namespaced.points,
              placement: firstBaseMarkIndex < 0 || childIndex < firstBaseMarkIndex ? "under" : "over",
              ...retarget ? { retarget: true, candidates: namespaced.nodes } : {}
            },
            children: retarget ? [] : childNodes
          });
          return;
        }
        if (child.states) {
          nodes.push({
            kind: "group",
            key: `${namespace.prefix}:states`,
            children: childNodes,
            states: {
              data: child.states.data,
              definitions: child.states.definitions,
              points: namespaced.points
            }
          });
        } else {
          nodes.push(...childNodes);
        }
        points.push(...namespaced.points);
      });
      return { nodes, points };
    }
  };
}
function initializeCompositeMark(id, marks, options = {}) {
  const children = marks.map(
    (mark, childIndex) => mark.initialize({ markIndex: childIndex })
  );
  const composition = composeInitializedMarks(id, children, {
    coordinates: "semantic",
    owner: "Composite mark",
    interactiveChildren: options.interactiveChildren
  });
  const motion = options.motion !== void 0 || composition.childMotions.size > 0 ? (context) => resolveCompositeChildMotion(
    options.motion,
    composition.childMotions,
    context
  ) : void 0;
  return {
    id,
    channels: composition.channels,
    ...composition.seriesFromColor ? { seriesFromColor: true } : {},
    ...composition.layoutLabels ? { layoutLabels: composition.layoutLabels } : {},
    ...motion ? { motion } : {},
    render: composition.render
  };
}
function validateChildren(parentId, children, owner) {
  const childIds = /* @__PURE__ */ new Set();
  const resolvedIds = /* @__PURE__ */ new Map();
  for (const child of children) {
    if (child.postDomain) {
      throw new TypeError(
        `${owner} cannot compose child mark "${child.id}" because it has post-domain filtering; wrap the composed mark instead`
      );
    }
    if (child.resolveLayout) {
      throw new TypeError(
        `${owner} cannot compose child mark "${child.id}" because it has its own layout`
      );
    }
    if (childIds.has(child.id)) {
      throw new TypeError(
        `${owner} cannot compose duplicate child mark id "${child.id}"`
      );
    }
    childIds.add(child.id);
    const resolvedId = compositeChildMarkId(parentId, child.id);
    const previousId = resolvedIds.get(resolvedId);
    if (previousId !== void 0) {
      throw new TypeError(
        `${owner} cannot compose child mark ids "${previousId}" and "${child.id}" because both resolve to namespace "${resolvedId}"`
      );
    }
    resolvedIds.set(resolvedId, child.id);
  }
}
function mergeChildChannels(parentId, children, options) {
  const merged = {};
  for (const child of children) {
    for (const [name, channel] of Object.entries(child.channels)) {
      if (options.coordinates === "pixel" && (channel.scale === "x" || channel.scale === "y")) {
        validatePixelChannel(child.id, name, channel.scale, channel.values);
        continue;
      }
      merged[`${compositeChildMarkId(parentId, child.id)}:${name}`] = channel;
    }
  }
  return merged;
}
function validatePixelChannel(markId, channelName, axis, values) {
  values.forEach((value, index) => {
    if (typeof value === "number" && Number.isFinite(value)) return;
    throw new TypeError(
      `Resolved child mark "${markId}" ${axis} channel "${channelName}" requires finite pixel numbers; received ${String(value)} at index ${index}`
    );
  });
}
function resolvedPixelScales(children) {
  const values = { x: [], y: [] };
  for (const child of children) {
    for (const channel of Object.values(child.channels)) {
      if (channel.scale !== "x" && channel.scale !== "y") continue;
      values[channel.scale].push(...channel.values);
    }
  }
  return {
    x: pixelScale("x", values.x),
    y: pixelScale("y", values.y)
  };
}
function pixelScale(axis, values) {
  const finitePixel = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    throw new TypeError(
      `Resolved child ${axis} scale requires a finite pixel number; received ${String(value)}`
    );
  };
  return {
    id: axis,
    type: "identity",
    domain: [...new Set(values)],
    map: finitePixel,
    invert: finitePixel,
    ticks: [],
    bandwidth: 0
  };
}
function childContext(context, scales, markIndex) {
  return {
    ...context,
    markIndex,
    ...scales ? { scales: { ...context.scales, ...scales } } : {}
  };
}
function childNamespace(parentId, childId) {
  const prefix = compositeChildMarkId(parentId, childId);
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
function compositeChildMarkId(parentId, childId) {
  return sceneChildId(parentId, childId);
}
function namespaceLabel(label, namespace) {
  return { ...label, key: namespace.identity(label.key) };
}
function namespaceScene(nodes, points, namespace) {
  const mappedPoints = /* @__PURE__ */ new Map();
  const mapPoint = (point) => {
    const previous = mappedPoints.get(point);
    if (previous) return previous;
    const mapped = {
      ...point,
      key: namespace.identity(point.key),
      markId: namespace.identity(point.markId)
    };
    mappedPoints.set(point, mapped);
    return mapped;
  };
  return {
    nodes: mapSceneNodes(nodes, namespace, mapPoint),
    points: points.map(mapPoint)
  };
}
function stripSceneInteractions(nodes, points, lookup = createScenePointLookup(points)) {
  return nodes.map((node) => {
    if (node.kind === "group") {
      const { focus: _focus, states: _states, ...decorative2 } = node;
      const owned2 = sceneNodeOwnedPoints(node, points, lookup, []);
      return {
        ...decorative2,
        children: stripSceneInteractions(
          node.children,
          owned2.length ? owned2 : points,
          lookup
        )
      };
    }
    if (node.kind === "label") return node;
    const { interaction: _interaction, ...decorative } = node;
    const owned = node.interaction?.point ? [node.interaction.point] : node.interaction?.points ?? sceneNodeOwnedPoints(node, points, lookup, []);
    return owned.length === 1 ? { ...decorative, pointOwner: owned[0] } : decorative;
  });
}
function mapSceneNodes(nodes, namespace, mapPoint) {
  return nodes.map((node) => {
    const key = namespace.identity(node.key);
    if (node.kind === "group") {
      return {
        ...node,
        key,
        ...node.pointOwner ? { pointOwner: mapPoint(node.pointOwner) } : {},
        children: mapSceneNodes(node.children, namespace, mapPoint),
        ...node.focus ? {
          focus: {
            ...node.focus,
            points: node.focus.points.map(mapPoint),
            ...node.focus.candidates ? {
              candidates: mapSceneNodes(
                node.focus.candidates,
                namespace,
                mapPoint
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
function collectRenderedPoints(scene) {
  const points = scene.points ? [...scene.points] : [];
  const seen = new Set(points);
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.kind === "group") {
        if (!node.focus) visit(node.children);
        continue;
      }
      if (node.kind === "label" || !node.interaction) continue;
      const interaction = node.interaction;
      const candidates = interaction.point ? [interaction.point] : interaction.points;
      for (const point of candidates) {
        if (seen.has(point)) continue;
        seen.add(point);
        points.push(point);
      }
    }
  };
  visit(scene.nodes);
  return points;
}
export {
  composeInitializedMarks,
  compositeChildMarkId,
  initializeCompositeMark
};
