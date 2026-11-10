/**
 * Formats a sequence label from its ID and name.
 * Returns "Seq. {id} ({name})" if name is meaningful, or "Seq. {id}" otherwise.
 */
export function getSequenceLabel(id, name) {
  return name && name !== 'template' ? `Seq. ${id} (${name})` : `Seq. ${id}`;
}
