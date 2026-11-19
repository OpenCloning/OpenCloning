import { cloneDeep } from 'lodash-es';
import { base64ToBlob, downloadState, loadFilesToVerificationStore } from './readNwrite';
import { cloningActions } from '@opencloning/store/cloning';
import { collectParentSequencesAndSources, getSubState, mergeStates } from './network';
import { getVerificationFileName } from './readNwrite';
import { getVerificationFileContent } from './verificationFileStore';
import { getUsedPrimerIds } from '@opencloning/store/cloning_utils';

const { setState: setCloningState } = cloningActions;

// Download the history of a given sequence, as json or zip (by default, the extension of fileName).
// Rejects if the file cannot be made (e.g. a verification file is missing).
export const exportSubStateThunk = (fileName, sequenceId, format = undefined) => async (dispatch, getState) => {
  const substate = getSubState(getState(), sequenceId);
  await downloadState({ ...substate, description: '' }, fileName, format);
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
