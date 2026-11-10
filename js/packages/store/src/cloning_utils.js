import { parseFeatureLocation } from '@teselagen/bio-parsers';
import { flipContainedRange, getRangeLength } from '@teselagen/range-utils';

export const isSequenceInputOfAnySource = (id, sources) => (sources.find((source) => source.input.some(({sequence}) => sequence === id))) !== undefined;

export function getEmptyPlaceholderSource(sources) {
  if (sources.length === 1 && sources[0].type === null) {
    return sources[0];
  }
  return null;
}

export function getSourcesTakingSequenceAsInput(sources, sequenceId) {
  return sources.filter((s) => s.input.some(({sequence}) => sequence === sequenceId));
}

export function isCompletePCRSource(source) {
  return source.type === 'PCRSource' && source.input.length === 3 && source.input[0].type === 'AssemblyFragment';
}

export function isCompleteOligoHybridizationSource(source) {
  return source.type === 'OligoHybridizationSource' && source.input.length === 2 && source.overhang_crick_3prime !== undefined && source.overhang_crick_3prime !== null;
}

export function getPcrTemplateSequenceId(source) {
  return source.input.length === 1 ? source.input[0].sequence : source.input[1].sequence;
}

export function getIdsOfSequencesWithoutChildSource(sources, sequences) {
  let idsSequencesWithChildSource = [];
  sources.forEach((source) => {
    idsSequencesWithChildSource = idsSequencesWithChildSource.concat(source.input.map(({sequence}) => sequence));
  });
  const sequencesNotChildSource = [];

  sequences.forEach((sequence) => {
    if (!idsSequencesWithChildSource.includes(sequence.id)) {
      sequencesNotChildSource.push(sequence);
    }
  });
  return sequencesNotChildSource.map((sequence) => sequence.id);
}

export function getInputSequencesFromSourceId(state, sourceId) {
  const thisSource = state.cloning.sources.find((s) => s.id === sourceId);
  // Sequences must be returned in the same order as in the source input, primers (undefined) are filtered out
  return thisSource.input.map(({sequence}) => state.cloning.sequences.find((e) => e.id === sequence)).filter((e) => e !== undefined);
}

/** True if any assembly input is linear (not circular) according to teselaJsonCache.*/
export function anyAssemblyInputIsLinear(source, teselaJsonCache) {
  const sequenceIds = source.input.map(({ sequence }) => sequence);
  // We test whether teselaJsonCache[id], because primers are also listed as inputs
  return sequenceIds.some((id) => teselaJsonCache[id] && (teselaJsonCache[id].circular !== true));
}

export function isSourceATemplate({ sources, sequences }, sourceId) {
  // Get the output sequence
  const source = sources.find((s) => s.id === sourceId);
  const sequences2 = [...sequences.filter((e) => e.id === source.id), ...sequences.filter((e) => source.input.some((i) => i.sequence === e.id))];
  return sequences2.some((s) => s.type === 'TemplateSequence');
}

export function getPrimerDesignObject({ sources, sequences }) {
  // Find sequences that are templates and have primer_design set
  const outputSequences = sequences.filter((e) => e.type === 'TemplateSequence' && Boolean(e.primer_design));
  if (outputSequences.length === 0) {
    // return 'No primer design sequence templates found';
    return { finalSource: null, otherInputIds: [], pcrSources: [], outputSequences: [], assemblyInputsInOrder: [] };
  }
  const mockSequenceIds = outputSequences.map((s) => s.id);

  // Find the PCRs from which the mock sequences are outputs
  const pcrSources = sources.filter((s) => s.type === 'PCRSource' && mockSequenceIds.includes(s.id));
  if (pcrSources.length === 0) {
    return { finalSource: null, otherInputIds: [], pcrSources: [], outputSequences: [], assemblyInputsInOrder: [] };
  }

  // Find the template sequences for those PCRs
  const templateSequences = sequences.filter((e) => pcrSources.some((ps) => ps.input.some((i) => i.sequence === e.id)));

  // They should not be mock sequences
  if (templateSequences.some((ts) => ts.type === 'TemplateSequence')) {
    // return 'TemplateSequence input to final source is a TemplateSequence';
    return { finalSource: null, otherInputIds: [], pcrSources: [], outputSequences: [], assemblyInputsInOrder: [] };
  }

  // Find the source they are input to (there should be zero or one)
  const finalSources = sources.filter((s) => s.input.some((i) => mockSequenceIds.includes(i.sequence)));

  if (finalSources.length === 0) {
    // return as is
    return { finalSource: null, otherInputIds: [], pcrSources, outputSequences, assemblyInputsInOrder: [] };
  }
  if (finalSources.length > 1) {
    // error
    return { finalSource: null, otherInputIds: [], pcrSources: [], outputSequences: [], assemblyInputsInOrder: [] };
  }

  const finalSource = finalSources[0];

  // Inputs to the finalSource that are not mock sequences with primer_design
  const otherInputIds = finalSource.input.map((i) => i.sequence).filter((i) => !mockSequenceIds.includes(i));
  const otherInputs = sequences.filter((e) => otherInputIds.includes(e.id));
  // There should be no TemplateSequence as an input that does not have primer_design set
  if (otherInputs.some((i) => i.type === 'TemplateSequence' && !Boolean(i.primer_design))) {
    // return 'TemplateSequence input to final source does not have primer_design set';
    return { finalSource: null, otherInputIds: [], pcrSources: [], outputSequences: [], assemblyInputsInOrder: [] };
  }

  // Build ordered assembly inputs for Gibson-like assemblies
  const assemblyInputsInOrder = finalSource.input.map((inputItem) => {
    const inputId = inputItem.sequence;
    if (mockSequenceIds.includes(inputId)) {
      const pcrSource = pcrSources.find((s) => s.id === inputId);
      return { templateSequenceId: getPcrTemplateSequenceId(pcrSource), isAmplified: true };
    }
    return { templateSequenceId: inputId, isAmplified: false };
  });

  return { finalSource, otherInputIds, pcrSources, outputSequences, assemblyInputsInOrder };
}

