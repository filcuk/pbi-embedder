import { intern, uniqueDomain } from "./intern.js";
function createBandScale(point, first, second) {
  let domain = [];
  let index = /* @__PURE__ */ new Map();
  let positions = [];
  let range = [0, 1];
  let step = 1;
  let bandwidth = point ? 0 : 1;
  let round = false;
  let paddingInner = point ? 1 : 0;
  let paddingOuter = 0;
  let align = 0.5;
  const scale = ((value) => {
    const position = index.get(intern(value));
    return position === void 0 ? void 0 : positions[position];
  });
  const rescale = () => {
    const count = domain.length;
    const reverse = range[1] < range[0];
    let start = reverse ? range[1] : range[0];
    const stop = reverse ? range[0] : range[1];
    step = (stop - start) / Math.max(1, count - paddingInner + paddingOuter * 2);
    if (round) step = Math.floor(step);
    start += (stop - start - step * (count - paddingInner)) * align;
    bandwidth = step * (1 - paddingInner);
    if (round) {
      start = Math.round(start);
      bandwidth = Math.round(bandwidth);
    }
    positions = Array.from(
      { length: count },
      (_value, position) => start + step * position
    );
    if (reverse) positions.reverse();
    return scale;
  };
  scale.domain = ((values) => {
    if (values === void 0) return domain.slice();
    const next = uniqueDomain(values);
    domain = next.domain;
    index = next.index;
    return rescale();
  });
  scale.range = ((values) => {
    if (values === void 0) return [...range];
    range = pair(values);
    return rescale();
  });
  scale.rangeRound = (values) => {
    range = pair(values);
    round = true;
    return rescale();
  };
  scale.bandwidth = () => bandwidth;
  scale.step = () => step;
  scale.round = ((value) => {
    if (value === void 0) return round;
    round = Boolean(value);
    return rescale();
  });
  scale.padding = ((value) => {
    if (value === void 0) return paddingInner;
    paddingOuter = number(value);
    paddingInner = Math.min(1, paddingOuter);
    return rescale();
  });
  scale.paddingInner = ((value) => {
    if (value === void 0) return paddingInner;
    paddingInner = Math.min(1, number(value));
    return rescale();
  });
  scale.paddingOuter = ((value) => {
    if (value === void 0) return paddingOuter;
    paddingOuter = number(value);
    return rescale();
  });
  scale.align = ((value) => {
    if (value === void 0) return align;
    align = Math.max(0, Math.min(1, number(value)));
    return rescale();
  });
  scale.copy = () => {
    const copy = createBandScale(false, domain, range);
    return copy.round(round).paddingInner(paddingInner).paddingOuter(paddingOuter).align(align);
  };
  if (point) {
    const pointScale = scale;
    pointScale.bandwidth = () => 0;
    pointScale.padding = scale.paddingOuter;
    pointScale.copy = () => {
      const copy = createBandScale(true, domain, range);
      return copy.round(round).padding(paddingOuter).align(align);
    };
    delete pointScale.paddingInner;
    delete pointScale.paddingOuter;
  }
  rescale();
  if (second !== void 0) {
    scale.domain(first).range(second);
  } else if (first !== void 0) {
    scale.range(first);
  }
  return scale;
}
function pair(values) {
  const resolved = Array.from(values, number);
  if (resolved.length !== 2 || resolved.some((value) => !Number.isFinite(value))) {
    throw new TypeError("A scale range requires exactly two finite numbers");
  }
  return [resolved[0], resolved[1]];
}
function number(value) {
  return Number(value);
}
export {
  createBandScale
};
