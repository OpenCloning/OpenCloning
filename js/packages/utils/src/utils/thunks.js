import { cloneDeep } from 'lodash-es';
import { base64ToBlob, downloadStateAsJson, downloadStateAsZip, loadFilesToVerificationStore } from './readNwrite';
import { cloningActions } from '@opencloning/store/cloning';
import { collectParentSequencesAndSources, getSubState, mergeStates } from './network';
import { getVerificationFileName } from './readNwrite';
import { getVerificationFileContent } from './verificationFileStore';
import { getUsedPrimerIds } from '@opencloning/store/cloning_utils';

const { setState: setCloningState } = cloningActions;

export const exportSubStateThunk = (fileName, sequenceId, format = 'json') => async (dispatch, getState) => {
  // Download the subHistory for a given sequence
  const state = getState();
  const substate = getSubState(state, sequenceId);
  if (format === 'json') {
    downloadStateAsJson({ ...substate, description: '' }, fileName);
  } else if (format === 'zip') {
    downloadStateAsZip({ ...substate, description: '' }, fileName);
  } else {
    throw new Error(`Invalid format: ${format}`);
  }
};

export const CopySequenceThunk = (sequenceId) => async (dispatch, getState) => {
  const state = getState();
  const { sequences, sources } = state.cloning;
  const sequencesToCopy = sequences.filter((e) => e.id === sequenceId);
  const sourcesToCopy = sources.filter((s) => s.id === sequenceId);
  const { parentSequences, parentSources } = collectParentSequencesAndSources(sourcesToCopy[0], sources, sequences);
  sequencesToCopy.push(...parentSequences);
  sourcesToCopy.push(...parentSources);
  const primerIdsToCopy = getUsedPrimerIds(sourcesToCopy);
  const primersToCopy = state.cloning.primers.filter((p) => primerIdsToCopy.includes(p.id));
  const sequenceIds = sequencesToCopy.map((e) => e.id);
  const filesToCopy = state.cloning.files.filter((f) => sequenceIds.includes(f.sequence_id));
  const newState = cloneDeep({
    sequences: sequencesToCopy,
    sources: sourcesToCopy,
    primers: primersToCopy,
    files: filesToCopy,
  });
  const files = filesToCopy.map((f) => new File(
    [base64ToBlob(getVerificationFileContent(getVerificationFileName(f)))],
    getVerificationFileName(f),
    { type: 'application/octet-stream' },
  ));
  const { mergedState, idShift } = mergeStates(newState, state.cloning, false);
  dispatch(setCloningState(mergedState));
  await loadFilesToVerificationStore(files, idShift);
};
