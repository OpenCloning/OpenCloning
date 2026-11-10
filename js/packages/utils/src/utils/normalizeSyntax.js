/**
 * Normalizes syntax data for assembly enzymes. Handles legacy assemblyEnzyme (string).
 * @param {Object} syntax - Raw syntax object from JSON
 * @returns {Object} syntax with assemblyEnzymes: string[]
 */
export function normalizeSyntaxEnzymes(syntax) {
  if (!syntax) return syntax;
  const enzymes = syntax.assemblyEnzymes ??
    (syntax.assemblyEnzyme != null ? [syntax.assemblyEnzyme] : ['BsaI']);
  return { ...syntax, assemblyEnzymes: Array.isArray(enzymes) ? enzymes : [enzymes] };
}
