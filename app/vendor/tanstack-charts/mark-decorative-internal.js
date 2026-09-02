function createDecorativeMark(mark, transform, options) {
  return {
    motion: mark.motion,
    initialize(context) {
      const initialized = mark.initialize(context);
      assertConditionalMetadata(initialized, initialized.id, options);
      const {
        focus: _focus,
        states: _states,
        resolveLayout,
        ...initializedBase
      } = initialized;
      const base = withoutLayoutLabels(initializedBase, options.layoutLabels);
      return {
        ...base,
        render: initialized.render,
        postDomain: composePostDomain(initialized.postDomain, transform),
        ...resolveLayout ? {
          resolveLayout(layoutContext) {
            const resolved = resolveLayout(layoutContext);
            assertConditionalMetadata(resolved, initialized.id, options);
            const { states: _resolvedStates, ...resolvedBase } = resolved;
            const resolvedWithoutLabels = withoutLayoutLabels(
              resolvedBase,
              options.layoutLabels
            );
            return {
              ...resolvedWithoutLabels,
              render: resolved.render,
              postDomain: composePostDomain(
                resolved.postDomain ?? initialized.postDomain,
                transform
              )
            };
          }
        } : {}
      };
    }
  };
}
function assertConditionalMetadata(mark, id, options) {
  if (options.conditional === "reject" && (mark.focus !== void 0 || mark.states !== void 0)) {
    throw new TypeError(
      `decorative() cannot wrap mark "${id}" with focus or state behavior`
    );
  }
}
function withoutLayoutLabels(value, policy) {
  if (policy === "preserve") return value;
  const { layoutLabels: _layoutLabels, ...rest } = value;
  return rest;
}
function composePostDomain(existing, transform) {
  return (scene) => transform(existing ? existing(scene) : scene);
}
export {
  createDecorativeMark
};
