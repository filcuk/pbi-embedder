function resolveCompositeMotion(definition, context) {
  return typeof definition === "function" ? definition(context) : definition;
}
function resolveCompositeChildMotion(parent, children, context) {
  let childId;
  for (const candidate of children.keys()) {
    if ((context.markId === candidate || context.markId?.startsWith(`${candidate}:`)) && (!childId || candidate.length > childId.length)) {
      childId = candidate;
    }
  }
  return mergeCompositeMotion(
    resolveCompositeMotion(parent, context),
    childId ? resolveCompositeMotion(children.get(childId), context) : void 0
  );
}
function mergeCompositeMotion(parent, child) {
  if (!parent) return child;
  if (!child) return parent;
  const path = child.path ?? parent.path;
  return {
    delay: child.delay ?? parent.delay,
    ...path === void 0 ? {} : { path },
    transition: mergeCompositeTransition(parent.transition, child.transition)
  };
}
function mergeCompositeTransition(parent, child) {
  if (!parent) return child;
  if (!child) return parent;
  return parent.type === child.type ? { ...parent, ...child } : child;
}
export {
  mergeCompositeMotion,
  resolveCompositeChildMotion,
  resolveCompositeMotion
};
