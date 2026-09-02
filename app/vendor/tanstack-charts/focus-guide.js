import { whenFocused } from "./focus-mark.js";
import { createGuideNodes } from "./guide-nodes-internal.js";
import {
  channelValues,
  createMark,
  inferredKeyValues,
  isChartKey,
  isChartValue,
  visualValue
} from "./mark.js";
import { valueKey } from "./scales.js";
function focusGuideX(source, options) {
  return focusGuide(source, options, "x");
}
function focusGuideY(source, options) {
  return focusGuide(source, options, "y");
}
function focusGuide(source, options, orientation) {
  const data = Array.isArray(source) ? source : Array.from(source);
  const xRule = options.xRule === void 0 ? orientation === "x" ? {} : false : options.xRule;
  const yRule = options.yRule === void 0 ? orientation === "y" ? {} : false : options.yRule;
  const mark = createMark(({ markIndex }) => {
    const id = options.id ?? `focus-guide-${orientation}-${markIndex}`;
    const xValues = channelValues(data, options.x, () => void 0);
    const yValues = channelValues(data, options.y, () => void 0);
    const zValues = channelValues(data, options.z, () => null);
    const keys = inferredKeyValues(data, options.key, {
      groups: zValues,
      candidates: [xValues, yValues],
      markId: id,
      warningIdentity: options
    });
    const renderCandidates = (context) => {
      const nodes = [];
      const points = [];
      const labels = [];
      data.forEach((datum, datumIndex) => {
        const xValue = xValues[datumIndex];
        const yValue = yValues[datumIndex];
        if (!isChartValue(xValue) || !isChartValue(yValue)) return;
        const group = zValues[datumIndex];
        const normalizedGroup = isChartKey(group) ? group : null;
        const candidateKey = `${id}:${valueKey(normalizedGroup)}:${valueKey(keys[datumIndex])}`;
        const color = context.theme.foreground;
        const x = context.scales.x.map(xValue);
        const y = context.scales.y.map(yValue);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const point = {
          key: `${candidateKey}:point`,
          markId: id,
          group: normalizedGroup,
          groupLabel: normalizedGroup === null ? id : String(normalizedGroup),
          datum,
          datumIndex,
          xValue,
          yValue,
          x,
          y,
          color
        };
        const guide = createGuideNodes({
          id,
          classPrefix: "ts-chart__focus-guide",
          chart: context.chart,
          x: point.x,
          y: point.y,
          xRule: xRule === false ? false : { style: ruleStyle(xRule, datum, datumIndex, data, context) },
          yRule: yRule === false ? false : { style: ruleStyle(yRule, datum, datumIndex, data, context) },
          marker: resolveMarker(
            options.marker,
            datum,
            datumIndex,
            data,
            context
          ),
          xLabel: resolveLabel(
            options.xLabel,
            point.xValue,
            point,
            datum,
            datumIndex,
            data,
            context
          ),
          yLabel: resolveLabel(
            options.yLabel,
            point.yValue,
            point,
            datum,
            datumIndex,
            data,
            context
          ),
          measureText: context.layout.measureText
        });
        labels.push(...guide.labels);
        nodes.push({
          kind: "group",
          key: candidateKey,
          className: "ts-chart__focus-guide-candidate",
          ariaHidden: true,
          focusCandidateIndex: points.length,
          children: guide.nodes
        });
        points.push(point);
      });
      return { nodes, points, labels };
    };
    return {
      id,
      channels: {
        x: { scale: "x", values: xValues.filter(isChartValue) },
        y: { scale: "y", values: yValues.filter(isChartValue) }
      },
      layoutLabels: (context) => renderCandidates(context).labels,
      render: (context) => {
        const rendered = renderCandidates(context);
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: `ts-chart__focus-guide ts-chart__focus-guide-${orientation}`,
              ariaHidden: true,
              children: rendered.nodes
            }
          ],
          points: rendered.points
        };
      }
    };
  }, options.motion);
  return whenFocused(mark, {
    match: options.match ?? "primary",
    retarget: true
  });
}
function ruleStyle(options, datum, datumIndex, data, context) {
  return {
    stroke: visualValue(
      options.stroke,
      datum,
      datumIndex,
      data,
      context.theme.foreground
    ),
    strokeOpacity: visualValue(
      options.strokeOpacity,
      datum,
      datumIndex,
      data,
      0.48
    ),
    strokeWidth: nonnegative(
      visualValue(options.strokeWidth, datum, datumIndex, data, 1),
      1
    ),
    strokeDasharray: visualValue(
      options.strokeDasharray,
      datum,
      datumIndex,
      data,
      "4 4"
    ),
    lineCap: options.lineCap
  };
}
function resolveMarker(marker, datum, datumIndex, data, context) {
  if (marker === false || marker === void 0) return false;
  return {
    radius: nonnegative(
      visualValue(marker.radius, datum, datumIndex, data, 5),
      5
    ),
    style: {
      fill: visualValue(
        marker.fill,
        datum,
        datumIndex,
        data,
        context.theme.background
      ),
      fillOpacity: visualValue(marker.fillOpacity, datum, datumIndex, data, 1),
      stroke: visualValue(
        marker.stroke,
        datum,
        datumIndex,
        data,
        context.theme.foreground
      ),
      strokeOpacity: visualValue(
        marker.strokeOpacity,
        datum,
        datumIndex,
        data,
        1
      ),
      strokeWidth: nonnegative(
        visualValue(marker.strokeWidth, datum, datumIndex, data, 1.5),
        1.5
      )
    }
  };
}
function resolveLabel(options, value, point, datum, datumIndex, data, context) {
  if (options === false || options === void 0) return false;
  return {
    text: options.format?.(value, { point }) ?? String(value),
    side: options.side,
    offset: options.offset,
    paddingX: options.paddingX,
    paddingY: options.paddingY,
    radius: options.radius,
    fontSize: options.fontSize,
    fontWeight: options.fontWeight,
    style: {
      fill: visualValue(
        options.color,
        datum,
        datumIndex,
        data,
        context.theme.background
      )
    },
    boxStyle: {
      fill: visualValue(
        options.background,
        datum,
        datumIndex,
        data,
        context.theme.foreground
      ),
      stroke: visualValue(
        options.stroke,
        datum,
        datumIndex,
        data,
        context.theme.background
      ),
      strokeWidth: nonnegative(options.strokeWidth, 1)
    }
  };
}
function nonnegative(value, fallback) {
  return value !== void 0 && Number.isFinite(value) && value >= 0 ? value : fallback;
}
export {
  focusGuideX,
  focusGuideY
};
