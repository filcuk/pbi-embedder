import { quantileSortedValues } from "./transform-statistics-internal.js";
function quantile(probability) {
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new TypeError("quantile: probability must be between zero and one");
  }
  return ({ values }) => {
    const sorted = [...values].sort((left, right) => left - right);
    return quantileSortedValues(sorted, probability);
  };
}
function median(context) {
  return quantile(0.5)(context);
}
function variance({ values }) {
  if (values.length < 2) return Number.NaN;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);
}
function deviation(context) {
  return Math.sqrt(variance(context));
}
function first({ values }) {
  return values[0] ?? Number.NaN;
}
function last({ values }) {
  return values.at(-1) ?? Number.NaN;
}
function delta({ values }) {
  return (values.at(-1) ?? Number.NaN) - (values[0] ?? Number.NaN);
}
function ratio({ values }) {
  return (values.at(-1) ?? Number.NaN) / (values[0] ?? Number.NaN);
}
export {
  delta,
  deviation,
  first,
  last,
  median,
  quantile,
  ratio,
  variance
};
