import { Delaunay } from "d3-delaunay";
import { compareChartKey } from "./scales.js";
function canonicalDelaunayPoints(points) {
  const ordered = [...points].sort(comparePointIdentity);
  const seen = /* @__PURE__ */ new Map();
  return ordered.filter((point) => {
    const yValues = seen.get(point.x);
    if (yValues?.has(point.y)) return false;
    if (yValues) yValues.add(point.y);
    else seen.set(point.x, /* @__PURE__ */ new Set([point.y]));
    return true;
  });
}
function createDelaunay(points) {
  return Delaunay.from(
    points,
    (point) => point.x,
    (point) => point.y
  );
}
function delaunayNeighborIndexes(delaunay, pointCount, includeDegenerateTriangles = false) {
  const adjacency = Array.from({ length: pointCount }, () => /* @__PURE__ */ new Set());
  const addEdge = (source, target) => {
    if (source < 0 || target < 0 || source >= pointCount || target >= pointCount || source === target) {
      return;
    }
    adjacency[source].add(target);
    adjacency[target].add(source);
  };
  const { triangles, hull } = delaunay;
  const collinear = delaunay.collinear;
  if (collinear) {
    for (let index = 1; index < collinear.length; index += 1) {
      addEdge(collinear[index - 1], collinear[index]);
    }
  }
  if (!collinear || includeDegenerateTriangles) {
    for (let index = 0; index < triangles.length; index += 3) {
      const first = triangles[index];
      const second = triangles[index + 1];
      const third = triangles[index + 2];
      addEdge(first, second);
      addEdge(second, third);
      addEdge(third, first);
    }
    for (let index = 0; index < hull.length; index += 1) {
      addEdge(hull[index], hull[(index + 1) % hull.length]);
    }
  }
  return adjacency.map((neighbors) => [...neighbors]);
}
function angularDelaunayNeighborIndexes(delaunay, pointCount, includeDegenerateTriangles = false) {
  const { points } = delaunay;
  return delaunayNeighborIndexes(
    delaunay,
    pointCount,
    includeDegenerateTriangles
  ).map(
    (neighbors, source) => [...neighbors].sort(
      (left, right) => Math.atan2(
        points[left * 2 + 1] - points[source * 2 + 1],
        points[left * 2] - points[source * 2]
      ) - Math.atan2(
        points[right * 2 + 1] - points[source * 2 + 1],
        points[right * 2] - points[source * 2]
      )
    )
  );
}
function delaunayNeighborPairs(points) {
  if (points.length < 2) return [];
  const delaunay = createDelaunay(points);
  const pairs = [];
  const neighbors = delaunayNeighborIndexes(delaunay, points.length);
  for (let source = 0; source < points.length; source += 1) {
    for (const target of neighbors[source]) {
      if (target <= source) continue;
      pairs.push([source, target]);
    }
  }
  return pairs;
}
function comparePointIdentity(left, right) {
  return compareChartKey(left.key, right.key) || left.sourceIndex - right.sourceIndex;
}
export {
  angularDelaunayNeighborIndexes,
  canonicalDelaunayPoints,
  createDelaunay,
  delaunayNeighborIndexes,
  delaunayNeighborPairs
};
