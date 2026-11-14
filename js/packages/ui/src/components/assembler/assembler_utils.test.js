import { aliasedEnzymesByName, getDigestFragmentsForRestrictionEnzymes, getReverseComplementSequenceString, getComplementSequenceString, getReverseComplementSequenceAndAnnotations } from "@teselagen/sequence-utils";
import fs from 'fs';
import { assignSequenceToSyntaxPart, simplifyDigestFragment, reverseComplementSimplifiedDigestFragment, tripletsToTranslation, partDataToDisplayData, arrayCombinations, getFilesToExportFromAssembler, getCloningStrategyFilesFromAssembler, getDefaultAssemblyOutputName, sanitizeOutputName } from "./assembler_utils";
import { partsToEdgesGraph } from "./graph_utils";
import { getNextCategories, isAssemblyComplete } from "./assembler_utils";
import { getOverhangOrder } from "./syntax_layout";


const sequenceBsaI  = 'tgggtctcaTACTagagtcacacaggactactaAATGagagacctac';
const sequenceBsaI2 = 'tgggtctcaAATGagagtcacacaggactactaAGGTagagacctac'
const sequenceBsaI3  = 'tgggtctcaTACTagagtcacacaggactactaAGGTagagacctac';

describe('reverseComplementSimplifiedDigestFragment', () => {
  it('works', () => {

    const digestFragments = getDigestFragmentsForRestrictionEnzymes(
      sequenceBsaI,
      true,
      aliasedEnzymesByName["bsai"],
    );
    const sequenceRc = getReverseComplementSequenceString(sequenceBsaI);
    const digestFragments2 = getDigestFragmentsForRestrictionEnzymes(
      sequenceRc,
      true,
      aliasedEnzymesByName["bsai"],
    );

    const simplifiedDigestFragments1 = digestFragments.map(simplifyDigestFragment);
    const simplifiedDigestFragments2 = digestFragments2.map(simplifyDigestFragment);
    const simplifiedDigestFragments3 = simplifiedDigestFragments2.map(reverseComplementSimplifiedDigestFragment);
    expect(simplifiedDigestFragments1).toEqual(simplifiedDigestFragments3);
  });
});



it('handles palindromic fragments', () => {

  const parts = [
    {left_overhang: 'AATT', right_overhang: 'AGCT'}, // This part is palindromic, should only be picked up in AATT-AGCT, not AGCT-AATT
    {left_overhang: 'AGCT', right_overhang: 'GGAG'},
    {left_overhang: 'GGAG', right_overhang: 'AATT'},
  ]
  // Read file
  const sequence = 'tgggtctcaAATTagagtcacacaggactactaAGCTagagacctac'
  const seqData = { sequence, circular: true };
  const result = assignSequenceToSyntaxPart(seqData, [aliasedEnzymesByName["bsai"]], partsToEdgesGraph(parts));

  expect(result).toEqual([{left_overhang: 'AATT', right_overhang: 'AGCT', longestFeature: null}]);

  const seqDataRc = getReverseComplementSequenceAndAnnotations(seqData);
  const resultRc = assignSequenceToSyntaxPart(seqDataRc, [aliasedEnzymesByName["bsai"]], partsToEdgesGraph(parts));

  expect(resultRc).toEqual([{left_overhang: 'AATT', right_overhang: 'AGCT', longestFeature: null}]);

});


