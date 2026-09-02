function normalizeContourThresholds(input, defaultCount, markName) {
  const thresholds = input ?? defaultCount;
  if (typeof thresholds === "number") {
    if (!Number.isInteger(thresholds) || thresholds <= 0) {
      throw new TypeError(
        `${markName}: threshold count must be a positive integer`
      );
    }
    return thresholds;
  }
  const values = Array.from(thresholds);
  if (!values.every((value) => Number.isFinite(value))) {
    throw new TypeError(`${markName}: thresholds must be finite numbers`);
  }
  return values.sort((left, right) => left - right);
}
function identifyContourLevels(levels, mode) {
  if (mode.kind === "generated") {
    return levels.map((value, index) => ({
      value,
      identity: ["generated", mode.count, index]
    }));
  }
  const occurrences = /* @__PURE__ */ new Map();
  return levels.map((value) => {
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return {
      value,
      identity: ["explicit", value, occurrence]
    };
  });
}
function mapContourPolygons(coordinates, project = (x, y) => [
  x,
  y
]) {
  return coordinates.flatMap((polygon) => {
    if (!polygon.length) return [];
    const rings = polygon.map((ring) => {
      const points = ring.map((coordinate) => {
        const x = coordinate[0];
        const y = coordinate[1];
        if (!Number.isFinite(x) || !Number.isFinite(y)) invalidContourPoint();
        const point = project(x, y);
        if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
          invalidContourPoint();
        }
        return point;
      });
      if (points.length > 1 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1]) {
        points.pop();
      }
      if (points.length < 3) {
        throw new TypeError("Contour rings must contain at least three points");
      }
      return points;
    });
    return [rings];
  });
}
function invalidContourPoint() {
  throw new TypeError(
    "Contour coordinates must project to finite two-dimensional points"
  );
}
export {
  identifyContourLevels,
  mapContourPolygons,
  normalizeContourThresholds
};
