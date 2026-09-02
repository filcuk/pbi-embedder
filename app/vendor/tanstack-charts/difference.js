import { areaX } from "./area-x.js";
import { areaY } from "./area.js";
import { lineX, lineY } from "./line.js";
import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  isFiniteNumber
} from "./mark.js";
import { initializeCompositeMark } from "./mark-composite-internal.js";
import { adoptResolvedChildMark } from "./resolved-layout-child.js";
import { valueKey } from "./scales.js";
import { groupedIndexes } from "./transform-internal.js";
function differenceY(source, options) {
  return difference(source, options, options.x, options.y1, options.y2, "y");
}
function differenceX(source, options) {
  return difference(source, options, options.y, options.x1, options.x2, "x");
}
const interactiveDifferenceChildren = /* @__PURE__ */ new Set(["comparison", "primary"]);
function difference(source, options, independent, comparison, primary, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `difference-${orientation}-${markIndex}`;
    const independentValues = channelValues(data, independent, () => void 0);
    const comparisonValues = numericValues(data, comparison);
    const primaryValues = numericValues(data, primary);
    const groupValues = channelValues(data, options.z, () => null);
    validateIndependentValues(
      independentValues,
      comparisonValues,
      primaryValues,
      orientation
    );
    const keys = inferredKeyValues(data, options.key, {
      groups: groupValues,
      candidates: [independentValues],
      markId: id,
      warningIdentity: options
    });
    const semanticValid = data.map(
      (_datum, index) => isIndependent(independentValues[index]) && isFiniteNumber(comparisonValues[index]) && isFiniteNumber(primaryValues[index])
    );
    const domainIndependent = independentValues.filter(
      (_value, index) => semanticValid[index]
    );
    const domainDependent = [
      ...comparisonValues.filter(
        (_value, index) => semanticValid[index]
      ),
      ...primaryValues.filter(
        (_value, index) => semanticValid[index]
      )
    ];
    return {
      id,
      channels: orientation === "y" ? {
        x: { scale: "x", values: domainIndependent },
        y: { scale: "y", values: domainDependent }
      } : {
        x: { scale: "x", values: domainDependent },
        y: { scale: "y", values: domainIndependent }
      },
      resolveLayout: ({ scales }) => {
        const projection = resolveDifferenceScales(scales, orientation);
        const positions = projectDifferenceValues(
          independentValues,
          comparisonValues,
          primaryValues,
          projection
        );
        const lobes = differenceLobes(
          data,
          independentValues,
          comparisonValues,
          primaryValues,
          positions.independent,
          positions.comparison,
          positions.primary,
          groupValues,
          keys,
          projection
        );
        const children = differenceChildren(
          data,
          options,
          orientation,
          materializeAreaRows(lobes),
          independentValues,
          comparisonValues,
          primaryValues,
          groupValues,
          keys,
          positions.valid
        );
        return adoptResolvedChildMark(
          initializeCompositeMark(id, children, {
            interactiveChildren: interactiveDifferenceChildren
          })
        );
      }
    };
  }, options.motion);
}
function differenceChildren(data, options, orientation, areas, independentValues, comparisonValues, primaryValues, groupValues, keys, sharedValid) {
  const lineIndependent = (_datum, { index }) => sharedValid[index] ? independentValues[index] : void 0;
  const comparisonValue = (_datum, { index }) => sharedValid[index] ? comparisonValues[index] : void 0;
  const primaryValue = (_datum, { index }) => sharedValid[index] ? primaryValues[index] : void 0;
  const lineGroup = (_datum, { index }) => isChartKey(groupValues[index]) ? groupValues[index] : null;
  const lineKey = (_datum, { index }) => keys[index] ?? index;
  const noColor = () => null;
  const children = [];
  if (options.positiveFill !== null) {
    children.push(
      orientation === "y" ? areaY(areas.positive, {
        id: "positive",
        x: (datum) => datum.independent,
        y1: "comparison",
        y2: "primary",
        z: "segment",
        color: noColor,
        key: "markKey",
        fill: options.positiveFill ?? "#3ca951",
        fillOpacity: options.positiveFillOpacity ?? options.fillOpacity ?? 0.2
      }) : areaX(areas.positive, {
        id: "positive",
        x1: "comparison",
        x2: "primary",
        y: (datum) => datum.independent,
        z: "segment",
        color: noColor,
        key: "markKey",
        fill: options.positiveFill ?? "#3ca951",
        fillOpacity: options.positiveFillOpacity ?? options.fillOpacity ?? 0.2
      })
    );
  }
  if (options.negativeFill !== null) {
    children.push(
      orientation === "y" ? areaY(areas.negative, {
        id: "negative",
        x: (datum) => datum.independent,
        y1: "comparison",
        y2: "primary",
        z: "segment",
        color: noColor,
        key: "markKey",
        fill: options.negativeFill ?? "#4269d0",
        fillOpacity: options.negativeFillOpacity ?? options.fillOpacity ?? 0.2
      }) : areaX(areas.negative, {
        id: "negative",
        x1: "comparison",
        x2: "primary",
        y: (datum) => datum.independent,
        z: "segment",
        color: noColor,
        key: "markKey",
        fill: options.negativeFill ?? "#4269d0",
        fillOpacity: options.negativeFillOpacity ?? options.fillOpacity ?? 0.2
      })
    );
  }
  children.push(
    orientation === "y" ? lineY(data, {
      id: "comparison",
      x: lineIndependent,
      y: comparisonValue,
      z: lineGroup,
      color: noColor,
      key: lineKey,
      stroke: options.comparisonStroke ?? "#64748b",
      strokeOpacity: options.comparisonStrokeOpacity ?? options.strokeOpacity,
      strokeWidth: options.comparisonStrokeWidth ?? options.strokeWidth ?? 2.25,
      strokeDasharray: options.comparisonStrokeDasharray,
      points: options.points,
      states: options.comparisonStates
    }) : lineX(data, {
      id: "comparison",
      x: comparisonValue,
      y: lineIndependent,
      z: lineGroup,
      color: noColor,
      key: lineKey,
      stroke: options.comparisonStroke ?? "#64748b",
      strokeOpacity: options.comparisonStrokeOpacity ?? options.strokeOpacity,
      strokeWidth: options.comparisonStrokeWidth ?? options.strokeWidth ?? 2.25,
      strokeDasharray: options.comparisonStrokeDasharray,
      points: options.points,
      states: options.comparisonStates
    }),
    orientation === "y" ? lineY(data, {
      id: "primary",
      x: lineIndependent,
      y: primaryValue,
      z: lineGroup,
      color: noColor,
      key: lineKey,
      stroke: options.stroke ?? "currentColor",
      strokeOpacity: options.strokeOpacity,
      strokeWidth: options.strokeWidth,
      strokeDasharray: options.strokeDasharray,
      points: options.points,
      states: options.states
    }) : lineX(data, {
      id: "primary",
      x: primaryValue,
      y: lineIndependent,
      z: lineGroup,
      color: noColor,
      key: lineKey,
      stroke: options.stroke ?? "currentColor",
      strokeOpacity: options.strokeOpacity,
      strokeWidth: options.strokeWidth,
      strokeDasharray: options.strokeDasharray,
      points: options.points,
      states: options.states
    })
  );
  return children;
}
function numericValues(data, value) {
  return typeof value === "number" ? data.map(() => value) : channelValues(data, value, () => void 0);
}
function resolveDifferenceScales(scales, orientation) {
  const owner = orientation === "y" ? "differenceY" : "differenceX";
  const x = scales.x;
  const y = scales.y;
  if (!x || !y) {
    throw new TypeError(`${owner}: x and y scales are required`);
  }
  if (!x.invert || !y.invert) {
    throw new TypeError(`${owner}: x and y scales must support inversion`);
  }
  return orientation === "y" ? {
    owner,
    independentAxis: "x",
    dependentAxis: "y",
    independent: x,
    dependent: y
  } : {
    owner,
    independentAxis: "y",
    dependentAxis: "x",
    independent: y,
    dependent: x
  };
}
function projectDifferenceValues(independentValues, comparisonValues, primaryValues, scales) {
  const independent = [];
  const comparison = [];
  const primary = [];
  const valid = [];
  for (let index = 0; index < independentValues.length; index += 1) {
    const independentValue = independentValues[index];
    const comparisonValue = comparisonValues[index];
    const primaryValue = primaryValues[index];
    if (!isIndependent(independentValue) || !isFiniteNumber(comparisonValue) || !isFiniteNumber(primaryValue)) {
      independent.push(void 0);
      comparison.push(void 0);
      primary.push(void 0);
      valid.push(false);
      continue;
    }
    const independentPosition = scales.independent.map(independentValue);
    const comparisonPosition = scales.dependent.map(comparisonValue);
    const primaryPosition = scales.dependent.map(primaryValue);
    const rowValid = isFiniteNumber(independentPosition) && isFiniteNumber(comparisonPosition) && isFiniteNumber(primaryPosition);
    independent.push(rowValid ? independentPosition : void 0);
    comparison.push(rowValid ? comparisonPosition : void 0);
    primary.push(rowValid ? primaryPosition : void 0);
    valid.push(rowValid);
  }
  return { independent, comparison, primary, valid };
}
function validateIndependentValues(values, comparisonValues, primaryValues, orientation) {
  let kind;
  for (let index = 0; index < values.length; index += 1) {
    if (!isFiniteNumber(comparisonValues[index]) || !isFiniteNumber(primaryValues[index])) {
      continue;
    }
    const value = values[index];
    if (!isIndependent(value)) continue;
    const nextKind = value instanceof Date ? "date" : "number";
    if (kind !== void 0 && kind !== nextKind) {
      throw new TypeError(
        `difference${orientation.toUpperCase()}: independent values cannot mix numbers and Dates`
      );
    }
    kind = nextKind;
  }
}
function differenceLobes(data, independentValues, comparisonValues, primaryValues, independentPositions, comparisonPositions, primaryPositions, groupValues, keys, scales) {
  const lobes = [];
  const groups = groupValues.map((group) => isChartKey(group) ? group : null);
  for (const { key: group, indexes } of groupedIndexes(groups)) {
    const groupKey = valueKey(group);
    let block = [];
    const flush = () => {
      if (block.length > 1) {
        lobes.push(...blockLobes(block, groupKey, scales));
      }
      block = [];
    };
    for (const sourceIndex of indexes) {
      const independent = independentValues[sourceIndex];
      const comparison = comparisonValues[sourceIndex];
      const primary = primaryValues[sourceIndex];
      const independentPosition = independentPositions[sourceIndex];
      const comparisonPosition = comparisonPositions[sourceIndex];
      const primaryPosition = primaryPositions[sourceIndex];
      if (!isIndependent(independent) || !isFiniteNumber(comparison) || !isFiniteNumber(primary) || !isFiniteNumber(independentPosition) || !isFiniteNumber(comparisonPosition) || !isFiniteNumber(primaryPosition)) {
        flush();
        continue;
      }
      block.push({
        independent,
        comparison,
        primary,
        independentPosition,
        comparisonPosition,
        primaryPosition,
        crossing: false,
        pointKey: `source:${valueKey(keys[sourceIndex])}`,
        source: [data[sourceIndex]],
        sourceIndexes: [sourceIndex]
      });
    }
    flush();
  }
  return lobes;
}
function blockLobes(block, groupKey, scales) {
  const augmented = [];
  block.forEach((point, index) => {
    const previous = block[index - 1];
    if (previous && signOf(previous) !== signOf(point)) {
      const previousSign = signOf(previous);
      const nextSign2 = signOf(point);
      if (previousSign !== void 0 && nextSign2 !== void 0) {
        augmented.push(crossingPoint(previous, point, scales));
      }
    }
    augmented.push(point);
  });
  const lobes = [];
  let activeSign;
  let activePoints = [];
  let carriedSign;
  const flush = () => {
    if (activeSign !== void 0 && activePoints.length > 1) {
      lobes.push({ sign: activeSign, groupKey, points: activePoints });
    }
    activeSign = void 0;
    activePoints = [];
  };
  for (let index = 0; index < augmented.length - 1; index += 1) {
    const left = augmented[index];
    const right = augmented[index + 1];
    if (!left || !right) continue;
    const intervalSign = signOf(left) ?? signOf(right) ?? carriedSign ?? nextSign(augmented, index + 2);
    if (intervalSign === void 0) {
      flush();
      continue;
    }
    carriedSign = intervalSign;
    if (activeSign !== intervalSign) {
      flush();
      activeSign = intervalSign;
      activePoints = [left, right];
    } else {
      activePoints.push(right);
    }
  }
  flush();
  return lobes;
}
function nextSign(points, start) {
  for (let index = start; index < points.length; index += 1) {
    const point = points[index];
    if (!point) continue;
    const sign = signOf(point);
    if (sign !== void 0) return sign;
  }
  return void 0;
}
function signOf(point) {
  const difference2 = point.primary - point.comparison;
  return difference2 === 0 ? void 0 : difference2 > 0 ? "positive" : "negative";
}
function crossingPoint(left, right, scales) {
  const ratio = crossingRatio(left, right, scales.owner);
  const independentPosition = interpolateNumber(
    left.independentPosition,
    right.independentPosition,
    ratio
  );
  const primaryPosition = interpolateNumber(
    left.primaryPosition,
    right.primaryPosition,
    ratio
  );
  const comparisonPosition = interpolateNumber(
    left.comparisonPosition,
    right.comparisonPosition,
    ratio
  );
  const boundaryPosition = (primaryPosition + comparisonPosition) / 2;
  const independent = scales.independent.invert(independentPosition);
  const boundary = scales.dependent.invert(boundaryPosition);
  if (!isIndependent(independent) || independent instanceof Date !== left.independent instanceof Date) {
    throw new TypeError(
      `${scales.owner}: ${scales.independentAxis} scale must invert crossings to ${left.independent instanceof Date ? "valid Dates" : "finite numbers"}`
    );
  }
  if (!isFiniteNumber(boundary)) {
    throw new TypeError(
      `${scales.owner}: ${scales.dependentAxis} scale must invert crossings to finite numbers`
    );
  }
  return {
    independent,
    comparison: boundary,
    primary: boundary,
    independentPosition,
    comparisonPosition: boundaryPosition,
    primaryPosition: boundaryPosition,
    crossing: true,
    pointKey: `crossing:${left.pointKey}:${right.pointKey}`,
    source: [...left.source, ...right.source],
    sourceIndexes: [...left.sourceIndexes, ...right.sourceIndexes]
  };
}
function crossingRatio(left, right, owner) {
  const leftDifference = left.primaryPosition - left.comparisonPosition;
  const rightDifference = right.primaryPosition - right.comparisonPosition;
  if (leftDifference === 0 && rightDifference === 0) return 0.5;
  if (leftDifference === 0) return 0;
  if (rightDifference === 0) return 1;
  if (leftDifference > 0 === rightDifference > 0) {
    throw new TypeError(
      `${owner}: dependent scale must preserve boundary order within each segment`
    );
  }
  const leftMagnitude = Math.abs(leftDifference);
  const rightMagnitude = Math.abs(rightDifference);
  const scale = Math.max(leftMagnitude, rightMagnitude);
  const normalizedLeft = leftMagnitude / scale;
  const normalizedRight = rightMagnitude / scale;
  return normalizedLeft / (normalizedLeft + normalizedRight);
}
function interpolateNumber(left, right, ratio) {
  return left + (right - left) * ratio;
}
function materializeAreaRows(lobes) {
  const positive = [];
  const negative = [];
  lobes.forEach((lobe) => {
    const first = lobe.points[0];
    const last = lobe.points[lobe.points.length - 1];
    if (!first || !last) return;
    const segment = `${lobe.groupKey}:${lobe.sign}:${first.pointKey}:${last.pointKey}`;
    const target = lobe.sign === "positive" ? positive : negative;
    lobe.points.forEach((point) => {
      target.push({
        kind: "difference-area",
        independent: point.independent,
        comparison: point.comparison,
        primary: point.primary,
        sign: lobe.sign,
        segment,
        crossing: point.crossing,
        markKey: `${segment}:${point.pointKey}`,
        source: point.source,
        sourceIndexes: point.sourceIndexes
      });
    });
  });
  return { positive, negative };
}
function isIndependent(value) {
  return isFiniteNumber(value) || value instanceof Date && Number.isFinite(value.getTime());
}
export {
  differenceX,
  differenceY
};