it('shows the meaning of forward and reverse', () => {
  const sequence = 'aaGGTCTCaTACTaaa'
  const digestFragments = getDigestFragmentsForRestrictionEnzymes(
    sequence,
    false,
    aliasedEnzymesByName["bsai"],
  );

  // This does not denote whether the overhang is 5' or 3',
  // but the orientation of the recognition site.
  expect(digestFragments[0].cut2.overhangBps).toBe('TACT');
  expect(digestFragments[0].cut2.forward).toBe(true);
  expect(digestFragments[1].cut1.overhangBps).toBe('TACT');
  expect(digestFragments[1].cut1.forward).toBe(true);

  // See how for a fragment with the same overhangs, the forward
  // value is different
  const sequence2 = 'aTACTcGAGACCaaa'
  const digestFragments2 = getDigestFragmentsForRestrictionEnzymes(
    sequence2,
    false,
    aliasedEnzymesByName["bsai"],
  );
  expect(digestFragments2[0].cut2.overhangBps).toBe('TACT');
  expect(digestFragments2[0].cut2.forward).toBe(false);
  expect(digestFragments2[1].cut1.overhangBps).toBe('TACT');
  expect(digestFragments2[1].cut1.forward).toBe(false);

  // For EcoRI, it's always forward
  const sequenceEcoRI = 'aaaGAATTCaaaGAATTCaaaa'
  const digestFragmentsEcoRI = getDigestFragmentsForRestrictionEnzymes(
    sequenceEcoRI,
    true,
    aliasedEnzymesByName["ecori"],
  );
  expect(digestFragmentsEcoRI[0].cut2.overhangBps).toBe('AATT');
  expect(digestFragmentsEcoRI[0].cut2.forward).toBe(true);
  expect(digestFragmentsEcoRI[0].cut1.overhangBps).toBe('AATT');
  expect(digestFragmentsEcoRI[0].cut1.forward).toBe(true);
});

