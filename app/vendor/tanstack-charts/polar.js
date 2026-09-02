import {
  arc as createArc,
  areaRadial as createAreaRadial,
  curveLinearClosed,
  lineRadial as createLineRadial,
  pointRadial
} from "d3-shape";
import {
  channelValues,
  inferredKeyValues,
  isChartKey,
  isChartValue,
  isFiniteNumber,
  isNonnegativeFiniteNumber,
  visualValue
} from "./mark.js";
import { resolveCompositeChildMotion } from "./composite-motion-internal.js";
import { createMarkWithScaleValues } from "./mark-with-scale-values.js";
import { createPolarMark } from "./polar-mark-internal.js";
import { resolvePolarSector } from "./polar-sector-internal.js";
import { resolveNumericScale, resolveScaleInput } from "./scale-input.js";
import { valueKey } from "./scales.js";
import { pie } from "./polar-pie.js";
const tau = Math.PI * 2;
function polar(options) {
  return createMarkWithScaleValues(
    ({ markIndex }) => {
      const id = options.id ?? `polar-${markIndex}`;
      const marks = options.marks.map(
        (mark, polarMarkIndex) => mark.initialize({ markIndex: polarMarkIndex, parentId: id })
      );
      const childMotions = new Map(
        marks.flatMap((mark, markIndex2) => {
          const childMotion = mark.motion ?? options.marks[markIndex2]?.motion;
          return childMotion === void 0 ? [] : [[mark.id, childMotion]];
        })
      );
      const motion = options.motion !== void 0 || childMotions.size > 0 ? (context) => resolveCompositeChildMotion(options.motion, childMotions, context) : void 0;
      return {
        id,
        ...motion === void 0 ? {} : { motion },
        channels: {
          color: {
            scale: "color",
            values: marks.flatMap((mark) => mark.colorValues)
          }
        },
        render: ({ chart, color, theme }) => {
          const layout = resolvePolarLayout(options, chart, marks);
          if (marks.some((mark) => mark.requiresAngleScale) && !layout.angle) {
            throw new TypeError(
              `Polar mark in "${id}" requires a configured angle scale`
            );
          }
          if (marks.some((mark) => mark.requiresRadiusScale) && !layout.radiusScale) {
            throw new TypeError(
              `Polar mark in "${id}" requires a configured radius scale`
            );
          }
          const nodes = [];
          const guideForeground = [];
          const points = [];
          for (const [guideIndex, guide] of (options.guides ?? []).entries()) {
            const rendered = guide.render({
              layout,
              theme,
              guideIndex,
              parentId: id
            });
            for (const node of rendered.background) nodes.push(node);
            for (const node of rendered.foreground ?? []) {
              guideForeground.push(node);
            }
          }
          for (const mark of marks) {
            const rendered = mark.render({ layout, color, theme });
            for (const node of rendered.nodes) nodes.push(node);
            for (const point of rendered.points ?? []) points.push(point);
          }
          for (const node of guideForeground) nodes.push(node);
          return {
            nodes: [
              {
                kind: "group",
                key: id,
                className: classes("ts-chart__polar", options.className),
                translateX: layout.centerX,
                translateY: layout.centerY,
                ariaHidden: true,
                children: nodes
              }
            ],
            points
          };
        }
      };
    },
    options.motion
  );
}
function radialArc(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:arc-${markIndex}`;
    const startAngles = channelValues(
      data,
      options.startAngle,
      (datum) => numberProperty(datum, "startAngle")
    );
    const endAngles = channelValues(
      data,
      options.endAngle,
      (datum) => numberProperty(datum, "endAngle")
    );
    const padAngles = channelValues(
      data,
      options.padAngle,
      (datum) => numberProperty(datum, "padAngle") ?? 0
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, { groups });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: [],
      radiusValues: [],
      includeZeroRadius: false,
      requiresAngleScale: false,
      requiresRadiusScale: false,
      render: ({ layout, color: resolveColor }) => {
        const innerRadius = resolveLength(options.innerRadius, layout, 0);
        const outerRadius = resolveLength(
          options.outerRadius,
          layout,
          layout.radius
        );
        const generator = options.generator?.(layout) ?? createArc().startAngle((_datum, index) => startAngles[index] ?? 0).endAngle((_datum, index) => endAngles[index] ?? 0).padAngle((_datum, index) => padAngles[index] ?? 0).innerRadius(innerRadius).outerRadius(outerRadius).cornerRadius(resolveLength(options.cornerRadius, layout, 0));
        if (options.padRadius !== void 0 && !options.generator) {
          generator.padRadius(resolveLength(options.padRadius, layout, 0));
        }
        const nodes = [];
        const points = [];
        data.forEach((datum, datumIndex) => {
          const startAngle = startAngles[datumIndex];
          const endAngle = endAngles[datumIndex];
          const padAngle = padAngles[datumIndex];
          if (!options.generator && (!isFiniteNumber(startAngle) || !isFiniteNumber(endAngle) || !isFiniteNumber(padAngle))) {
            return;
          }
          const path = generator(datum, datumIndex, data);
          if (typeof path !== "string" || !path) return;
          const group = groups[datumIndex] ?? null;
          const fallback = resolveColor(colorValues[datumIndex] ?? null);
          const fill = visualValue(
            options.fill,
            datum,
            datumIndex,
            data,
            fallback
          );
          const stroke = options.stroke === void 0 ? void 0 : visualValue(options.stroke, datum, datumIndex, data, fallback);
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          const generatedStart = generator.startAngle()(datum, datumIndex, data);
          const generatedEnd = generator.endAngle()(datum, datumIndex, data);
          const generatedInner = generator.innerRadius()(
            datum,
            datumIndex,
            data
          );
          const generatedOuter = generator.outerRadius()(
            datum,
            datumIndex,
            data
          );
          const centroid = generator.centroid(datum, datumIndex, data);
          const angleValue = (generatedStart + generatedEnd) / 2;
          const radiusValue = (generatedInner + generatedOuter) / 2;
          nodes.push({
            kind: "area",
            key,
            points: [],
            path,
            style: {
              fill,
              fillOpacity: options.fillOpacity,
              stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth,
              strokeDasharray: options.strokeDasharray,
              opacity: options.opacity,
              lineJoin: "round"
            }
          });
          points.push({
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue: angleValue,
            yValue: radiusValue,
            x: layout.centerX + centroid[0],
            y: layout.centerY + centroid[1],
            color: fill
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes("ts-chart__arc", options.className),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialBarRadius(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-bar-radius-${markIndex}`;
    const angleValues = channelValues(
      data,
      options.angle,
      (_datum, { index }) => index
    );
    const rawRadiusValues = numericPolarChannelValues(
      data,
      options.radius ?? options.radius2,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const radius1Values = numericPolarChannelValues(
      data,
      options.radius1,
      () => 0
    );
    const radius2Values = numericPolarChannelValues(
      data,
      options.radius2 ?? options.radius,
      (_datum, { index }) => rawRadiusValues[index]
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, {
      groups,
      candidates: [angleValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: [
        ...radius1Values.filter(isFiniteNumber),
        ...radius2Values.filter(isFiniteNumber)
      ],
      includeZeroRadius: options.radius1 === void 0,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor }) => {
        const angle = requiredBandScale(layout.angle, "angle", id);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        const points = [];
        data.forEach((datum, datumIndex) => {
          const angleValue = angleValues[datumIndex];
          const radiusValue = rawRadiusValues[datumIndex];
          const radius1Value = radius1Values[datumIndex];
          const radius2Value = radius2Values[datumIndex];
          if (!isChartValue(angleValue) || !isFiniteNumber(radiusValue) || !isFiniteNumber(radius1Value) || !isFiniteNumber(radius2Value)) {
            return;
          }
          const angleBand = resolvePolarBand(angle, angleValue);
          const mappedRadius1 = options.radius1 === void 0 ? 0 : mapPolarScale(radius, radius1Value);
          const mappedRadius2 = mapPolarScale(radius, radius2Value);
          if (!angleBand || !isNonnegativeFiniteNumber(mappedRadius1) || !isNonnegativeFiniteNumber(mappedRadius2)) {
            return;
          }
          const cornerRadius = resolveBarCornerRadius(
            options.cornerRadius,
            layout,
            mappedRadius1,
            mappedRadius2
          );
          const sector = resolvePolarSector({
            startAngle: angleBand.start,
            endAngle: angleBand.end,
            innerRadius: mappedRadius1,
            outerRadius: mappedRadius2,
            cornerRadius
          });
          if (!sector) return;
          const group = groups[datumIndex] ?? null;
          const fallback = resolveColor(colorValues[datumIndex] ?? null);
          const fill = visualValue(
            options.fill,
            datum,
            datumIndex,
            data,
            fallback
          );
          const stroke = options.stroke === void 0 ? void 0 : visualValue(options.stroke, datum, datumIndex, data, fallback);
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          const [pointX, pointY] = pointRadial(angleBand.center, mappedRadius2);
          const point = {
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue: angleValue,
            yValue: radiusValue,
            y1Value: radius1Value,
            y2Value: radius2Value,
            yInterval: "difference",
            x: layout.centerX + pointX,
            y: layout.centerY + pointY,
            color: fill
          };
          nodes.push({
            kind: "area",
            key,
            points: sector.points,
            path: sector.path,
            interaction: { point, affinity: "geometry" },
            style: {
              fill,
              fillOpacity: options.fillOpacity,
              stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth,
              strokeDasharray: options.strokeDasharray,
              opacity: options.opacity,
              lineJoin: "round"
            }
          });
          points.push(point);
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__arc ts-chart__bar ts-chart__radial-bar ts-chart__radial-bar-radius",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialBarAngle(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-bar-angle-${markIndex}`;
    const rawAngleValues = numericPolarChannelValues(
      data,
      options.angle ?? options.angle2,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const angle1Values = numericPolarChannelValues(
      data,
      options.angle1,
      () => 0
    );
    const angle2Values = numericPolarChannelValues(
      data,
      options.angle2 ?? options.angle,
      (_datum, { index }) => rawAngleValues[index]
    );
    const radiusValues = channelValues(
      data,
      options.radius,
      (_datum, { index }) => index
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, {
      groups,
      candidates: [radiusValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: [
        ...angle1Values.filter(isFiniteNumber),
        ...angle2Values.filter(isFiniteNumber)
      ],
      radiusValues: radiusValues.filter(isChartValue),
      includeZeroRadius: false,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredBandScale(layout.radiusScale, "radius", id);
        const nodes = [];
        const points = [];
        data.forEach((datum, datumIndex) => {
          const angleValue = rawAngleValues[datumIndex];
          const angle1Value = angle1Values[datumIndex];
          const angle2Value = angle2Values[datumIndex];
          const radiusValue = radiusValues[datumIndex];
          if (!isFiniteNumber(angleValue) || !isFiniteNumber(angle1Value) || !isFiniteNumber(angle2Value) || !isChartValue(radiusValue)) {
            return;
          }
          const mappedAngle1 = mapPolarScale(angle, angle1Value);
          const mappedAngle2 = mapPolarScale(angle, angle2Value);
          const radiusBand = resolvePolarBand(radius, radiusValue);
          if (!isFiniteNumber(mappedAngle1) || !isFiniteNumber(mappedAngle2) || !radiusBand) {
            return;
          }
          const cornerRadius = resolveBarCornerRadius(
            options.cornerRadius,
            layout,
            radiusBand.start,
            radiusBand.end
          );
          const sector = resolvePolarSector({
            startAngle: mappedAngle1,
            endAngle: mappedAngle2,
            innerRadius: radiusBand.start,
            outerRadius: radiusBand.end,
            cornerRadius
          });
          if (!sector) return;
          const group = groups[datumIndex] ?? null;
          const fallback = resolveColor(colorValues[datumIndex] ?? null);
          const fill = visualValue(
            options.fill,
            datum,
            datumIndex,
            data,
            fallback
          );
          const stroke = options.stroke === void 0 ? void 0 : visualValue(options.stroke, datum, datumIndex, data, fallback);
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          const [pointX, pointY] = pointRadial(mappedAngle2, radiusBand.center);
          const point = {
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue: angleValue,
            yValue: radiusValue,
            x1Value: angle1Value,
            x2Value: angle2Value,
            xInterval: "difference",
            x: layout.centerX + pointX,
            y: layout.centerY + pointY,
            color: fill
          };
          nodes.push({
            kind: "area",
            key,
            points: sector.points,
            path: sector.path,
            interaction: { point, affinity: "geometry" },
            style: {
              fill,
              fillOpacity: options.fillOpacity,
              stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth,
              strokeDasharray: options.strokeDasharray,
              opacity: options.opacity,
              lineJoin: "round"
            }
          });
          points.push(point);
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__arc ts-chart__bar ts-chart__radial-bar ts-chart__radial-bar-angle",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialLine(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-line-${markIndex}`;
    const angleValues = typeof options.angle === "number" ? data.map(() => options.angle) : channelValues(data, options.angle, (_datum, { index }) => index);
    const radiusValues = typeof options.radius === "number" ? data.map(() => options.radius) : channelValues(
      data,
      options.radius,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const zValues = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
    const groups = options.z === void 0 && options.color !== void 0 ? colorValues : zValues;
    const keys = inferredKeyValues(data, options.key, {
      groups,
      candidates: [angleValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: radiusValues.filter(isChartValue),
      includeZeroRadius: false,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        const points = [];
        for (const [groupKey, indices] of groupIndices(groups)) {
          const firstIndex = indices[0];
          if (firstIndex === void 0) continue;
          const group = groups[firstIndex] ?? null;
          const stroke = visualValue(
            options.stroke,
            data[firstIndex],
            firstIndex,
            data,
            resolveColor(colorValues[firstIndex] ?? null)
          );
          const rows = indices.map((datumIndex) => ({
            datumIndex,
            angleValue: angleValues[datumIndex],
            radiusValue: radiusValues[datumIndex],
            angle: mapPolarScale(angle, angleValues[datumIndex]),
            radius: mapPolarScale(radius, radiusValues[datumIndex])
          }));
          const generator = createLineRadial().defined(
            (row) => isFiniteNumber(row.angle) && isFiniteNumber(row.radius)
          ).angle((row) => row.angle).radius((row) => row.radius);
          if (options.curve) generator.curve(options.curve);
          const path = generator(rows);
          if (typeof path === "string" && path) {
            nodes.push({
              kind: "polyline",
              key: `${id}:${groupKey}`,
              points: [],
              path,
              style: {
                fill: "none",
                stroke,
                strokeOpacity: options.strokeOpacity,
                strokeWidth: options.strokeWidth ?? 2.25,
                strokeDasharray: options.strokeDasharray,
                opacity: options.opacity,
                lineCap: "round",
                lineJoin: "round"
              }
            });
          }
          for (const row of rows) {
            if (!isChartValue(row.angleValue) || !isChartValue(row.radiusValue) || !isFiniteNumber(row.angle) || !isFiniteNumber(row.radius)) {
              continue;
            }
            const [x, y] = pointRadial(row.angle, row.radius);
            const key = `${id}:${groupKey}:${valueKey(keys[row.datumIndex])}`;
            const point = {
              key,
              markId: id,
              group,
              groupLabel: group == null ? id : String(group),
              datum: data[row.datumIndex],
              datumIndex: row.datumIndex,
              xValue: row.angleValue,
              yValue: row.radiusValue,
              x: layout.centerX + x,
              y: layout.centerY + y,
              color: stroke
            };
            points.push(point);
            if (options.points) {
              nodes.push({
                kind: "dot",
                key: `${key}:dot`,
                x,
                y,
                radius: 2.5,
                pointOwner: point,
                style: { fill: stroke }
              });
            }
          }
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__radial-line ts-chart__line",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialArea(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-area-${markIndex}`;
    const angleValues = typeof options.angle === "number" ? data.map(() => options.angle) : channelValues(data, options.angle, (_datum, { index }) => index);
    const radiusValues = typeof options.radius === "number" ? data.map(() => options.radius) : channelValues(
      data,
      options.radius,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const radius1Values = typeof options.radius1 === "number" ? data.map(() => options.radius1) : channelValues(data, options.radius1, () => 0);
    const zValues = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? zValues : channelValues(data, options.color, () => null);
    const groups = options.z === void 0 && options.color !== void 0 ? colorValues : zValues;
    const keys = inferredKeyValues(data, options.key, {
      groups,
      candidates: [angleValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: [
        ...radiusValues.filter(isChartValue),
        ...radius1Values.filter(isChartValue)
      ],
      includeZeroRadius: options.radius1 === void 0,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        const points = [];
        for (const [groupKey, indices] of groupIndices(groups)) {
          const firstIndex = indices[0];
          if (firstIndex === void 0) continue;
          const datum = data[firstIndex];
          const group = groups[firstIndex] ?? null;
          const fallback = resolveColor(colorValues[firstIndex] ?? null);
          const fill = visualValue(
            options.fill,
            datum,
            firstIndex,
            data,
            fallback
          );
          const stroke = options.stroke === void 0 ? void 0 : visualValue(options.stroke, datum, firstIndex, data, fallback);
          const rows = indices.map((datumIndex) => ({
            datumIndex,
            angleValue: angleValues[datumIndex],
            radiusValue: radiusValues[datumIndex],
            angle: mapPolarScale(angle, angleValues[datumIndex]),
            radius: mapPolarScale(radius, radiusValues[datumIndex]),
            radius1: mapPolarScale(radius, radius1Values[datumIndex])
          }));
          const generator = createAreaRadial().defined(
            (row) => isFiniteNumber(row.angle) && isFiniteNumber(row.radius) && isFiniteNumber(row.radius1)
          ).angle((row) => row.angle).innerRadius((row) => row.radius1).outerRadius((row) => row.radius);
          if (options.curve) generator.curve(options.curve);
          const path = generator(rows);
          if (typeof path === "string" && path) {
            nodes.push({
              kind: "area",
              key: `${id}:${groupKey}`,
              points: [],
              path,
              style: {
                fill,
                fillOpacity: options.fillOpacity ?? 0.2,
                stroke,
                strokeOpacity: options.strokeOpacity,
                strokeWidth: options.strokeWidth,
                strokeDasharray: options.strokeDasharray,
                opacity: options.opacity,
                lineJoin: "round"
              }
            });
          }
          for (const row of rows) {
            if (!isChartValue(row.angleValue) || !isChartValue(row.radiusValue) || !isFiniteNumber(row.angle) || !isFiniteNumber(row.radius)) {
              continue;
            }
            const [x, y] = pointRadial(row.angle, row.radius);
            const key = `${id}:${groupKey}:${valueKey(keys[row.datumIndex])}`;
            points.push({
              key,
              markId: id,
              group,
              groupLabel: group == null ? id : String(group),
              datum: data[row.datumIndex],
              datumIndex: row.datumIndex,
              xValue: row.angleValue,
              yValue: row.radiusValue,
              x: layout.centerX + x,
              y: layout.centerY + y,
              color: fill
            });
          }
        }
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes("ts-chart__radial-area", options.className),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialText(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-text-${markIndex}`;
    const angleValues = typeof options.angle === "number" ? data.map(() => options.angle) : channelValues(data, options.angle, (_datum, { index }) => index);
    const radiusValues = typeof options.radius === "number" ? data.map(() => options.radius) : channelValues(
      data,
      options.radius,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const textValues = channelValues(
      data,
      options.text,
      (datum) => datum == null ? "" : String(datum)
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, { groups });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: radiusValues.filter(isChartValue),
      includeZeroRadius: false,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor, theme }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        const points = [];
        data.forEach((datum, datumIndex) => {
          const angleValue = angleValues[datumIndex];
          const radiusValue = radiusValues[datumIndex];
          const textValue = textValues[datumIndex];
          const anglePosition = mapPolarScale(angle, angleValue);
          const radiusPosition = mapPolarScale(radius, radiusValue);
          if (!isChartValue(angleValue) || !isChartValue(radiusValue) || textValue == null || !isFiniteNumber(anglePosition) || !isFiniteNumber(radiusPosition)) {
            return;
          }
          const radiusOffset = visualValue(
            options.radiusOffset,
            datum,
            datumIndex,
            data,
            0
          );
          const projectedRadius = radiusPosition + radiusOffset;
          if (!isFiniteNumber(radiusOffset) || !isFiniteNumber(projectedRadius)) {
            return;
          }
          const [baseX, baseY] = pointRadial(anglePosition, projectedRadius);
          const x = baseX + visualValue(options.dx, datum, datumIndex, data, 0);
          const y = baseY + visualValue(options.dy, datum, datumIndex, data, 0);
          const group = groups[datumIndex] ?? null;
          const colorValue = colorValues[datumIndex] ?? null;
          const fill = visualValue(
            options.fill,
            datum,
            datumIndex,
            data,
            colorValue == null ? theme.foreground : resolveColor(colorValue)
          );
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          const authoredAnchor = visualValue(
            options.anchor,
            datum,
            datumIndex,
            data,
            "middle"
          );
          nodes.push({
            kind: "label",
            key,
            x,
            y,
            text: String(textValue),
            anchor: authoredAnchor === "outside" ? outsideRadialAnchor(anglePosition) : authoredAnchor,
            baseline: visualValue(
              options.baseline,
              datum,
              datumIndex,
              data,
              "middle"
            ),
            rotate: options.rotate === void 0 ? void 0 : visualValue(options.rotate, datum, datumIndex, data, 0),
            fontSize: options.fontSize,
            fontWeight: options.fontWeight,
            style: { fill }
          });
          points.push({
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue: angleValue,
            yValue: radiusValue,
            x: layout.centerX + x,
            y: layout.centerY + y,
            color: fill
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__radial-text ts-chart__text",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialRule(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-rule-${markIndex}`;
    const angleValues = typeof options.angle === "number" ? data.map(() => options.angle) : channelValues(data, options.angle, (_datum, { index }) => index);
    const radius1Values = typeof options.radius1 === "number" ? data.map(() => options.radius1) : channelValues(data, options.radius1, () => 0);
    const radius2Values = typeof options.radius2 === "number" ? data.map(() => options.radius2) : channelValues(
      data,
      options.radius2,
      (datum) => typeof datum === "number" ? datum : numberProperty(datum, "radius2")
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, {
      groups,
      candidates: [angleValues],
      markId: id,
      warningIdentity: options
    });
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: [
        ...radius1Values.filter(isChartValue),
        ...radius2Values.filter(isChartValue)
      ],
      includeZeroRadius: options.radius1 === void 0,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor, theme }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        data.forEach((datum, datumIndex) => {
          const anglePosition = mapPolarScale(angle, angleValues[datumIndex]);
          const radius1Position = mapPolarScale(
            radius,
            radius1Values[datumIndex]
          );
          const radius2Position = mapPolarScale(
            radius,
            radius2Values[datumIndex]
          );
          if (!isFiniteNumber(anglePosition) || !isFiniteNumber(radius1Position) || !isFiniteNumber(radius2Position)) {
            return;
          }
          const radius1Offset = visualValue(
            options.radius1Offset,
            datum,
            datumIndex,
            data,
            0
          );
          const radius2Offset = visualValue(
            options.radius2Offset,
            datum,
            datumIndex,
            data,
            0
          );
          const projectedRadius1 = radius1Position + radius1Offset;
          const projectedRadius2 = radius2Position + radius2Offset;
          if (!isFiniteNumber(radius1Offset) || !isFiniteNumber(radius2Offset) || !isFiniteNumber(projectedRadius1) || !isFiniteNumber(projectedRadius2)) {
            return;
          }
          const [x1, y1] = pointRadial(anglePosition, projectedRadius1);
          const [x2, y2] = pointRadial(anglePosition, projectedRadius2);
          const group = groups[datumIndex] ?? null;
          const colorValue = colorValues[datumIndex] ?? null;
          const stroke = visualValue(
            options.stroke,
            datum,
            datumIndex,
            data,
            colorValue == null ? theme.foreground : resolveColor(colorValue)
          );
          nodes.push({
            kind: "rule",
            key: `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`,
            x1,
            y1,
            x2,
            y2,
            style: {
              stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth ?? 1.5,
              strokeDasharray: options.strokeDasharray,
              opacity: options.opacity,
              lineCap: "round"
            }
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__radial-rule ts-chart__rule",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ]
        };
      }
    };
  }, options.motion);
}
function radialDot(source, options = {}) {
  const data = asArray(source);
  return createPolarMark(({ markIndex, parentId }) => {
    const id = options.id ?? `${parentId}:radial-dot-${markIndex}`;
    const angleValues = typeof options.angle === "number" ? data.map(() => options.angle) : channelValues(data, options.angle, (_datum, { index }) => index);
    const radiusValues = typeof options.radius === "number" ? data.map(() => options.radius) : channelValues(
      data,
      options.radius,
      (datum) => typeof datum === "number" ? datum : void 0
    );
    const groups = channelValues(data, options.z, () => null);
    const colorValues = options.color === void 0 ? groups : channelValues(data, options.color, () => null);
    const keys = inferredKeyValues(data, options.key, { groups });
    const rawRadii = typeof options.r === "number" ? data.map(() => options.r) : channelValues(data, options.r, () => 3.5);
    const radiusMapper = resolveNumericScale(options.rScale, rawRadii);
    const radii = radiusMapper ? rawRadii.map(
      (value) => isNonnegativeFiniteNumber(value) ? radiusMapper(value) : Number.NaN
    ) : rawRadii;
    return {
      id,
      colorValues: colorValues.filter(isChartKey),
      angleValues: angleValues.filter(isChartValue),
      radiusValues: radiusValues.filter(isChartValue),
      includeZeroRadius: false,
      requiresAngleScale: true,
      requiresRadiusScale: true,
      render: ({ layout, color: resolveColor }) => {
        const angle = requiredScale(layout.angle);
        const radius = requiredScale(layout.radiusScale);
        const nodes = [];
        const points = [];
        data.forEach((datum, datumIndex) => {
          const angleValue = angleValues[datumIndex];
          const radiusValue = radiusValues[datumIndex];
          const anglePosition = mapPolarScale(angle, angleValue);
          const radiusPosition = mapPolarScale(radius, radiusValue);
          const dotRadius = radii[datumIndex];
          if (!isChartValue(angleValue) || !isChartValue(radiusValue) || !isFiniteNumber(anglePosition) || !isFiniteNumber(radiusPosition) || !isNonnegativeFiniteNumber(dotRadius)) {
            return;
          }
          const [x, y] = pointRadial(anglePosition, radiusPosition);
          const group = groups[datumIndex] ?? null;
          const fill = visualValue(
            options.fill,
            datum,
            datumIndex,
            data,
            resolveColor(colorValues[datumIndex] ?? null)
          );
          const key = `${id}:${valueKey(group)}:${valueKey(keys[datumIndex])}`;
          nodes.push({
            kind: "dot",
            key,
            x,
            y,
            radius: dotRadius,
            style: {
              fill,
              fillOpacity: options.fillOpacity,
              stroke: options.stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth,
              opacity: options.opacity
            }
          });
          points.push({
            key,
            markId: id,
            group,
            groupLabel: group == null ? id : String(group),
            datum,
            datumIndex,
            xValue: angleValue,
            yValue: radiusValue,
            x: layout.centerX + x,
            y: layout.centerY + y,
            color: fill
          });
        });
        return {
          nodes: [
            {
              kind: "group",
              key: id,
              className: classes(
                "ts-chart__radial-dot ts-chart__dot",
                options.className
              ),
              ariaHidden: true,
              children: nodes
            }
          ],
          points
        };
      }
    };
  }, options.motion);
}
function radialGrid(options = {}) {
  return {
    render: ({ layout, theme, guideIndex, parentId }) => {
      const radial = requiredScale(layout.radiusScale);
      const values = options.values ?? radial.ticks(options.ticks ?? 5);
      const stroke = options.stroke ?? theme.grid;
      const rings = [];
      const labels = [];
      for (const [index, value] of values.entries()) {
        const radius = radial.map(value);
        if (!isFiniteNumber(radius)) continue;
        let path;
        if (options.shape === "polygon") {
          if (!layout.angle) {
            throw new TypeError(
              "Polygon radial grid requires a configured angle scale"
            );
          }
          path = polygonRingPath(layout.angle, radius);
        } else {
          path = createArc().innerRadius(0).outerRadius(radius).startAngle(0).endAngle(tau)(null);
        }
        if (typeof path === "string" && path) {
          rings.push({
            kind: "polyline",
            key: `ring:${valueKey(value)}`,
            points: [],
            path,
            style: {
              fill: "none",
              stroke,
              strokeOpacity: options.strokeOpacity,
              strokeWidth: options.strokeWidth ?? 1,
              strokeDasharray: options.strokeDasharray
            }
          });
        }
        if (options.labels) {
          const angle = options.labelAngle ?? layout.startAngle;
          const [x, y] = pointRadial(angle, radius + (options.labelOffset ?? 0));
          const labelContext = {
            value,
            index,
            angle,
            radius,
            x,
            y,
            layout
          };
          labels.push({
            kind: "label",
            key: `radius-label:${valueKey(value)}`,
            x: x + guideLabelOption(options.labelDx, labelContext, 0),
            y: y + guideLabelOption(options.labelDy, labelContext, 0),
            text: options.format?.(value) ?? String(value),
            anchor: guideLabelOption(
              options.labelAnchor,
              labelContext,
              "start"
            ),
            baseline: guideLabelOption(
              options.labelBaseline,
              labelContext,
              "middle"
            ),
            rotate: guideLabelOption(options.labelRotate, labelContext, 0),
            fontSize: options.labelFontSize ?? 12,
            style: { fill: options.labelFill ?? theme.muted }
          });
        }
      }
      const id = options.id ?? `${parentId}:radial-grid-${guideIndex}`;
      return {
        background: [
          {
            kind: "group",
            key: id,
            className: classes("ts-chart__radial-grid", options.className),
            ariaHidden: true,
            children: rings
          }
        ],
        foreground: labels.length ? [
          {
            kind: "group",
            key: `${id}:labels`,
            className: classes("ts-chart__text", options.labelClassName),
            ariaHidden: true,
            children: labels
          }
        ] : void 0
      };
    }
  };
}
function angleGrid(options = {}) {
  return {
    render: ({ layout, theme, guideIndex, parentId }) => {
      const angle = requiredScale(layout.angle);
      const values = options.values ?? angle.domain;
      const spokes = [];
      const labels = [];
      for (const [index, value] of values.entries()) {
        const position = angle.map(value);
        if (!isFiniteNumber(position)) continue;
        const [x2, y2] = pointRadial(position, layout.radius);
        spokes.push({
          kind: "rule",
          key: `spoke:${valueKey(value)}`,
          x1: 0,
          y1: 0,
          x2,
          y2,
          style: {
            stroke: options.stroke ?? theme.grid,
            strokeOpacity: options.strokeOpacity,
            strokeWidth: options.strokeWidth ?? 1,
            strokeDasharray: options.strokeDasharray
          }
        });
        if (options.labels !== false) {
          const [x, y] = pointRadial(
            position,
            layout.radius + (options.labelOffset ?? 8)
          );
          const labelContext = {
            value,
            index,
            angle: position,
            radius: layout.radius,
            x,
            y,
            layout
          };
          labels.push({
            kind: "label",
            key: `angle-label:${valueKey(value)}`,
            x: x + guideLabelOption(options.labelDx, labelContext, 0),
            y: y + guideLabelOption(options.labelDy, labelContext, 0),
            text: options.format?.(value) ?? String(value),
            anchor: guideLabelOption(
              options.labelAnchor,
              labelContext,
              outsideRadialAnchor(position)
            ),
            baseline: guideLabelOption(
              options.labelBaseline,
              labelContext,
              Math.abs(y) < 1 ? "middle" : y < 0 ? "auto" : "hanging"
            ),
            rotate: guideLabelOption(options.labelRotate, labelContext, 0),
            fontSize: options.labelFontSize ?? 12,
            style: { fill: options.labelFill ?? theme.muted }
          });
        }
      }
      const id = options.id ?? `${parentId}:angle-grid-${guideIndex}`;
      return {
        background: [
          {
            kind: "group",
            key: id,
            className: classes("ts-chart__angle-grid", options.className),
            ariaHidden: true,
            children: spokes
          }
        ],
        foreground: labels.length ? [
          {
            kind: "group",
            key: `${id}:labels`,
            className: classes("ts-chart__text", options.labelClassName),
            ariaHidden: true,
            children: labels
          }
        ] : void 0
      };
    }
  };
}
function resolvePolarLayout(options, chart, marks) {
  const startAngle = finite(options.startAngle, 0);
  const endAngle = finite(options.endAngle, tau);
  const inset = Math.max(0, finite(options.inset, 0));
  const radiusRatio = Math.max(0, finite(options.radiusRatio, 1));
  const radius = Math.max(0, Math.min(chart.width, chart.height) / 2 - inset) * radiusRatio;
  const layout = {
    chart,
    centerX: chart.x + chart.width / 2,
    centerY: chart.y + chart.height / 2,
    radius,
    startAngle,
    endAngle
  };
  if (options.angle) {
    const wrapPointScale = options.angle.wrap ?? isCompleteRevolution(startAngle, endAngle);
    layout.angle = resolvePolarScale(
      options.angle.scale,
      collectPolarValues(marks, "angleValues"),
      startAngle,
      endAngle,
      wrapPointScale,
      false,
      options.angle.nice
    );
  }
  if (options.radius) {
    const [rangeStart, rangeEnd] = resolvePolarRadiusRange(
      options.radius.range,
      layout
    );
    layout.radiusScale = resolvePolarScale(
      options.radius.scale,
      collectPolarValues(marks, "radiusValues"),
      rangeStart,
      rangeEnd,
      false,
      marks.some((mark) => mark.includeZeroRadius),
      options.radius.nice
    );
  }
  return layout;
}
function resolvePolarScale(source, values, rangeStart, rangeEnd, wrapPointScale, includeZero, nice) {
  const scale = resolveScaleInput(source, {
    values,
    includeZero,
    nice,
    niceCount: 5
  });
  const domain = scale.domain().filter(isChartValue);
  const pointScale = wrapPointScale && typeof scale.bandwidth === "function" && scale.bandwidth() === 0;
  const resolvedEnd = pointScale ? domain.length > 1 ? rangeStart + (rangeEnd - rangeStart) * (domain.length - 1) / domain.length : rangeStart : rangeEnd;
  scale.range([rangeStart, resolvedEnd]);
  const bandwidth = scale.bandwidth?.() ?? 0;
  const map = (value) => {
    const position = scale(value);
    return typeof position === "number" && Number.isFinite(position) ? position + bandwidth / 2 : Number.NaN;
  };
  return {
    domain,
    map,
    ticks: (count) => (scale.ticks?.(count) ?? domain).filter(isChartValue),
    bandwidth
  };
}
function collectPolarValues(marks, key) {
  const values = [];
  for (const mark of marks) {
    for (const value of mark[key]) values.push(value);
  }
  return values;
}
function polygonRingPath(angle, radius) {
  const rows = angle.domain.map((value) => ({
    angle: angle.map(value),
    radius
  }));
  return createLineRadial().angle((row) => row.angle).radius((row) => row.radius).curve(curveLinearClosed)(rows) ?? "";
}
function groupIndices(groups) {
  const result = /* @__PURE__ */ new Map();
  groups.forEach((group, index) => {
    const key = valueKey(group ?? null);
    const indices = result.get(key);
    if (indices) indices.push(index);
    else result.set(key, [index]);
  });
  return result;
}
function requiredScale(scale) {
  if (!scale) throw new TypeError("Missing configured polar scale");
  return scale;
}
function requiredBandScale(scale, axis, markId) {
  const resolved = requiredScale(scale);
  if (!isFiniteNumber(resolved.bandwidth) || resolved.bandwidth <= 0) {
    throw new TypeError(
      `Radial bar "${markId}" requires positive ${axis}-scale bandwidth`
    );
  }
  return resolved;
}
function mapPolarScale(scale, value) {
  return isChartValue(value) ? scale.map(value) : Number.NaN;
}
function resolveLength(value, context, fallback) {
  const resolved = typeof value === "function" ? value(context) : value ?? fallback;
  return isNonnegativeFiniteNumber(resolved) ? resolved : fallback;
}
function resolvePolarRadiusRange(range, layout) {
  if (!range) return [0, layout.radius];
  if (range.length !== 2) {
    throw new TypeError("Polar radius range must contain exactly two endpoints");
  }
  const resolved = range.map(
    (value) => typeof value === "function" ? value(layout) : value
  );
  if (!resolved.every(isNonnegativeFiniteNumber)) {
    throw new TypeError(
      "Polar radius range endpoints must be nonnegative finite pixel lengths"
    );
  }
  return [resolved[0], resolved[1]];
}
function resolvePolarBand(scale, value) {
  const center = scale.map(value);
  const half = scale.bandwidth / 2;
  const start = center - half;
  const end = center + half;
  return isFiniteNumber(start) && isFiniteNumber(center) && isFiniteNumber(end) ? { start, center, end } : void 0;
}
function resolveBarCornerRadius(value, layout, radius1, radius2) {
  return value === "full" ? Math.abs(radius2 - radius1) / 2 : resolveLength(value, layout, 0);
}
function numericPolarChannelValues(data, channel, fallback) {
  return typeof channel === "number" ? data.map(() => channel) : channelValues(data, channel, fallback);
}
function numberProperty(value, key) {
  if (!value || typeof value !== "object") return void 0;
  const property = value[key];
  return isFiniteNumber(property) ? property : void 0;
}
function asArray(source) {
  return Array.isArray(source) ? source : Array.from(source);
}
function finite(value, fallback) {
  return isFiniteNumber(value) ? value : fallback;
}
function isCompleteRevolution(startAngle, endAngle) {
  return Math.abs(Math.abs(endAngle - startAngle) - tau) <= 1e-12;
}
function outsideRadialAnchor(angle) {
  const horizontal = Math.sin(angle);
  return Math.abs(horizontal) <= 1e-6 ? "middle" : horizontal < 0 ? "end" : "start";
}
function guideLabelOption(option, context, fallback) {
  return typeof option === "function" ? option(context) : option ?? fallback;
}
function classes(base, custom) {
  return custom ? `${base} ${custom}` : base;
}
export {
  angleGrid,
  pie,
  polar,
  radialArc,
  radialArea,
  radialBarAngle,
  radialBarRadius,
  radialDot,
  radialGrid,
  radialLine,
  radialRule,
  radialText
};
