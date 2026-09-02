import { isLogarithmicScale, resolveScaleInput } from "./scale-input.js";
function resolveConfiguredScale(source, context) {
  const scale = resolveScaleInput(source, {
    values: context.values,
    includeZero: context.includeZero,
    nice: context.options?.nice,
    niceCount: context.tickCount
  });
  const contentDomain = copyDomain(scale.domain());
  const viewport = resolveViewport(scale, context, contentDomain);
  const categorical = scale.bandwidth !== void 0;
  const naturalRange = categorical && context.id === "y" ? [Math.min(...context.range), Math.max(...context.range)] : context.range;
  const range = context.options?.reverse ? [naturalRange[1], naturalRange[0]] : naturalRange;
  scale.range(range);
  const domain = copyDomain(scale.domain());
  if (viewport && (!sameDomain(domain, viewport.domain) || !mapsDomainToRange(scale, viewport.domain, range))) {
    throw new TypeError(
      `Chart viewport "${context.id}" requires independent configurable domain and range capabilities`
    );
  }
  const tickOptions = context.options?.axis === false ? void 0 : context.options?.axis?.ticks;
  const configuredTicks = tickOptions === false ? void 0 : tickOptions;
  const tickValues = configuredTicks?.values ?? scale.ticks?.(context.tickCount) ?? domain;
  const tickFormat = scale.tickFormat?.(context.tickCount);
  const bandwidth = scale.bandwidth?.() ?? 0;
  const map = (value) => {
    const result = scale(value);
    return result === void 0 ? Number.NaN : result + bandwidth / 2;
  };
  const invert = scale.invert ? (position) => scale.invert(position - bandwidth / 2) : void 0;
  return {
    id: context.id,
    type: categorical ? "band" : "configured",
    domain,
    map,
    ...invert ? { invert } : {},
    ticks: tickValues.map((value) => ({
      value,
      position: map(value),
      label: configuredTicks?.format?.(value) ?? tickFormat?.(value) ?? formatValue(value)
    })),
    bandwidth,
    ...viewport ? {
      viewport: {
        contentDomain,
        domain: viewport.domain,
        translate: viewport.translate,
        map: (value) => map(value) + viewport.translate
      }
    } : {}
  };
}
function resolveViewport(scale, context, contentDomain) {
  const viewport = context.options?.viewport;
  if (!viewport) return void 0;
  const capable = scale;
  if (scale.bandwidth !== void 0 || typeof scale.ticks !== "function" || typeof capable.invert !== "function") {
    throw new TypeError(
      `Chart viewport "${context.id}" requires a continuous numeric or temporal scale`
    );
  }
  if (typeof capable.clamp === "function" && capable.clamp() === true) {
    throw new TypeError(
      `Chart viewport "${context.id}" does not support a clamped scale`
    );
  }
  const domain = viewport.domain;
  if (domain.length !== 2 || !sameContinuousType(domain[0], domain[1])) {
    invalidViewportDomain(context.id);
  }
  const first = continuousNumber(domain[0]);
  const last = continuousNumber(domain[1]);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first === last) {
    invalidViewportDomain(context.id);
  }
  validateViewportLogDomains(scale, context.id, contentDomain, domain);
  const translate = viewport.translate ?? 0;
  if (!Number.isFinite(translate)) {
    throw new TypeError(
      `Chart viewport "${context.id}" translate must be a finite number`
    );
  }
  if (sameDomain(scale.domain(), domain)) {
    configureScaleDomain(
      scale,
      [domain[1], domain[0]],
      context.id
    );
  }
  configureScaleDomain(scale, domain, context.id);
  const resolved = copyDomain(scale.domain());
  if (resolved.length !== 2 || !sameContinuousType(resolved[0], resolved[1])) {
    invalidConfigurableDomain(context.id);
  }
  return {
    domain: resolved,
    translate
  };
}
function configureScaleDomain(scale, domain, id) {
  const setDomain = scale.domain;
  try {
    setDomain.call(scale, [...domain]);
  } catch {
    invalidConfigurableDomain(id);
  }
  if (!sameDomain(scale.domain(), domain)) invalidConfigurableDomain(id);
}
function sameDomain(resolved, expected) {
  return resolved.length === expected.length && resolved.every((value, index) => sameChartValue(value, expected[index]));
}
function mapsDomainToRange(scale, domain, range) {
  const first = scale(domain[0]);
  const last = scale(domain[1]);
  return first !== void 0 && last !== void 0 && Number.isFinite(first) && Number.isFinite(last) && Math.abs(first - range[0]) <= 1e-6 && Math.abs(last - range[1]) <= 1e-6;
}
function copyDomain(domain) {
  return domain.map(
    (value) => value instanceof Date ? new Date(value.getTime()) : value
  );
}
function invalidConfigurableDomain(id) {
  throw new TypeError(
    `Chart viewport "${id}" requires a scale with a configurable domain`
  );
}
function validateViewportLogDomains(scale, id, contentDomain, viewportDomain) {
  if (!isLogarithmicScale(scale)) return;
  const contentSign = logarithmicDomainSign(contentDomain);
  const viewportSign = logarithmicDomainSign(viewportDomain);
  if (contentSign === void 0 || viewportSign === void 0 || contentSign !== viewportSign) {
    throw new TypeError(
      `Chart viewport "${id}" logarithmic content and viewport domains must be finite, nonzero, and stay on the same side of zero`
    );
  }
}
function logarithmicDomainSign(domain) {
  let sign;
  for (const value of domain) {
    if (typeof value !== "number" || !Number.isFinite(value) || value === 0) {
      return void 0;
    }
    const current = Math.sign(value);
    if (sign !== void 0 && current !== sign) return void 0;
    sign = current;
  }
  return sign;
}
function sameContinuousType(first, last) {
  return typeof first === "number" && typeof last === "number" || first instanceof Date && last instanceof Date;
}
function continuousNumber(value) {
  return value instanceof Date ? value.getTime() : value;
}
function sameChartValue(left, right) {
  return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : Object.is(left, right);
}
function invalidViewportDomain(id) {
  throw new TypeError(
    `Chart viewport "${id}" domain must contain two distinct finite numbers or Dates`
  );
}
function formatValue(value) {
  return value instanceof Date ? value.toLocaleDateString() : String(value);
}
export {
  resolveConfiguredScale
};