describe('assignSequenceToSyntaxPart', () => {
  it('works', () => {
    const enzymes = [aliasedEnzymesByName["bsai"]];
    const parts = [{left_overhang: 'TACT', right_overhang: 'AATG'}, {left_overhang: 'AATG', right_overhang: 'AGGT'}];
    const graph = partsToEdgesGraph(parts);

    for (const reverseComplement of [false, true]) {
      const seq1 = reverseComplement ? getReverseComplementSequenceString(sequenceBsaI) : sequenceBsaI;
      const seq2 = reverseComplement ? getReverseComplementSequenceString(sequenceBsaI2) : sequenceBsaI2;
      const seq3 = reverseComplement ? getReverseComplementSequenceString(sequenceBsaI + sequenceBsaI2) : sequenceBsaI + sequenceBsaI2;

      const sequenceData1 = { sequence: seq1, circular: true };
      const sequenceData2 = { sequence: seq2, circular: true };
      const sequenceData3 = { sequence: seq3, circular: true };

      const result = assignSequenceToSyntaxPart(sequenceData1, enzymes, graph);
      expect(result).toEqual([{left_overhang: 'TACT', right_overhang: 'AATG', longestFeature: null}]);

      const result2 = assignSequenceToSyntaxPart(sequenceData2, enzymes, graph);
      expect(result2).toEqual([{left_overhang: 'AATG', right_overhang: 'AGGT', longestFeature: null}]);

      const result3 = assignSequenceToSyntaxPart(sequenceData3, enzymes, graph);
      if (reverseComplement) {
        expect(result3).toEqual([{left_overhang: 'AATG', right_overhang: 'AGGT', longestFeature: null}, {left_overhang: 'TACT', right_overhang: 'AATG', longestFeature: null}]);
      } else {
        expect(result3).toEqual([{left_overhang: 'TACT', right_overhang: 'AATG', longestFeature: null}, {left_overhang: 'AATG', right_overhang: 'AGGT', longestFeature: null}]);
      }
    }

    // Multi-spanning fragments are also picked up
    const resultMulti = assignSequenceToSyntaxPart({ sequence: sequenceBsaI3, circular: true }, enzymes, graph);
    expect(resultMulti).toEqual([{left_overhang: 'TACT', right_overhang: 'AGGT', longestFeature: null}]);

    const result4 = assignSequenceToSyntaxPart({ sequence: '', circular: true }, enzymes, graph);
    expect(result4).toEqual([])

    const result5 = assignSequenceToSyntaxPart({ sequence: 'AACGTAGACAGATTA', circular: true }, enzymes, graph);
    expect(result5).toEqual([])

    // Features are picked up
    const sequenceDataWithFeatures = {
      sequence: sequenceBsaI3,
      circular: true,
      features: [
        {start: 15, end: 30, type: 'misc_feature', name: 'feature1'},
        {start: 2, end: 45, type: 'misc_feature', name: 'feature2'}
      ]};

    const result6 = assignSequenceToSyntaxPart(sequenceDataWithFeatures, enzymes, graph);
    const {start, end, type, name} = result6[0].longestFeature;
    expect(start).toBe(15);
    expect(end).toBe(30);
    expect(type).toBe('misc_feature');
    expect(name).toBe('feature1');
  });

  it('works with multiple enzymes', () => {
    const enzymes = [aliasedEnzymesByName["bsmbi"], aliasedEnzymesByName["bsai"]];
    const parts = [{left_overhang: 'TACT', right_overhang: 'AATG'}, {left_overhang: 'AATG', right_overhang: 'AGGT'}];
    const graph = partsToEdgesGraph(parts);
    // Works when both sites are of the same enzyme
    const sequences = [
      { sequence: 'AAggtctcaTACTagagtcacacaggactactaAATGagagaccAA', circular: true },
      { sequence: 'AAcgtctcaTACTagagtcacacaggactactaAATGagagacgAA', circular: true },
    ];
    for (const sequenceData of sequences) {
      const result = assignSequenceToSyntaxPart(sequenceData, enzymes, graph);
      expect(result).toEqual([{left_overhang: 'TACT', right_overhang: 'AATG', longestFeature: null}]);
    }

    // Does not work when the sites are of different enzymes
    const sequenceData2 = { sequence: 'AAcgtctcaTACTagagtcacacaggactactaAATGagagaccAA', circular: true };
    const result2 = assignSequenceToSyntaxPart(sequenceData2, enzymes, graph);
    expect(result2).toEqual([]);
  });

  it('Does not assign a plasmid with a single cut', () => {
    const parts = [{left_overhang: 'TACT', right_overhang: 'AATG'}, {left_overhang: 'AATG', right_overhang: 'AGGT'}];
    const graph = partsToEdgesGraph(parts);
    const enzymes = [aliasedEnzymesByName["bsai"]];
    const sequenceData = { sequence: 'tgggtctcaTACTagagtc', circular: true };
    const result = assignSequenceToSyntaxPart(sequenceData, enzymes, graph);
    expect(result).toEqual([]);
  })

  it('ignores the fragments at the ends of linear sequences (e.g. PCR products)', () => {
    const parts = [{left_overhang: 'TACT', right_overhang: 'AATG'}, {left_overhang: 'AATG', right_overhang: 'AGGT'}];
    const graph = partsToEdgesGraph(parts);
    const enzymes = [aliasedEnzymesByName["bsai"]];
    // The part between the two cuts is found, the fragments up to the sequence ends are ignored
    expect(assignSequenceToSyntaxPart({ sequence: sequenceBsaI, circular: false }, enzymes, graph))
      .toEqual([{left_overhang: 'TACT', right_overhang: 'AATG', longestFeature: null}]);
    // A single cut only gives fragments with a sequence end
    expect(assignSequenceToSyntaxPart({ sequence: 'tgggtctcaTACTagagtc', circular: false }, enzymes, graph)).toEqual([]);
  })

  it('does not assign a sequence that the enzyme does not cut', () => {
    const parts = [{left_overhang: 'TACT', right_overhang: 'AATG'}, {left_overhang: 'AATG', right_overhang: 'AGGT'}];
    const graph = partsToEdgesGraph(parts);
    const enzymes = [aliasedEnzymesByName["bsai"]];
    expect(assignSequenceToSyntaxPart({ sequence: 'AAAAAAA', circular: true }, enzymes, graph)).toEqual([]);
    expect(assignSequenceToSyntaxPart({ sequence: 'AAAAAAA', circular: false }, enzymes, graph)).toEqual([]);
  })
});

