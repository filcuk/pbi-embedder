function quantileSortedValues(values, probability) {
  if (!values.length) return Number.NaN;
  const position = (values.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const start = values[lower];
  const end = values[upper];
  return start + (end - start) * (position - lower);
}
export {
  quantileSortedValues
};
