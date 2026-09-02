function normalizeInteractionRange(axis, range) {
  const [start, end] = axis.order(range.start, range.end);
  return { start, end };
}
function sameInteractionRange(axis, left, right) {
  return axis.layoutKey(left.start) === axis.layoutKey(right.start) && axis.layoutKey(left.end) === axis.layoutKey(right.end);
}
function cloneInteractionRange(range) {
  return {
    start: cloneInteractionValue(range.start),
    end: cloneInteractionValue(range.end)
  };
}
function cloneInteractionValue(value) {
  return value instanceof Date ? new Date(value.getTime()) : value;
}
export {
  cloneInteractionRange,
  cloneInteractionValue,
  normalizeInteractionRange,
  sameInteractionRange
};
