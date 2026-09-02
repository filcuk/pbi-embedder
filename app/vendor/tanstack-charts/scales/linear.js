import { tickIncrement, ticks as createTicks, tickStep } from "./ticks.js";
function scaleLinear(first, second) {
  let domain = [0, 1];
  let range = [0, 1];
  let clamped = false;
  const scale = ((value) => {
    if (value == null || !Number.isFinite(Number(value))) return void 0;
    return interpolate(Number(value), domain, range, clamped);
  });
  scale.domain = ((values) => {
    if (values === void 0) return [...domain];
    domain = pair(values, "domain");
    return scale;
  });
  scale.range = ((values) => {
    if (values === void 0) return [...range];
    range = pair(values, "range");
    return scale;
  });
  scale.invert = (value) => interpolate(value, range, domain, clamped);
  scale.clamp = ((value) => {
    if (value === void 0) return clamped;
    clamped = Boolean(value);
    return scale;
  });
  scale.ticks = (count = 10) => createTicks(domain[0], domain[1], count);
  scale.tickFormat = (count = 10) => {
    const step = Math.abs(tickStep(domain[0], domain[1], count));
    const digits = step > 0 && step < 1 ? Math.min(20, Math.max(0, -Math.floor(Math.log10(step)))) : 0;
    return (value) => {
      const formatted = digits ? value.toFixed(digits) : String(value);
      return formatted === "-0" ? "0" : formatted;
    };
  };
  scale.nice = (count = 10) => {
    let start = domain[0];
    let stop = domain[1];
    let startIndex = 0;
    let stopIndex = 1;
    if (stop < start) {
      ;
      [start, stop] = [stop, start];
      [startIndex, stopIndex] = [stopIndex, startIndex];
    }
    let previousStep;
    for (let remaining = 10; remaining > 0; remaining--) {
      const step = tickIncrement(start, stop, count);
      if (step === previousStep) {
        const next = [...domain];
        next[startIndex] = start;
        next[stopIndex] = stop;
        domain = next;
        break;
      }
      if (step > 0) {
        start = Math.floor(start / step) * step;
        stop = Math.ceil(stop / step) * step;
      } else if (step < 0) {
        start = Math.ceil(start * step) / step;
        stop = Math.floor(stop * step) / step;
      } else {
        break;
      }
      previousStep = step;
    }
    return scale;
  };
  scale.copy = () => scaleLinear(domain, range).clamp(clamped);
  if (second !== void 0) {
    scale.domain(first).range(second);
  } else if (first !== void 0) {
    scale.range(first);
  }
  return scale;
}
function interpolate(value, domain, range, clamped) {
  const span = domain[1] - domain[0];
  let ratio = span ? (value - domain[0]) / span : 0.5;
  if (clamped) ratio = Math.max(0, Math.min(1, ratio));
  return range[0] + ratio * (range[1] - range[0]);
}
function pair(values, name) {
  const resolved = Array.from(values, Number);
  if (resolved.length !== 2 || resolved.some((value) => !Number.isFinite(value))) {
    throw new TypeError(
      `A linear scale ${name} requires exactly two finite numbers`
    );
  }
  return [resolved[0], resolved[1]];
}
export {
  scaleLinear
};
