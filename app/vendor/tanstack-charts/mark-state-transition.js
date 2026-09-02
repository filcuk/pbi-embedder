function resolveMarkStateTransition(transition, element) {
  if (!transition || transition.type !== "tween") return void 0;
  if ((transition.respectReducedMotion ?? true) && element.ownerDocument.defaultView?.matchMedia?.(
    "(prefers-reduced-motion: reduce)"
  ).matches) {
    return void 0;
  }
  const { type: _type, ...resolved } = transition;
  return resolved;
}
export {
  resolveMarkStateTransition
};
