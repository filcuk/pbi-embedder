function viewportTranslationChanged(previous, next) {
  return ["x", "y"].some(
    (axis) => (previous.scales[axis]?.viewport?.translate ?? 0) !== (next.scales[axis]?.viewport?.translate ?? 0)
  );
}
function mapScenePointReferences(nodes, mapPoint) {
  return nodes.map((node) => {
    if (node.kind === "group") {
      return {
        ...node,
        children: mapScenePointReferences(node.children, mapPoint),
        ...node.focus ? {
          focus: {
            ...node.focus,
            points: node.focus.points.map(mapPoint)
          }
        } : {},
        ...node.states ? {
          states: {
            ...node.states,
            points: node.states.points.map(mapPoint)
          }
        } : {}
      };
    }
    if (node.kind === "label" || !node.interaction) return node;
    return {
      ...node,
      interaction: node.interaction.point ? { ...node.interaction, point: mapPoint(node.interaction.point) } : {
        ...node.interaction,
        points: node.interaction.points.map(mapPoint)
      }
    };
  });
}
export {
  mapScenePointReferences,
  viewportTranslationChanged
};
