export function enzymesInRestrictionEnzymeDigestionSource(source) {
/**
 * Extracts the enzymes used in a RestrictionEnzymeDigestionSource as an array of strings.
 */
  if (source.type !== 'RestrictionEnzymeDigestionSource') {
    throw new Error('This function only works on RestrictionEnzymeDigestionSource');
  }

  const output = [];
  if (source.left_edge) { output.push(source.left_edge.restriction_enzyme); }
  // add the second one only if it's different
  if (source.right_edge && (!source.left_edge || source.right_edge.restriction_enzyme !== source.left_edge.restriction_enzyme)) {
    output.push(source.right_edge.restriction_enzyme);
  }

  return output;
}

export const classNameToEndPointMap = {
  UploadedFileSource: 'uploaded_file',
  RepositoryIdSource: 'repository_id',
  AddgeneIdSource: 'repository_id',
  BenchlingUrlSource: 'repository_id',
  SnapGenePlasmidSource: 'repository_id',
  EuroscarfSource: 'repository_id',
  IGEMSource: 'repository_id',
  SEVASource: 'repository_id',
  WekWikGeneIdSource: 'repository_id',
  OpenDNACollectionsSource: 'repository_id',
  GenomeCoordinatesSource: 'genome_coordinates',
  ManuallyTypedSource: 'manually_typed',
  OligoHybridizationSource: 'oligonucleotide_hybridization',
  RestrictionEnzymeDigestionSource: 'restriction_enzyme_digestion',
  PCRSource: 'pcr',
  PolymeraseExtensionSource: 'polymerase_extension',
  LigationSource: 'ligation',
  GibsonAssemblySource: 'gibson_assembly',
  OverlapExtensionPCRLigationSource: 'gibson_assembly',
  InFusionSource: 'gibson_assembly',
  InVivoAssemblySource: 'gibson_assembly',
  HomologousRecombinationSource: 'homologous_recombination',
  CRISPRSource: 'crispr',
  RestrictionAndLigationSource: 'restriction_and_ligation',
  GatewaySource: 'gateway',
  AnnotationSource: 'annotate',
  ReverseComplementSource: 'reverse_complement',
  CreLoxRecombinationSource: 'cre_lox_recombination',
  RecombinaseSource: 'recombinase',
};
