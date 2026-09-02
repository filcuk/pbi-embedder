function createScenePointLookup(points) {
  const keys = /* @__PURE__ */ new Map();
  const marks = /* @__PURE__ */ new Map();
  const append = (map, key, point) => {
    const related = map.get(key);
    if (related) related.push(point);
    else map.set(key, [point]);
  };
  for (const point of points) {
    append(marks, point.markId, point);
    let end = point.key.length;
    while (end > 0) {
      append(keys, point.key.slice(0, end), point);
      end = point.key.lastIndexOf(":", end - 1);
    }
  }
  return { points, keys, marks };
}
function sceneNodeOwnedPoints(node, scope, lookup, fallback = scope) {
  if (node.kind === "group") {
    const index = node.focusCandidateIndex;
    if (index !== void 0 && Number.isInteger(index) && index >= 0) {
      const point = scope[index];
      if (point) return [point];
    }
  }
  if (node.pointOwner) {
    const owned = pointCandidates(node.pointOwner, scope);
    if (owned.length) return owned;
  }
  if ("interaction" in node && node.interaction) {
    const candidates = node.interaction.point ? [node.interaction.point] : node.interaction.points;
    const owned = candidates.flatMap(
      (candidate) => pointCandidates(candidate, scope)
    );
    if (owned.length) return owned;
  }
  return sceneKeyOwnedPoints(node.key, scope, lookup, fallback);
}
function sceneKeyOwnedPoints(key, scope, lookup, fallback = scope) {
  const withinScope = (candidates) => candidates === void 0 ? [] : scope === lookup.points ? candidates : candidates.filter((point) => scope.includes(point));
  const related = withinScope(lookup.keys.get(key));
  const exact = related.filter((point) => point.key === key);
  if (exact.length) return exact;
  let candidate = key;
  while (candidate.includes(":")) {
    const separator = candidate.lastIndexOf(":");
    candidate = candidate.slice(0, separator);
    const fragments = withinScope(lookup.keys.get(candidate)).filter(
      (point) => point.key === candidate
    );
    if (fragments.length) return fragments;
  }
  if (related.length) return related;
  const mark = withinScope(lookup.marks.get(key));
  if (mark.length) return mark;
  return fallback;
}
function pointCandidates(owner, scope) {
  const identical = scope.filter((point) => point === owner);
  if (identical.length) return identical;
  const keyed = scope.filter((point) => point.key === owner.key);
  if (keyed.length) return keyed;
  const semantic = scope.filter(
    (point) => Object.is(point.datum, owner.datum) && (isReference(owner.datum) || point.datumIndex === owner.datumIndex)
  );
  return semantic.length === 1 ? semantic : [];
}
function isReference(value) {
  return typeof value === "object" && value !== null || typeof value === "function";
}
export {
  createScenePointLookup,
  sceneKeyOwnedPoints,
  sceneNodeOwnedPoints
};
