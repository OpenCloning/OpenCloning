import { selectedRegion2SequenceLocation } from '@opencloning/utils/selectedRegionUtils';
import { ebicTemplateAnnotation, joinSequencesIntoSingleSequence, simulateHomologousRecombination } from '@opencloning/utils/sequenceManipulation';

const designTypeStrategies = {
  simple_pair: {
    computeProduct({ sequences, rois, fragmentOrientations, spacers, circularAssembly }) {
      const product = joinSequencesIntoSingleSequence(
        sequences, rois.map((s) => s.selectionLayer), fragmentOrientations,
        spacers, circularAssembly, 'primer tail',
      );
      product.name = 'PCR product';
      return product;
    },
    buildRequest({ sequences, sequenceIds, rois, fragmentOrientations, spacers, teselaJsonCache, paramsForRequest }) {
      return {
        endpoint: 'simple_pair',
        params: { ...paramsForRequest },
        requestData: {
          pcr_template: {
            sequence: sequences.find((e) => e.id === sequenceIds[0]),
            location: selectedRegion2SequenceLocation(rois[0], teselaJsonCache[sequenceIds[0]].size),
            forward_orientation: fragmentOrientations[0] === 'forward',
          },
          spacers,
        },
      };
    },
  },

  restriction_ligation: {
    computeProduct({ sequences, rois, fragmentOrientations, spacers, circularAssembly, primerDesignSettings }) {
      const { enzymeSpacers } = primerDesignSettings;
      const extendedSpacers = [enzymeSpacers[0] + spacers[0], spacers[1] + enzymeSpacers[1]];
      const product = joinSequencesIntoSingleSequence(
        sequences, rois.map((s) => s.selectionLayer), fragmentOrientations,
        extendedSpacers, circularAssembly, 'primer tail',
      );
      product.name = 'PCR product';
      return product;
    },
    buildRequest({ sequences, sequenceIds, rois, fragmentOrientations, spacers, teselaJsonCache, paramsForRequest }) {
      return {
        endpoint: 'simple_pair',
        params: { ...paramsForRequest },
        requestData: {
          pcr_template: {
            sequence: sequences.find((e) => e.id === sequenceIds[0]),
            location: selectedRegion2SequenceLocation(rois[0], teselaJsonCache[sequenceIds[0]].size),
            forward_orientation: fragmentOrientations[0] === 'forward',
          },
          spacers,
        },
      };
    },
  },

  gibson_assembly: {
    computeProduct({ sequences, rois, fragmentOrientations, spacers, circularAssembly }) {
      const locations = rois.map((roi, i) => {
        if (roi) return roi.selectionLayer;
        return { start: 0, end: sequences[i].size - 1 };
      });
      const product = joinSequencesIntoSingleSequence(sequences, locations, fragmentOrientations, spacers, circularAssembly);
      product.name = 'Gibson Assembly product';
      return product;
    },
    buildRequest({ sequences, sequenceIds, rois, fragmentOrientations, spacers, isAmplified, teselaJsonCache, paramsForRequest, circularAssembly }) {
      return {
        endpoint: 'gibson_assembly',
        params: { ...paramsForRequest, circular: circularAssembly },
        requestData: {
          pcr_templates: sequenceIds.map((id, index) => ({
            sequence: sequences.find((e) => e.id === id),
            location: isAmplified[index]
              ? selectedRegion2SequenceLocation(rois[index], teselaJsonCache[id].size)
              : null,
            forward_orientation: fragmentOrientations[index] === 'forward',
          })),
          spacers,
        },
      };
    },
  },

  homologous_recombination: {
    computeProduct({ sequences, rois, fragmentOrientations, spacers }) {
      const product = simulateHomologousRecombination(
        sequences[0], sequences[1], rois, fragmentOrientations[0] === 'reverse', spacers,
      );
      product.name = 'Homologous recombination product';
      return product;
    },
    buildRequest({ sequences, sequenceIds, rois, fragmentOrientations, spacers, teselaJsonCache, paramsForRequest }) {
      const [pcrTemplateId, homologousRecombinationTargetId] = sequenceIds;
      return {
        endpoint: 'homologous_recombination',
        params: { ...paramsForRequest },
        requestData: {
          pcr_template: {
            sequence: sequences.find((e) => e.id === pcrTemplateId),
            location: selectedRegion2SequenceLocation(rois[0], teselaJsonCache[pcrTemplateId].size),
            forward_orientation: fragmentOrientations[0] === 'forward',
          },
          homologous_recombination_target: {
            sequence: sequences.find((e) => e.id === homologousRecombinationTargetId),
            location: selectedRegion2SequenceLocation(rois[1], teselaJsonCache[homologousRecombinationTargetId].size),
          },
          spacers,
        },
      };
    },
  },

  gateway_bp: {
    computeProduct({ sequences, rois, fragmentOrientations, spacers, primerDesignSettings }) {
      const product = joinSequencesIntoSingleSequence(
        [sequences[0]], [rois[0].selectionLayer], fragmentOrientations, spacers, false, 'primer tail',
      );
      product.name = 'PCR product';
      const { knownCombination } = primerDesignSettings;
      const leftFeature = {
        start: knownCombination.translationFrame[0],
        end: spacers[0].length - 1,
        type: 'CDS',
        name: 'translation frame',
        strand: 1,
        forward: true,
      };
      const nbAas = Math.floor((spacers[1].length - knownCombination.translationFrame[1]) / 3);
      const rightStart = product.sequence.length - knownCombination.translationFrame[1] - nbAas * 3;
      const rightFeature = {
        start: rightStart,
        end: product.sequence.length - knownCombination.translationFrame[1] - 1,
        type: 'CDS',
        name: 'translation frame',
        strand: 1,
        forward: true,
      };
      product.features.push(leftFeature);
      product.features.push(rightFeature);
      return product;
    },
    buildRequest({ sequences, sequenceIds, rois, fragmentOrientations, spacers, teselaJsonCache, paramsForRequest }) {
      return {
        endpoint: 'simple_pair',
        params: { ...paramsForRequest },
        requestData: {
          pcr_template: {
            sequence: sequences.find((e) => e.id === sequenceIds[0]),
            location: selectedRegion2SequenceLocation(rois[0], teselaJsonCache[sequenceIds[0]].size),
            forward_orientation: fragmentOrientations[0] === 'forward',
          },
          spacers,
        },
      };
    },
  },

  ebic: {
    computeProduct({ sequences, rois, primerDesignSettings }) {
      return ebicTemplateAnnotation(sequences[0], rois[0].selectionLayer, primerDesignSettings);
    },
    buildRequest({ sequences, rois, templateSequenceIds, teselaJsonCache, paramsForRequest }) {
      return {
        endpoint: 'ebic',
        params: { ...paramsForRequest },
        requestData: {
          template: {
            sequence: sequences.find((e) => e.id === templateSequenceIds[0]),
            location: selectedRegion2SequenceLocation(rois[0], teselaJsonCache[templateSequenceIds[0]].size),
          },
        },
      };
    },
  },
};

export default designTypeStrategies;