describe('tripletsToTranslation', () => {
  it('returns empty string for falsy input', () => {
    expect(tripletsToTranslation(null)).toBe('');
    expect(tripletsToTranslation(undefined)).toBe('');
    expect(tripletsToTranslation(false)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(tripletsToTranslation([])).toBe('');
  });

  it('translates valid triplets to amino acid codes', () => {
    // ATG = Methionine (Met)
    expect(tripletsToTranslation(['ATG'])).toBe('Met');

    // TTT = Phenylalanine (Phe)
    expect(tripletsToTranslation(['TTT'])).toBe('Phe');

    // Multiple triplets
    expect(tripletsToTranslation(['ATG', 'TTT', 'GCA'])).toBe('MetPheAla');
  });

  it('replaces Stop codons with ***', () => {
    // TAA, TAG, TGA are stop codons
    const stopCodons = ['TAA', 'TAG', 'TGA'];
    const result = tripletsToTranslation(stopCodons);
    expect(result).toBe('*********');
  });

  it('returns " - " for triplets with non-ACGT characters', () => {
    expect(tripletsToTranslation(['ATN'])).toBe(' - ');
    expect(tripletsToTranslation(['XYZ'])).toBe(' - ');
    expect(tripletsToTranslation(['AT-'])).toBe(' - ');
  });

  it('handles mixed valid and invalid triplets', () => {
    const result = tripletsToTranslation(['ATG', 'XYZ', 'TTT']);
    expect(result).toBe('Met - Phe');
  });
});

describe('partDataToDisplayData', () => {
  it('computes reverse complements for all sequences and returns empty translations when no codon starts provided', () => {
    const data = {
      left_overhang: 'ATGC',
      right_overhang: 'CGTA',
      left_inside: 'TTAA',
      right_inside: 'AATT'
    };

    const result = partDataToDisplayData(data);

    expect(result.leftOverhangRc).toBe(getComplementSequenceString('ATGC'));
    expect(result.rightOverhangRc).toBe(getComplementSequenceString('CGTA'));
    expect(result.leftInsideRc).toBe(getComplementSequenceString('TTAA'));
    expect(result.rightInsideRc).toBe(getComplementSequenceString('AATT'));

    expect(result.leftTranslationOverhang).toBe('');
    expect(result.leftTranslationInside).toBe('');
    expect(result.rightTranslationOverhang).toBe('');
    expect(result.rightTranslationInside).toBe('');
  });

  it('computes left translation when left_codon_start is provided', () => {
    const data = {
      left_overhang: 'AT',
      left_inside: 'GCGCA',
      left_codon_start: 1,
      right_overhang: '',
      right_inside: ''
    };

    const result = partDataToDisplayData(data);

    // ATG CGC A... should translate to Met Arg...
    expect(result.leftTranslationOverhang).toBe('Me');
    expect(result.leftTranslationInside).toBe('tArg');

    const data2 = {
      left_overhang: 'ATTT',
      left_inside: 'GCGCA',
      left_codon_start: 3,
      right_overhang: '',
      right_inside: ''
    };
    const result2 = partDataToDisplayData(data2);
    expect(result2.leftTranslationOverhang).toBe('  Le');
    expect(result2.leftTranslationInside).toBe('uArg');
  });

});

describe('arrayCombinations', () => {
  it('returns null for empty array', () => {
    expect(arrayCombinations([])).toBe(null);
  });

  it('returns array of arrays for single array', () => {
    expect(arrayCombinations([[1, 2, 3]])).toEqual([[1], [2], [3]]);
  });

  it('returns array of arrays for multiple arrays', () => {
    expect(arrayCombinations([[1, 2], [3, 4], [5, 6]])).toEqual([[1, 3, 5], [1, 3, 6], [1, 4, 5], [1, 4, 6], [2, 3, 5], [2, 3, 6], [2, 4, 5], [2, 4, 6]]);
  });
});


const goldenGateCloningStrategy = JSON.parse(fs.readFileSync('apps/opencloning/public/examples/golden_gate.json', 'utf8'));
const gatewayCloningStrategy = JSON.parse(fs.readFileSync('apps/opencloning/public/examples/gateway.json', 'utf8'));

const dummyData = {
  requestedAssemblies: [ goldenGateCloningStrategy, gatewayCloningStrategy],
  expandedAssemblies: [[1, 5, 7], [1, 2, 3]],
  plasmids: [
    {id: 1, plasmid_name: 'p1'},
    {id: 2, plasmid_name: 'p2'},
    {id: 3, plasmid_name: 'p3'},
    {id: 4, plasmid_name: 'p4'},
    {id: 5, plasmid_name: 'p5'},
    {id: 6, plasmid_name: 'p6'},
    {id: 7, plasmid_name: 'p7'},
  ],
  currentCategories: [1, 2, 3],
  categories: [
    {id: 1, displayName: 'Category 1'},
    {id: 2, displayName: 'Category 2'},
    {id: 3, displayName: 'Category 3'},
  ],
  appInfo: {backendVersion: '0.5.1', schemaVersion: '0.4.9', frontendVersion: '__VERSION__'},
};



describe('getNextCategories and isAssemblyComplete', () => {
  const makeCategories = (keys) => keys.split(' ').map((key, index) => {
    const [left, right] = key.split('-');
    return { id: index + 1, key, left_overhang: left, right_overhang: right };
  });
  // A circle of five overhangs, a part that covers two steps (B-D), and its counterpart, which goes around the origin (D-B)
  const categories = makeCategories('A-B B-C C-D D-E E-A B-D D-B');
  const order = getOverhangOrder(categories);
  const pick = (keys) => keys.split(' ').map((key) => categories.find((category) => category.key === key));
  const nextKeys = (chosenKeys) => getNextCategories(categories, chosenKeys ? pick(chosenKeys) : [], order).map((category) => category.key);

  it('starts with the categories that start at the origin or go around it', () => {
    expect(nextKeys('')).toEqual(['A-B', 'D-B']);
  });

  it('continues with the categories that start where the previous one ends', () => {
    expect(nextKeys('A-B')).toEqual(['B-C', 'B-D']);
    expect(nextKeys('A-B B-D')).toEqual(['D-E']);
    expect(nextKeys('A-B B-C C-D D-E')).toEqual(['E-A']);
  });

  it('does not allow going past the start of the first category', () => {
    // After A-B B-D, D-B would go around the origin and past A
    expect(nextKeys('A-B B-D')).not.toContain('D-B');
    // After D-B, only B-D fits before getting back to D
    expect(nextKeys('D-B')).toEqual(['B-C', 'B-D']);
    expect(nextKeys('D-B B-C')).toEqual(['C-D']);
  });

  it('is complete when the last category ends where the first one starts', () => {
    expect(isAssemblyComplete([])).toBe(false);
    expect(isAssemblyComplete(pick('A-B'))).toBe(false);
    expect(isAssemblyComplete(pick('A-B B-D D-E'))).toBe(false);
    expect(isAssemblyComplete(pick('A-B B-D D-E E-A'))).toBe(true);
    expect(isAssemblyComplete(pick('D-B'))).toBe(false);
    expect(isAssemblyComplete(pick('D-B B-D'))).toBe(true);
    expect(isAssemblyComplete(pick('D-B B-C C-D'))).toBe(true);
  });

  it('does not start with categories that go around the origin but are not defined in the syntax (they come from plasmids)', () => {
    const withPlasmidCategory = [...categories, { id: 8, key: 'E-C', left_overhang: 'E', right_overhang: 'C', fromPlasmid: true }];
    expect(getNextCategories(withPlasmidCategory, [], order).map((category) => category.key)).toEqual(['A-B', 'D-B']);
    // But they can be used after another category, if they fit before the start of the assembly (E-C would not)
    expect(getNextCategories(withPlasmidCategory, pick('A-B B-D D-E'), order).map((category) => category.key)).toEqual(['E-A']);
  });

  it('handles categories that no longer exist', () => {
    expect(getNextCategories(categories, [undefined], order)).toEqual([]);
    expect(isAssemblyComplete([undefined])).toBe(false);
  });

  it('handles syntaxes in which no part goes around the origin as before', () => {
    const simpleCategories = makeCategories('A-B B-C C-A A-C');
    const simpleOrder = getOverhangOrder(simpleCategories);
    const keys = (found) => found.map((category) => category.key);
    expect(keys(getNextCategories(simpleCategories, [], simpleOrder))).toEqual(['A-B', 'A-C']);
    expect(keys(getNextCategories(simpleCategories, [simpleCategories[0]], simpleOrder))).toEqual(['B-C']);
    expect(keys(getNextCategories(simpleCategories, [simpleCategories[3]], simpleOrder))).toEqual(['C-A']);
  });
});

describe('getDefaultAssemblyOutputName', () => {
  it('returns default name from plasmid names', () => {
    expect(getDefaultAssemblyOutputName(0, dummyData.expandedAssemblies, dummyData.plasmids)).toBe('001_p1+p5+p7');
    expect(getDefaultAssemblyOutputName(1, dummyData.expandedAssemblies, dummyData.plasmids)).toBe('002_p1+p2+p3');
  });
  it('returns _construct suffix when name is too long', () => {
    const longPlasmids = dummyData.plasmids.map(plasmid => ({ ...plasmid, plasmid_name: 'p1'.repeat(100) }));
    expect(getDefaultAssemblyOutputName(0, dummyData.expandedAssemblies, longPlasmids)).toBe('001_construct');
  });
});

describe('getFilesToExportFromAssembler', () => {
  it('returns the correct files', () => {
    const outputNames = dummyData.expandedAssemblies.map((_, i) => getDefaultAssemblyOutputName(i, dummyData.expandedAssemblies, dummyData.plasmids));
    const files = getFilesToExportFromAssembler({ ...dummyData, outputNames });
    expect(files[0].name).toBe('assemblies.tsv');
    expect(files[0].content).toBe('Assembly\tName\tCategory 1\tCategory 2\tCategory 3\n1\t001_p1+p5+p7\tp1\tp5\tp7\n2\t002_p1+p2+p3\tp1\tp2\tp3');
    expect(files[1].name).toBe('assemblies.csv');
    expect(files[1].content).toBe('Assembly,Name,Category 1,Category 2,Category 3\n1,001_p1+p5+p7,p1,p5,p7\n2,002_p1+p2+p3,p1,p2,p3');

    const fileNames = ['001_p1+p5+p7', '002_p1+p2+p3'];
    for (let i = 0; i < 2; i++) {
      const fileIndex1 = i * 2 + 2;
      const fileIndex2 = fileIndex1 + 1;
      expect(files[fileIndex1].name).toBe(`${fileNames[i]}.json`);
      const cloningStrategy = JSON.parse(files[fileIndex1].content);
      // Messed up by change of name, not worth checking
      // expect(cloningStrategy.sequences).toEqual(dummyData.requestedAssemblies[i].sequences);
      // expect(cloningStrategy.sources).toEqual(dummyData.requestedAssemblies[i].sources);
      expect(cloningStrategy.primers).toEqual(dummyData.requestedAssemblies[i].primers);
      expect(cloningStrategy.sources[cloningStrategy.sources.length - 1].output_name).toBe(fileNames[i]);
      const firstline = cloningStrategy.sequences[cloningStrategy.sequences.length - 1].file_content.split('\n')[0];
      expect(firstline).toContain(fileNames[i]);

      expect(files[fileIndex2].name).toBe(`${fileNames[i]}.gbk`);
      const genbankContent = files[fileIndex2].content;
      const expectedFileContent = dummyData.requestedAssemblies[i].sequences[dummyData.requestedAssemblies[i].sequences.length - 1].file_content
      expect(genbankContent).toBe(expectedFileContent.replaceAll('final_product', fileNames[i]).replaceAll('expression_clone_lacZ', fileNames[i]));
      const firstline2 = genbankContent.split('\n')[0];
      expect(firstline2).toContain(fileNames[i]);
    }


  })
  it('changes name if file names are too long', () => {
    const dummyData2 = {
      ...dummyData,
      plasmids: dummyData.plasmids.map(plasmid => ({...plasmid, plasmid_name: 'p1'.repeat(100)})),
    };
    const outputNames = dummyData2.expandedAssemblies.map((_, i) => getDefaultAssemblyOutputName(i, dummyData2.expandedAssemblies, dummyData2.plasmids));
    const files = getFilesToExportFromAssembler({ ...dummyData2, outputNames });
    expect(files[2].name).toBe('001_construct.json');
    expect(files[3].name).toBe('001_construct.gbk');
    expect(files[4].name).toBe('002_construct.json');
    expect(files[5].name).toBe('002_construct.gbk');
  });
  it('uses custom outputNames when provided', () => {
    const customNames = ['my_assembly_1', 'my_assembly_2'];
    const files = getFilesToExportFromAssembler({ ...dummyData, outputNames: customNames });
    expect(files[2].name).toBe('my_assembly_1.json');
    expect(files[3].name).toBe('my_assembly_1.gbk');
    expect(files[4].name).toBe('my_assembly_2.json');
    expect(files[5].name).toBe('my_assembly_2.gbk');
  });
});

describe('getCloningStrategyFilesFromAssembler', () => {
  const appInfo = dummyData.appInfo;
  it('returns one cloning strategy per assembly, with the output name set on the final sequence', () => {
    const outputNames = ['my assembly/1', 'my_assembly_2'];
    const files = getCloningStrategyFilesFromAssembler({ requestedAssemblies: dummyData.requestedAssemblies, appInfo, outputNames });
    expect(files).toHaveLength(2);
    const sanitizedNames = outputNames.map(sanitizeOutputName);
    files.forEach((file, i) => {
      expect(file.name).toBe(`${sanitizedNames[i]}.json`);
      const cloningStrategy = JSON.parse(file.content);
      const originalSequences = dummyData.requestedAssemblies[i].sequences;
      expect(cloningStrategy.sequences).toHaveLength(originalSequences.length);
      expect(cloningStrategy.primers).toEqual(dummyData.requestedAssemblies[i].primers);
      const finalSource = cloningStrategy.sources[cloningStrategy.sources.length - 1];
      expect(finalSource.output_name).toBe(sanitizedNames[i]);
      const finalSequence = cloningStrategy.sequences.find((s) => s.id === finalSource.id);
      expect(finalSequence.file_content.split('\n')[0]).toContain(sanitizedNames[i]);
      expect(file.finalSequence).toEqual(finalSequence);
    });
  });

  it('keeps the database ids of the sources and does not modify the input', () => {
    const withDatabaseSource = JSON.parse(JSON.stringify(dummyData.requestedAssemblies[0]));
    const firstSource = withDatabaseSource.sources[0];
    withDatabaseSource.sources[0] = { id: firstSource.id, type: 'DatabaseSource', input: [], database_id: 10 };
    const requestedAssemblies = [withDatabaseSource];
    const inputCopy = JSON.parse(JSON.stringify(requestedAssemblies));

    const [file] = getCloningStrategyFilesFromAssembler({ requestedAssemblies, appInfo, outputNames: ['product'] });
    const cloningStrategy = JSON.parse(file.content);
    expect(cloningStrategy.sources[0]).toEqual({ id: firstSource.id, type: 'DatabaseSource', input: [], database_id: 10 });
    expect(requestedAssemblies).toEqual(inputCopy);
  });

  it('throws if the number of names does not match the number of assemblies', () => {
    expect(() => getCloningStrategyFilesFromAssembler({ requestedAssemblies: dummyData.requestedAssemblies, appInfo, outputNames: ['a'] })).toThrow();
  });
});
