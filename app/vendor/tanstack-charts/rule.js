import {
  channelValues,
  createMark,
  isChartKey,
  isChartValue,
  visualValue
} from "./mark.js";
import { valueKey } from "./scales.js";
function ruleY(source, options = {}) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `rule-y-${markIndex}`;
    const values = channelValues(
      data,
      options.y,
      (datum) => isChartValue(datum) ? datum : void 0
    );
    const colorValues = channelValues(data, options.color, () => null);
    return {
      id,
      channels: {
        y: { scale: "y", values: values.filter(isChartValue) },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ scales, chart, theme, color: resolveColor }) => {
        const children = [];
        const focusAnchors = [];
        data.forEach((datum, index) => {
          const yValue = values[index];
          if (!isChartValue(yValue)) return;
          const key = `${id}:${valueKey(yValue)}:${index}`;
          children.push({
            kind: "rule",
            key,
            x1: chart.x,
            x2: chart.x + chart.width,
            y1: scales.y.map(yValue),
            y2: scales.y.map(yValue),
            style: {
              stroke: visualValue(
                options.stroke,
                datum,
                index,
                data,
                colorValues[index] == null ? theme.foreground : resolveColor(colorValues[index])
              ),
              strokeOpacity: options.strokeOpacity ?? 0.5,
              strokeWidth: options.strokeWidth,
              strokeDasharray: options.strokeDasharray
            }
          });
          focusAnchors.push({
            key,
            markId: id,
            group: isChartKey(colorValues[index]) ? colorValues[index] : null,
            datum,
            datumIndex: index,
            yValue
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__rule ts-chart__rule-y",
              ariaHidden: true,
              children
            }
          ],
          focusAnchors
        };
      }
    };
  }, options.motion);
}
function ruleX(source, options = {}) {
  const data = Array.isArray(source) ? source : Array.from(source);
  return createMark(({ markIndex }) => {
    const id = options.id ?? `rule-x-${markIndex}`;
    const values = channelValues(
      data,
      options.x,
      (datum) => isChartValue(datum) ? datum : void 0
    );
    const colorValues = channelValues(data, options.color, () => null);
    return {
      id,
      channels: {
        x: { scale: "x", values: values.filter(isChartValue) },
        color: {
          scale: "color",
          values: colorValues.filter(isChartKey)
        }
      },
      render: ({ scales, chart, theme, color: resolveColor }) => {
        const children = [];
        const focusAnchors = [];
        data.forEach((datum, index) => {
          const xValue = values[index];
          if (!isChartValue(xValue)) return;
          const key = `${id}:${valueKey(xValue)}:${index}`;
          children.push({
            kind: "rule",
            key,
            x1: scales.x.map(xValue),
            x2: scales.x.map(xValue),
            y1: chart.y,
            y2: chart.y + chart.height,
            style: {
              stroke: visualValue(
                options.stroke,
                datum,
                index,
                data,
                colorValues[index] == null ? theme.foreground : resolveColor(colorValues[index])
              ),
              strokeOpacity: options.strokeOpacity ?? 0.5,
              strokeWidth: options.strokeWidth,
              strokeDasharray: options.strokeDasharray
            }
          });
          focusAnchors.push({
            key,
            markId: id,
            group: isChartKey(colorValues[index]) ? colorValues[index] : null,
            datum,
            datumIndex: index,
            xValue
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: "ts-chart__rule ts-chart__rule-x",
              ariaHidden: true,
              children
            }
          ],
          focusAnchors
        };
      }
    };
  }, options.motion);
}
export {
  ruleX,
  ruleY
};
