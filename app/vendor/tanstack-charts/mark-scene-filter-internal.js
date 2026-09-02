import {
  createScenePointLookup,
  sceneNodeOwnedPoints
} from "./scene-point-ownership-internal.js";
function stripMarkSceneInteraction(scene, options = {}) {
  return {
    nodes: scene.nodes.map(
      (node) => stripSceneNodeInteraction(node, options.conditional ?? "remove")
    ),
    points: []
  };
}
function filterMarkSceneByPoint(scene, include, options = {}) {
  const interaction = options.interaction ?? "preserve";
  const points = collectMarkScenePoints(scene);
  const lookup = createScenePointLookup(points);
  const nodes = scene.nodes.flatMap((node) => {
    const filtered = filterNode(
      node,
      points,
      lookup,
      include,
      interaction,
      points
    );
    return filtered ? [filtered] : [];
  });
  if (interaction === "remove") return { nodes, points: [] };
  return scene.points ? { nodes, points: scene.points.filter(include) } : { nodes };
}
function filterNode(node, points, lookup, include, interaction, scope) {
  if (node.kind === "group") {
    const owned2 = sceneNodeOwnedPoints(
      node,
      scope,
      lookup
    );
    const childScope = metadataPoints(node) ?? (owned2.length ? owned2 : scope);
    const children = node.children.flatMap((child) => {
      const filtered2 = filterNode(
        child,
        points,
        lookup,
        include,
        interaction,
        childScope
      );
      return filtered2 ? [filtered2] : [];
    });
    const candidates = node.focus?.candidates?.flatMap((candidate) => {
      const filtered2 = filterNode(
        candidate,
        points,
        lookup,
        include,
        interaction,
        node.focus.points
      );
      return filtered2 ? [filtered2] : [];
    });
    if (!children.length && !candidates?.length) return null;
    const filtered = filterGroupState(node, children, candidates, include);
    return interaction === "remove" ? stripSceneNodeInteraction(filtered, "remove") : filtered;
  }
  const owned = sceneNodeOwnedPoints(
    node,
    scope,
    lookup
  );
  if (!owned.some(include)) return null;
  if (interaction === "remove") {
    return stripSceneNodeInteraction(node, "remove");
  }
  if (node.kind !== "label" && node.interaction && !node.interaction.point) {
    const included = node.interaction.points.filter(include);
    return {
      ...node,
      interaction: { ...node.interaction, points: included }
    };
  }
  return node;
}
function stripSceneNodeInteraction(node, conditional) {
  if (node.kind === "group") {
    if (conditional === "reject" && (node.focus || node.states)) {
      throw new TypeError(
        "decorative() cannot wrap scene geometry with focus or state behavior"
      );
    }
    const children = node.focus?.retarget && node.focus.candidates ? node.focus.candidates : node.children;
    const {
      focus: _focus,
      states: _states,
      pointOwner: _pointOwner2,
      focusCandidateIndex: _focusCandidateIndex,
      ...decorative2
    } = node;
    return {
      ...decorative2,
      children: children.map(
        (child) => stripSceneNodeInteraction(child, conditional)
      )
    };
  }
  if (node.kind === "label") {
    const { pointOwner: _pointOwner2, ...decorative2 } = node;
    return decorative2;
  }
  const {
    interaction: _interaction,
    pointOwner: _pointOwner,
    ...decorative
  } = node;
  return decorative;
}
function metadataPoints(node) {
  return node.focus?.activePoints ?? node.focus?.points ?? node.states?.points;
}
function filterGroupState(node, children, candidates, include) {
  return {
    ...node,
    children,
    ...node.focus ? {
      focus: {
        ...node.focus,
        points: node.focus.points.filter(include),
        ...candidates ? { candidates } : {},
        ...node.focus.activePoints ? {
          activePoints: node.focus.activePoints.filter(include)
        } : {}
      }
    } : {},
    ...node.states ? {
      states: {
        ...node.states,
        points: node.states.points.filter(include)
      }
    } : {}
  };
}
function collectMarkScenePoints(scene) {
  const points = scene.points ? [...scene.points] : [];
  const seen = new Set(points);
  const add = (candidates) => {
    for (const point of candidates) {
      const typed = point;
      if (seen.has(typed)) continue;
      seen.add(typed);
      points.push(typed);
    }
  };
  const visit = (nodes) => {
    for (const node of nodes) {
      if (node.pointOwner) add([node.pointOwner]);
      if (node.kind === "group") {
        if (node.focus) {
          add(node.focus.points);
          if (node.focus.activePoints) add(node.focus.activePoints);
          if (node.focus.candidates) visit(node.focus.candidates);
        }
        if (node.states) add(node.states.points);
        visit(node.children);
        continue;
      }
      if (node.kind === "label" || !node.interaction) continue;
      const candidates = node.interaction.point ? [node.interaction.point] : node.interaction.points;
      add(candidates);
    }
  };
  visit(scene.nodes);
  return points;
}
export {
  filterMarkSceneByPoint,
  stripMarkSceneInteraction
};