const formatPrimer = (primer, position) => {
  const { name, sequence, id } = primer;
  return {
    id: `${id}`,
    name,
    ...position,
    type: 'primer_bind',
    primerBindsOn: '3prime',
    forward: position.strand === 1,
    bases: sequence,
  };
};

export function pcrPrimerPositionsInInput(source, sequenceData) {
  if (source.type !== 'PCRSource') {
    throw new Error('Source is not a PCRSource');
  }
  const { size } = sequenceData;

  const fwd = parseFeatureLocation(source.input[1].left_location, 0, 0, 0, 1, size)[0];
  const rvs = parseFeatureLocation(source.input[1].right_location, 0, 0, 0, 1, size)[0];

  if (!source.input[1].reverse_complemented) {
    fwd.strand = 1;
    rvs.strand = -1;
    return [fwd, rvs];
  }

  const fwd2 = flipContainedRange(fwd, { start: 0, end: size - 1 }, size);
  const rvs2 = flipContainedRange(rvs, { start: 0, end: size - 1 }, size);

  fwd2.strand = -1;
  rvs2.strand = 1;
  return [fwd2, rvs2];
}

export function pcrPrimerPositionsInOutput(primers, sequenceData) {
  const [fwdPrimer, rvsPrimer] = primers;
  return [
    { start: 0, end: fwdPrimer.sequence.length - 1, strand: 1 },
    { start: sequenceData.size - rvsPrimer.sequence.length, end: sequenceData.size - 1, strand: -1 },
  ];
}

export function getPCRPrimers({ primers, sources, teselaJsonCache }, sequenceId) {
  let out = [];

  // Get PCRs that have this sequence as input
  const sourcesInput = getSourcesTakingSequenceAsInput(sources, sequenceId);
  const sequenceData = teselaJsonCache[sequenceId];

  sourcesInput.forEach((sourceInput) => {
    if (isCompletePCRSource(sourceInput)) {
      const pcrPrimers = [sourceInput.input[0].sequence, sourceInput.input[2].sequence].map((id) => primers.find((p) => p.id === id));
      const primerPositions = pcrPrimerPositionsInInput(sourceInput, sequenceData);
      out = out.concat(pcrPrimers.map((primer, i) => formatPrimer(primer, primerPositions[i])));
    }
  });

  // Get the PCR that have this sequence as output (if any)
  const sourceOutput = sources.find((s) => s.id === sequenceId);
  if (sourceOutput?.type === 'PCRSource') {
    const pcrPrimers = [sourceOutput.input[0].sequence, sourceOutput.input[2].sequence].map((id) => primers.find((p) => p.id === id));
    const primerPositions = pcrPrimerPositionsInOutput(pcrPrimers, sequenceData);
    out = out.concat(pcrPrimers.map((primer, i) => formatPrimer(primer, primerPositions[i])));
  }
  return out;
}

export function getNextUniqueId({ sources, sequences, primers }) {
  const allIds = [...sources.map((s) => s.id), ...sequences.map((e) => e.id), ...primers.map((p) => p.id)];
  if (allIds.length === 0) {
    return 1;
  }
  return Math.max(...allIds) + 1;
}

export function shiftSource(source, idShift) {
  const newSource = { ...source };
  // Common part
  newSource.id += idShift;
  newSource.input = newSource.input.map((sourceInput) => ({ ...sourceInput, sequence: sourceInput.sequence + idShift }));
  return newSource;
}

