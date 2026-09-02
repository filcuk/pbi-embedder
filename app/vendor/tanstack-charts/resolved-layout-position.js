import { isChartValue } from "./mark.js";
function materializeLayoutXYRows(data, xValues, yValues) {
  return data.flatMap((datum, sourceIndex) => {
    const xValue = xValues[sourceIndex];
    const yValue = yValues[sourceIndex];
    return isChartValue(xValue) && isChartValue(yValue) ? [{ datum, sourceIndex, xValue, yValue }] : [];
  });
}
function projectLayoutX(rows, values, scale) {
  return projectLayoutAxis(rows, values, scale, "xValue", "x");
}
function projectLayoutY(rows, values, scale) {
  return projectLayoutAxis(rows, values, scale, "yValue", "y");
}
function projectLayoutAxis(rows, values, scale, valueKey, positionKey) {
  return rows.flatMap((row) => {
    const value = values[row.sourceIndex];
    if (!isChartValue(value)) return [];
    const position = scale.map(value);
    return Number.isFinite(position) ? [
      {
        ...row,
        [valueKey]: value,
        [positionKey]: position
      }
    ] : [];
  });
}
export {
  materializeLayoutXYRows,
  projectLayoutX,
  projectLayoutY
};
