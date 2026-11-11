import { isRangeWithinRange } from '@teselagen/range-utils';
import { getComplementSequenceString, getAminoAcidFromSequenceTriplet, getDigestFragmentsForRestrictionEnzymes, getReverseComplementSequenceString } from '@teselagen/sequence-utils';
import { allSimplePaths } from 'graphology-simple-path';
import { openCycleAtNode } from './graph_utils';
import { downloadBlob, formatStateForJsonExport, getZipFileBlob } from '@opencloning/utils/readNwrite';
import { getGraftSequenceId } from '@opencloning/utils/network';
import { TextReader} from '@zip.js/zip.js';
import { editGenbankSequenceNameFromTextContent } from '@opencloning/utils';

export const MAX_OUTPUT_NAME_LENGTH = 250;

export function tripletsToTranslation(triplets) {
  if (!triplets) return ''
  return triplets.map(triplet =>
    /[^ACGT]/i.test(triplet) ? ' - ' :
      getAminoAcidFromSequenceTriplet(triplet).threeLettersName.replace('Stop', '***')
  ).join('')
}

export function partDataToDisplayData(data) {
  const {
    left_codon_start: leftCodonStart,
    right_codon_start: rightCodonStart,
    left_overhang: leftOverhang,
    right_overhang: rightOverhang,
    left_inside: leftInside,
    right_inside: rightInside,
    glyph
  } = data
  const leftOverhangRc = getComplementSequenceString(leftOverhang)
  const rightOverhangRc = getComplementSequenceString(rightOverhang)
  const leftInsideRc = getComplementSequenceString(leftInside)
  const rightInsideRc = getComplementSequenceString(rightInside)
  let leftTranslationOverhang = ''
  let leftTranslationInside = ''
  if (leftCodonStart) {
    const triplets = (leftOverhang + leftInside).slice(leftCodonStart - 1).match(/.{3}/g)
    const padding = ' '.repeat(leftCodonStart - 1)
    const translationLeft = padding + tripletsToTranslation(triplets)
    leftTranslationOverhang = translationLeft.slice(0, leftOverhang.length)
    leftTranslationInside = translationLeft.slice(leftOverhang.length)
  }
  let rightTranslationOverhang = ''
  let rightTranslationInside = ''
  if (rightCodonStart) {
    const triplets = (rightInside + rightOverhang).slice(rightCodonStart - 1).match(/.{3}/g)
    const padding = ' '.repeat(rightCodonStart - 1)
    const translationRight = padding + tripletsToTranslation(triplets)
    rightTranslationInside = translationRight.slice(0, rightInside.length)
    rightTranslationOverhang = translationRight.slice(rightInside.length)
  }
  return {
    leftTranslationOverhang,
    leftTranslationInside,
    rightTranslationOverhang,
    rightTranslationInside,
    leftOverhangRc,
    rightOverhangRc,
    leftInsideRc,
    rightInsideRc,
  }
}


export function simplifyDigestFragment({cut1, cut2}) {
  return {
    left: {ovhg: cut1.overhangBps.toUpperCase(), forward: cut1.forward},
    right: {ovhg: cut2.overhangBps.toUpperCase(), forward: cut2.forward},
  };
};

export function reverseComplementSimplifiedDigestFragment({left, right, longestFeature}) {
  return {
    left: {ovhg: getReverseComplementSequenceString(right.ovhg), forward: !right.forward},
    right: {ovhg: getReverseComplementSequenceString(left.ovhg), forward: !left.forward},
    longestFeature
  };
}

export function longestFeatureInDigestFragment(digestFragment, sequenceData) {
  const {cut1, cut2} = digestFragment;
  const leftEdge = cut1.overhangSize >=0 ? cut1.topSnipPosition : cut1.bottomSnipPosition;
  const rightEdge = cut2.overhangSize >=0 ? cut2.bottomSnipPosition : cut2.topSnipPosition;
  if (!sequenceData.features || sequenceData.features.length === 0) return null;
  const featuresInside = sequenceData.features.filter(feature => isRangeWithinRange(feature, {start: leftEdge, end: rightEdge}, sequenceData.length));
  return featuresInside.reduce((longest, feature) => {
    if (!longest) return feature;
    return feature.end - feature.start > longest.end - longest.start ? feature : longest;
  }, null);
}

export function getSimplifiedDigestFragments(sequenceData, enzymes) {
  const { sequence, circular } = sequenceData;

  const digestFragments = getDigestFragmentsForRestrictionEnzymes(
    sequence,
    circular,
    enzymes,
  );

  const longestFeatures = digestFragments.map(fragment => longestFeatureInDigestFragment(fragment, sequenceData));
  const simplifiedDigestFragments = digestFragments.map(simplifyDigestFragment);
  simplifiedDigestFragments.forEach((fragment, index) => {
    fragment.longestFeature = longestFeatures[index];
  });
  const simplifiedDigestFragmentsRc = simplifiedDigestFragments.map(reverseComplementSimplifiedDigestFragment);
  return simplifiedDigestFragments.concat(simplifiedDigestFragmentsRc);
}

export function isFragmentPalindromic(fragment) {
  return (
    (fragment.left.ovhg === getReverseComplementSequenceString(fragment.left.ovhg)) &&
    (fragment.right.ovhg === getReverseComplementSequenceString(fragment.right.ovhg))
  )
}