export function mergePrimersInSource(source, keepId, removeId) {
  const newSource = { ...source };
  if (isCompletePCRSource(newSource)) {
    if (newSource.input[0].sequence === removeId) {
      newSource.input[0].sequence = keepId;
    }
    if (newSource.input[2].sequence === removeId) {
      newSource.input[2].sequence = keepId;
    }
  } else if (newSource.type === 'OligoHybridizationSource' || newSource.type === 'CRISPRSource') {
    newSource.input = newSource.input.map((sourceInput) => {
      if (sourceInput.type === 'SourceInput' && sourceInput.sequence === removeId) {
        return { ...sourceInput, sequence: keepId };
      }
      return { ...sourceInput };
    });
  }

  return newSource;
}

export function shiftStateIds(newState, oldState, skipPrimers = false) {
  const { sources: newSources, sequences: newSequences, primers: newPrimers, files: newFiles } = newState;
  const { sources: oldSources, sequences: oldSequences, primers: oldPrimers } = oldState;
  let idShift = getNextUniqueId({ sources: oldSources, sequences: oldSequences, primers: oldPrimers });
  // Substract the smallest id to minimize the starting id
  idShift -= Math.min(...[...newSources.map((s) => s.id), ...newSequences.map((e) => e.id), ...newPrimers.map((p) => p.id)]);

  return {
    shiftedState: {
      sequences: newSequences.map((e) => ({ ...e, id: e.id + idShift })),
      primers: newPrimers.map((p) => ({ ...p, id: p.id + idShift })),
      sources: newSources.map((s) => shiftSource(s, idShift)),
      files: newFiles ? newFiles.map((f) => ({ ...f, sequence_id: f.sequence_id + idShift })) : [],
    },
    idShift, };
}

export function stringIsNotDNA(str) {
  return str.match(/[^agct]/i) !== null;
}

export function formatGatewaySites(sites) {
  const foundSites = [];
  Object.keys(sites).forEach((siteName) => {
    sites[siteName].forEach((location) => {
      foundSites.push({ siteName, location });
    });
  });
  return foundSites;
}

export function getSourceDatabaseId(sources, sequenceId) {
  const source = sources.find((s) => s.id === sequenceId);
  return source?.database_id;
}

export function primersInSource(source) {
  if (isCompletePCRSource(source)) {
    return [source.input[0].sequence, source.input[2].sequence];
  }
  if (source.type === 'OligoHybridizationSource' && source.input.length === 2) {
    return source.input.map(({sequence}) => sequence);
  }
  if (source.type === 'CRISPRSource') {
    return source.input.filter(({type}) => type === 'SourceInput').map(({sequence}) => sequence);
  }
  return [];
}

export function isAssemblyComplete(source) {
  return source.input?.some(({type}) => type === 'AssemblyFragment');
}

export function getUsedPrimerIds(sources) {
  return sources.flatMap((s) => primersInSource(s));
}

export function getSourcesWherePrimerIsUsed(sources, primerId) {
  return sources.filter((s) => primersInSource(s).includes(primerId));
}

export function getPrimerBindingInfoFromSource(primers, source, sequenceLength) {
  let fwdPrimer = null;
  let rvsPrimer = null;
  let fwdLength = 0;
  let rvsLength = 0;

  if (isCompletePCRSource(source)) {
    fwdPrimer = primers.find((p) => p.id === source.input[0].sequence);
    rvsPrimer = primers.find((p) => p.id === source.input[2].sequence);
    const fwdLocation = parseFeatureLocation(source.input[0].right_location, 0, 0, 0, 1, sequenceLength)[0];
    const rvsLocation = parseFeatureLocation(source.input[2].left_location, 0, 0, 0, 1, sequenceLength)[0];
    fwdLength = getRangeLength(fwdLocation, sequenceLength);
    rvsLength = getRangeLength(rvsLocation, sequenceLength);
    if (fwdLength < 0) {
      fwdLength += sequenceLength;
    }
    if (rvsLength < 0) {
      rvsLength += sequenceLength;
    }
  } else if (isCompleteOligoHybridizationSource(source)) {
    fwdPrimer = primers.find((p) => p.id === source.input[0].sequence);
    rvsPrimer = primers.find((p) => p.id === source.input[1].sequence);
    fwdLength = fwdPrimer.sequence.length + source.overhang_crick_3prime;
    rvsLength = fwdLength;
  }
  return { sourceId: source.id, sourceType: source.type, fwdPrimer, rvsPrimer, fwdLength, rvsLength };
}

export function doesSourceHaveOutput(cloningState, sourceId) {
  return Boolean(cloningState.sequences.find((s) => s.id === sourceId));
}

