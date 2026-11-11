import { useStore } from 'react-redux';
import { updateEditor, addAlignment } from '@teselagen/ove';
import { getPCRPrimers } from '@opencloning/store/cloning_utils';
import { getTeselaJsonFromBase64 } from '@opencloning/utils/readNwrite';
import { getVerificationFileContent } from '@opencloning/utils/verificationFileStore';
import { buildAlignmentTrack, buildReferenceTrack, buildAlignmentConfig, removePanelFromShown, updatePanelsShownWithAlignment } from '@opencloning/utils/alignmentUtils';

export default function useStoreEditor() {
  const store = useStore();

  const updateStoreEditor = async (editorName, id, selectionLayer = {}) => {
    if (id === null) {
      // if id is null and selectionLayer is empty, clear the sequenceData
      if (Object.keys(selectionLayer).length === 0) {
        updateEditor(store, editorName, { sequenceData: {}, selectionLayer, sequenceDataHistory: {} });
      } else {
        updateEditor(store, editorName, { selectionLayer, sequenceDataHistory: {} });
      }
    } else {
      // otherwise, update the sequenceData with the new id
      const { cloning } = store.getState();
      const { teselaJsonCache } = cloning;
      const sequenceData = { ...teselaJsonCache[id] };
      const sequence = cloning.sequences.find((e) => e.id === id);
      const sequenceWithoutSequencingField = { ...sequence };
      delete sequenceWithoutSequencingField.sequencing;
      const pcrPrimers = getPCRPrimers(cloning, id);
      const alignmentFiles = cloning.files.filter((e) => e.sequence_id === id && e.file_type === 'Sequencing file');
      let { panelsShown } = store.getState().VectorEditor.mainEditor;
      panelsShown = removePanelFromShown(panelsShown, 'simpleAlignment');

      if (alignmentFiles.length > 0) {
        const referenceTrack = buildReferenceTrack(sequenceData, alignmentFiles[0].alignment[0]);
        const otherTracks = await Promise.all(alignmentFiles.map(async (aln) => {
          const fileContent = await getTeselaJsonFromBase64(getVerificationFileContent(`verification-${id}-${aln.file_name}`), aln.file_name);
          return buildAlignmentTrack(fileContent, aln);
        }));
        const alignmentConfig = buildAlignmentConfig(id, sequenceData, [referenceTrack, ...otherTracks]);
        addAlignment(store, alignmentConfig);
        panelsShown = updatePanelsShownWithAlignment(panelsShown);
      }
      sequenceData.primers = sequenceData.primers.concat([...pcrPrimers]);
      updateEditor(store, editorName, { sequenceData, selectionLayer, panelsShown, sequenceDataHistory: {} });
    }
  };

  return { updateStoreEditor };
}
