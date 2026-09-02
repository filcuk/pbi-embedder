import { intern, uniqueDomain } from "./intern.js";
const implicit = /* @__PURE__ */ Symbol("implicit");
function scaleOrdinal(first, second) {
  let domain = [];
  let index = /* @__PURE__ */ new Map();
  let range = [];
  let unknown = implicit;
  const scale = ((value) => {
    const key = intern(value);
    let position = index.get(key);
    if (position === void 0) {
      if (unknown !== implicit) return unknown;
      position = domain.length;
      index.set(key, position);
      domain.push(value);
    }
    return range[position % range.length];
  });
  scale.domain = ((values) => {
    if (values === void 0) return domain.slice();
    const next = uniqueDomain(values);
    domain = next.domain;
    index = next.index;
    return scale;
  });
  scale.range = ((values) => {
    if (values === void 0) return range.slice();
    range = Array.from(values);
    return scale;
  });
  scale.unknown = function(value) {
    if (arguments.length === 0) {
      return unknown === implicit ? void 0 : unknown;
    }
    unknown = value;
    return scale;
  };
  scale.copy = () => {
    const copy = scaleOrdinal(domain, range);
    if (unknown !== implicit) copy.unknown(unknown);
    return copy;
  };
  if (second !== void 0) {
    scale.domain(first).range(second);
  } else if (first !== void 0) {
    scale.range(first);
  }
  return scale;
}
export {
  scaleOrdinal
};
