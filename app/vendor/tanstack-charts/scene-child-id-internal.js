function sceneChildId(ownerId, childId) {
  return childId === ownerId || childId.startsWith(`${ownerId}:`) ? childId : `${ownerId}:${childId}`;
}
export {
  sceneChildId
};
