import {
  channelValues,
  compositeKeyValues,
  inferredKeyValues,
  isChartKey,
  isChartValue,
  isNonnegativeFiniteNumber,
  markStates
} from "./mark.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { resolveDotLayout } from "./dot-layout.js";
import { projectLayoutX, projectLayoutY } from "./resolved-layout-position.js";
import { resolveNumericScale } from "./scale-input.js";
import { valueKey } from "./scales.js";
function dot(source, options = {}) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMarkWithScaleValues(
    ({ markIndex }) => {
      const id = options.id ?? `dot-${markIndex}`;
      const layout = options.layout;
      if (layout?.axis === "x" && options.x !== void 0) {
        throw new TypeError(
          "dot: x is derived by its layout and cannot be configured"
        );
      }
      if (layout?.axis === "y" && options.y !== void 0) {
        throw new TypeError(
          "dot: y is derived by its layout and cannot be configured"
        );
      }
      const xValues = layout?.axis === "x" ? data.map(() => layout.anchor) : channelValues(data, options.x, (_datum, { index }) => index);
      const yValues = layout?.axis === "y" ? data.map(() => layout.anchor) : channelValues(
        data,
        options.y,
        (datum) => typeof datum === "number" ? datum : void 0
      );
      const zValues = channelValues(data, options.z, () => null);
      const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
      const keys = inferredKeyValues(data, options.key, {
        groups: zValues,
        candidates: layout?.axis === "x" ? [yValues] : layout?.axis === "y" ? [xValues] : [xValues, yValues, compositeKeyValues(xValues, yValues)],
        markId: id,
        warningIdentity: options
      });
      const rawRadii = typeof options.r === "number" ? data.map(() => options.r) : channelValues(data, options.r, () => 3.5);
      const radiusMapper = resolveNumericScale(options.rScale, rawRadii);
      const radii = radiusMapper ? rawRadii.map(
        (value) => isNonnegativeFiniteNumber(value) ? radiusMapper(value) : Number.NaN
      ) : rawRadii;
      const sourceRows = data.map(
        (datum, sourceIndex) => ({ datum, sourceIndex })
      );
      const renderPositions = (positions, resolveColor) => {
        const nodes = [];
        positions.forEach((position) => {
          const {
            datum,
            sourceIndex: datumIndex,
            xValue,
            yValue,
            x,
            y
          } = position;
          const radius = radii[datumIndex];
          if (!isNonnegativeFiniteNumber(radius)) return;
          const group = zValues[datumIndex] ?? null;
          const groupKey = valueKey(group);
          const color = options.fill ?? resolveColor(colorValues[datumIndex] ?? null);
          const key = `${id}:${groupKey}:${valueKey(keys[datumIndex])}`;
          const point = {
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue,
            yValue,
            x,
            y,
            color
          };
          nodes.push({
            kind: "dot",
            key,
            x,
            y,
            radius,
            interaction: {
              point,
              affinity: layout?.axis === "y" ? "x" : layout?.axis === "x" ? "y" : void 0
            },
            style: {
              fill: color,
              fillOpacity: options.fillOpacity,
              stroke: options.stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth
            }
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__dot",
              ariaHidden: true,
              children: nodes
            }
          ]
        };
      };
      const channels = {
        ...layout?.axis !== "x" ? { x: { scale: "x", values: xValues.filter(isChartValue) } } : {},
        ...layout?.axis !== "y" ? { y: { scale: "y", values: yValues.filter(isChartValue) } } : {},
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      };
      const initialized = {
        id,
        states: markStates(data, options.states),
        channels
      };
      if (!layout) {
        return {
          ...initialized,
          render: ({ scales, color: resolveColor }) => {
            const xScale = requiredScale(scales.x, "x");
            const yScale = requiredScale(scales.y, "y");
            const positions = projectLayoutY(
              projectLayoutX(sourceRows, xValues, xScale),
              yValues,
              yScale
            );
            return renderPositions(positions, resolveColor);
          }
        };
      }
      return {
        ...initialized,
        resolveLayout: ({ chart, scales }) => {
          if (layout.axis === "y") {
            const measured2 = projectLayoutX(
              sourceRows,
              xValues,
              requiredScale(scales.x, "x")
            ).filter((row) => isNonnegativeFiniteNumber(radii[row.sourceIndex]));
            const crossPositions2 = resolveCrossPositions(
              layout,
              chart,
              measured2.map((row) => row.x),
              measured2.map((row) => radii[row.sourceIndex])
            );
            const positions2 = measured2.map(
              (row, index) => ({
                ...row,
                yValue: layout.anchor,
                y: crossPositions2[index]
              })
            );
            return {
              render: ({ color: resolveColor }) => renderPositions(positions2, resolveColor)
            };
          }
          const measured = projectLayoutY(
            sourceRows,
            yValues,
            requiredScale(scales.y, "y")
          ).filter((row) => isNonnegativeFiniteNumber(radii[row.sourceIndex]));
          const crossPositions = resolveCrossPositions(
            layout,
            chart,
            measured.map((row) => row.y),
            measured.map((row) => radii[row.sourceIndex])
          );
          const positions = measured.map(
            (row, index) => ({
              ...row,
              xValue: layout.anchor,
              x: crossPositions[index]
            })
          );
          return {
            render: ({ color: resolveColor }) => renderPositions(positions, resolveColor)
          };
        }
      };
    },
    options.motion
  );
}
function requiredScale(scale, axis) {
  if (!scale) throw new TypeError(`dot: missing ${axis} scale`);
  return scale;
}
function resolveCrossPositions(layout, chart, measuredPositions, radii) {
  const positions = layout[resolveDotLayout]({
    chart,
    measuredPositions,
    radii
  });
  if (positions.length !== measuredPositions.length || positions.some((position) => !Number.isFinite(position))) {
    throw new TypeError("dot: layout must resolve one finite position per row");
  }
  return positions;
}
export {
  dot
};
