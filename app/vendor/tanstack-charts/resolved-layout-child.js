import { composeInitializedMarks } from "./mark-composite-internal.js";
import { compositeChildMarkId } from "./mark-composite-internal.js";
function adoptResolvedChildMark(child) {
  if (child.resolveLayout) {
    throw new TypeError(
      `Resolved layout cannot adopt child mark "${child.id}" because it has its own layout`
    );
  }
  return {
    channels: child.channels,
    states: child.states,
    postDomain: child.postDomain,
    layoutLabels: child.layoutLabels,
    render: child.render
  };
}
function composeResolvedChildMarks(parentId, children) {
  const composition = composeInitializedMarks(parentId, children, {
    coordinates: "pixel",
    owner: "Resolved layout"
  });
  return {
    channels: composition.channels,
    layoutLabels: composition.layoutLabels,
    render: composition.render
  };
}
const resolvedChildMarkId = compositeChildMarkId;
export {
  adoptResolvedChildMark,
  composeResolvedChildMarks,
  resolvedChildMarkId
};