export function assignSequenceToSyntaxPart(sequenceData, enzymes, graph) {
  // Something that is important to understand here is the meaning of forward and reverse.
  // It does not mean whether the overhang is 5' or 3', the value on the top strand is always
  // used, which is convenient for classification within the syntax.
  // Instead, forward means whether the recognition site was forward or reverse when producing that cut.
  // see the test called "shows the meaning of forward and reverse" for more details.
  const foundParts = [];

  // Enzymes are processed in order, so the first enzyme that finds a part is used.
  // This is for syntaxes like GoldenBraid, that in the omega 1 assembly uses BsmBI
  // for the backbone, and BtgZI for the parts.
  // The order of the enzymes therefore matters, and in that case we put BsmBI first,
  // because in principle domesticated parts should not have BsmBI recognition sites.
  for (const enzyme of enzymes) {
    const simplifiedDigestFragments = getSimplifiedDigestFragments(sequenceData, [enzyme]);
    simplifiedDigestFragments
      .filter(f => f.left.forward && !f.right.forward && graph.hasNode(f.left.ovhg) && graph.hasNode(f.right.ovhg))
      .forEach(fragment => {
        const graphForPaths = isFragmentPalindromic(fragment) ? openCycleAtNode(graph, graph.nodes()[0]) : graph;
        const paths = allSimplePaths(graphForPaths, fragment.left.ovhg, fragment.right.ovhg);
        if (paths.length > 0) {
          foundParts.push({left_overhang: fragment.left.ovhg, right_overhang: fragment.right.ovhg, longestFeature: fragment.longestFeature});
        }
      });
    if (foundParts.length > 0) {
      break;
    }
  }
  return foundParts;
}

export function arrayCombinations(sets) {
  if (sets.length === 0) {
    return null;
  } else if (sets.length === 1) {
    return sets[0].map((el) => [el]);
  } else
    return sets[0].flatMap((val) =>
      arrayCombinations(sets.slice(1)).map((c) => [val].concat(c))
    );
};

export function categoryFilter(category, categories, previousCategoryId) {
  if (previousCategoryId === null) {
    return category.left_overhang === categories[0].left_overhang
  }
  const previousCategory = categories.find((category) => category.id === previousCategoryId)
  return previousCategory?.right_overhang === category.left_overhang
}

export function getDefaultAssemblyOutputName(assemblyIndex, expandedAssemblies, plasmids) {
  const assembly = expandedAssemblies[assemblyIndex];
  const plasmidNames = assembly.map(part => plasmids.find(p => p.id === part)?.plasmid_name ?? '');
  let name = `${String(assemblyIndex + 1).padStart(3, '0')}_${plasmidNames.join('+')}`.replaceAll('/', '_').replaceAll(' ', '_');
  if (name.length > MAX_OUTPUT_NAME_LENGTH) {
    name = `${String(assemblyIndex + 1).padStart(3, '0')}_construct`;
  }
  return name;
}

export function sanitizeOutputName(name) {
  let sanitized = name.replaceAll('/', '_').replaceAll(' ', '_');
  if (sanitized.length > MAX_OUTPUT_NAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_OUTPUT_NAME_LENGTH);
  }
  return sanitized;
}

export function getFilesToExportFromAssembler({requestedAssemblies, expandedAssemblies, plasmids, currentCategories, categories, appInfo, outputNames}) {
  if (outputNames.length !== requestedAssemblies.length) {
    throw new Error('outputNames must be the same length as requestedAssemblies');
  }
  const files2Export = [];
  const categoryNames = ['Assembly', 'Name', ...currentCategories.map(categoryId => categories.find(c => c.id === categoryId).displayName)];
  const assemblyNames = expandedAssemblies.map((assembly, index) => {
    const plasmidNames = assembly.map(part => plasmids.find(p => p.id === part).plasmid_name);
    return [index + 1, outputNames[index], ...plasmidNames];
  });
  for (const delimiter of ['\t', ',']) {
    const tableHeader = categoryNames.join(delimiter);
    const tableRows = assemblyNames.map(assemblyName => assemblyName.join(delimiter));
    const table = [tableHeader, ...tableRows].join('\n');
    const extension = delimiter === '\t' ? 'tsv' : 'csv';
    files2Export.push({
      name: `assemblies.${extension}`,
      content: table,
    });
  }

  getCloningStrategyFilesFromAssembler({ requestedAssemblies, appInfo, outputNames }).forEach(({ name, content, finalSequence }) => {
    files2Export.push({ name, content });
    files2Export.push({
      name: name.replace(/\.json$/, '.gbk'),
      content: finalSequence.file_content,
    });
  });
  return files2Export;
}

/**
 * One cloning strategy JSON file per assembly, with the output name set on the final sequence.
 * Returns [{ name: '<name>.json', content: '<json string>', finalSequence }]. The input is not modified.
 */
export function getCloningStrategyFilesFromAssembler({ requestedAssemblies, appInfo, outputNames }) {
  if (outputNames.length !== requestedAssemblies.length) {
    throw new Error('outputNames must be the same length as requestedAssemblies');
  }
  return requestedAssemblies.map((assembly, i) => {
    const name = sanitizeOutputName(outputNames[i]);
    const requestedAssembly = JSON.parse(JSON.stringify(assembly));
    const finalSequenceId = getGraftSequenceId(requestedAssembly)
    const finalSequence = requestedAssembly.sequences.find(s => s.id === finalSequenceId)
    finalSequence.file_content = editGenbankSequenceNameFromTextContent(finalSequence.file_content, name);
    const finalSource = requestedAssembly.sources.find(s => s.id === finalSequenceId)
    finalSource.output_name = name;
    const jsonContent = formatStateForJsonExport({...requestedAssembly, appInfo});
    return {
      name: `${name}.json`,
      content: JSON.stringify(jsonContent, null, 2),
      finalSequence,
    };
  });
}

export async function downloadAssemblerFilesAsZip(files) {
  const files2write = files.map(({name, content}) => ({name, reader: new TextReader(content)}));

  const blob = await getZipFileBlob(files2write);
  downloadBlob(blob, 'assemblies.zip');
}
