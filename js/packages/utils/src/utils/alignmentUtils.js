import { getReverseComplementSequenceAndAnnotations, getReverseComplementSequenceString, rotateSequenceDataToPosition } from '@teselagen/sequence-utils';
import { findRotation, syncChromatogramDataWithAlignment } from './sequenceManipulation.js';

/**
 * Process alignment sequence data by handling rotation and reverse complement.
 * If fileContent has features, it aligns the sequence data to match the alignment
 * by computing rotation and optionally reverse-complementing.
 */
export function processAlignmentSequenceData(fileContent, alignmentSequence) {
  if (!(fileContent.features && fileContent.features.length > 0)) {
    return {
      name: fileContent.name || '',
      sequence: alignmentSequence,
    };
  }

  let alignmentSequenceData = fileContent;
  let rotation = findRotation(fileContent.sequence, alignmentSequence);
  const reverseComplemented = rotation === -1;
  if (reverseComplemented) {
    rotation = findRotation(fileContent.sequence, getReverseComplementSequenceString(alignmentSequence));
    alignmentSequenceData = getReverseComplementSequenceAndAnnotations(fileContent);
  }
  if (rotation !== -1 && rotation !== 0) {
    rotation = reverseComplemented ? fileContent.sequence.length - rotation : rotation;
    alignmentSequenceData = rotateSequenceDataToPosition(alignmentSequenceData, rotation);
  }
  return alignmentSequenceData;
}

/**
 * Build a single alignment track from parsed file content and an alignment file object.
 * @param {Object} fileContent - Parsed sequence data (output of getTeselaJsonFromBase64)
 * @param {Object} alignmentFile - Alignment file object with { file_name, alignment }
 * @returns {{ sequenceData: Object, alignmentData: Object, chromatogramData: Object|undefined }}
 */
export function buildAlignmentTrack(fileContent, alignmentFile) {
  const alignmentSequence = alignmentFile.alignment[1].replaceAll('-', '');
  let chromatogramData = fileContent.chromatogramData;

  if (chromatogramData) {
    chromatogramData = syncChromatogramDataWithAlignment(chromatogramData, alignmentFile.alignment[1]);
  }

  const alignmentSequenceData = processAlignmentSequenceData(fileContent, alignmentSequence);

  return {
    sequenceData: { ...alignmentSequenceData, name: alignmentFile.file_name },
    alignmentData: {
      sequence: alignmentFile.alignment[1],
      name: alignmentFile.file_name,
    },
    chromatogramData,
  };
}

/**
 * Build the reference (first) alignment track.
 * @param {Object} sequenceData - The reference sequence data
 * @param {string} firstAlignmentSequence - The alignment string for the reference
 * @returns {{ sequenceData: Object, alignmentData: Object }}
 */
export function buildReferenceTrack(sequenceData, firstAlignmentSequence) {
  return {
    sequenceData,
    alignmentData: {
      sequence: firstAlignmentSequence,
      name: sequenceData.name,
    },
  };
}

/**
 * Build the full alignment configuration object for addAlignment.
 * @param {number} id - Sequence id
 * @param {Object} sequenceData - Reference sequence data
 * @param {Array} alignmentTracks - Array of alignment track objects (reference + others)
 * @returns {Object} Alignment config for addAlignment
 */
export function buildAlignmentConfig(id, sequenceData, alignmentTracks) {
  return {
    id: 'simpleAlignment',
    alignmentType: 'Sequencing alignment',
    name: `Seq. ${id}`,
    alignmentAnnotationVisibility: {
      features: true,
      parts: true,
      translations: true,
    },
    alignmentTracks,
  };
}

/**
 * Remove a panel from panelsShown by id.
 * @param {Array} panelsShown - Current panelsShown array (array of arrays)
 * @param {string} panelId - The panel id to remove
 * @returns {Array} New panelsShown with the panel filtered out
 */
export function removePanelFromShown(panelsShown, panelId) {
  return [[...panelsShown[0].filter((p) => p.id !== panelId)]];
}

/**
 * Return new panelsShown with the simpleAlignment panel appended.
 * @param {Array} panelsShown - Current panelsShown (already with simpleAlignment removed)
 * @returns {Array} New panelsShown with simpleAlignment panel added
 */
export function updatePanelsShownWithAlignment(panelsShown) {
  return [[
    ...panelsShown[0].filter((p) => p.id !== 'simpleAlignment'),
    {
      id: 'simpleAlignment',
      type: 'alignment',
      name: 'Alignments',
      active: true,
      isFullscreen: false,
    },
  ]];
}
