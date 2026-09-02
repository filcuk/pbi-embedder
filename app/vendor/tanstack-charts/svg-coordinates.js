function svgClientToScene(element, scene, clientX, clientY) {
  const matrix = element.getScreenCTM?.();
  if (!matrix) {
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    return {
      x: (clientX - bounds.left) / bounds.width * scene.width,
      y: (clientY - bounds.top) / bounds.height * scene.height
    };
  }
  let inverse;
  try {
    inverse = matrix.inverse();
  } catch {
    return null;
  }
  const x = inverse.a * clientX + inverse.c * clientY + inverse.e;
  const y = inverse.b * clientX + inverse.d * clientY + inverse.f;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}
export {
  svgClientToScene
};
