const preferredMultiples = [1, 2, 5, 10];
function ticks(start, stop, count) {
  if (!(count > 0)) return [];
  if (start === stop) return [start];
  const descending = stop < start;
  const plan = createTickPlan(
    descending ? stop : start,
    descending ? start : stop,
    count
  );
  if (!(plan.lastIndex >= plan.firstIndex)) return [];
  return Array.from(
    { length: plan.lastIndex - plan.firstIndex + 1 },
    (_value, offset) => valueAtIndex(
      descending ? plan.lastIndex - offset : plan.firstIndex + offset,
      plan.interval
    )
  );
}
function tickIncrement(start, stop, count) {
  return createTickPlan(start, stop, count).interval;
}
function tickStep(start, stop, count) {
  const descending = stop < start;
  const interval = tickIncrement(
    descending ? stop : start,
    descending ? start : stop,
    count
  );
  const magnitude = interval < 0 ? -1 / interval : interval;
  return descending ? -magnitude : magnitude;
}
function createTickPlan(start, stop, count) {
  let requestedCount = count;
  while (true) {
    const interval = chooseInterval(start, stop, requestedCount);
    const firstIndex = indexAtOrAbove(start, interval);
    const lastIndex = indexAtOrBelow(stop, interval);
    if (lastIndex >= firstIndex || !(requestedCount >= 0.5 && requestedCount < 2)) {
      return { firstIndex, lastIndex, interval };
    }
    requestedCount *= 2;
  }
}
function chooseInterval(start, stop, count) {
  const target = (stop - start) / Math.max(0, count);
  const exponent = Math.floor(Math.log10(target));
  const decade = 10 ** exponent;
  const multiple = closestPreferredMultiple(target / decade);
  return exponent < 0 ? -(10 ** -exponent) / multiple : decade * multiple;
}
function closestPreferredMultiple(normalizedTarget) {
  let selected = preferredMultiples[0];
  for (const candidate of preferredMultiples.slice(1)) {
    const midpoint = Math.sqrt(selected * candidate);
    if (!(normalizedTarget >= midpoint)) break;
    selected = candidate;
  }
  return selected;
}
function indexAtOrAbove(value, interval) {
  const position = interval < 0 ? value * -interval : value / interval;
  const nearest = Math.round(position);
  return nearest < position ? nearest + 1 : nearest;
}
function indexAtOrBelow(value, interval) {
  const position = interval < 0 ? value * -interval : value / interval;
  const nearest = Math.round(position);
  return nearest > position ? nearest - 1 : nearest;
}
function valueAtIndex(index, interval) {
  return interval < 0 ? index / -interval : index * interval;
}
export {
  tickIncrement,
  tickStep,
  ticks
};
