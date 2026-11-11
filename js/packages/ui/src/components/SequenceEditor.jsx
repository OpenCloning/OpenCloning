import React from 'react';
import { SimpleCircularOrLinearView } from '@teselagen/ove';
import { useDispatch, useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import OverhangsDisplay from './OverhangsDisplay';
import NewSourceBox from './sources/NewSourceBox';
import { cloningActions } from '@opencloning/store/cloning';
import getTransformCoords from '@opencloning/utils/transformCoords';
import { getPCRPrimers, isSequenceInputOfAnySource } from '@opencloning/store/cloning_utils';

const transformToRegion = (eventOutput) => {
  if (eventOutput.selectionLayer) {
    // When selecting a region
    return { selectionLayer: eventOutput.selectionLayer, caretPosition: -1 };
  }
  // When clicking a feature
  return { selectionLayer: { start: eventOutput.start, end: eventOutput.end }, caretPosition: -1 };
};

function AddSourceComponent({ sequenceId }) {
  const isRootNode = useSelector((state) => !isSequenceInputOfAnySource(sequenceId, state.cloning.sources));
  return isRootNode ? (
    <div className="hang-from-node">
      <div>
        <NewSourceBox {...{ inputSequencesIds: [sequenceId] }} />
      </div>
    </div>
  ) : null;
}

function SequenceEditor({ sequenceId }) {
  const editorName = `editor_${sequenceId}`;
  const sequence = useSelector((state) => state.cloning.sequences.find((e) => e.id === sequenceId), isEqual);
  const pcrPrimers = useSelector(({ cloning }) => getPCRPrimers(cloning, sequenceId), isEqual);
  const unmutableSeq = useSelector((state) => state.cloning.teselaJsonCache[sequenceId], isEqual);
  const seq = { ...unmutableSeq };

  // Make a copy
  const seqCopy = React.useMemo(() => structuredClone(seq), [seq]);
  // Filter out features of type "source"
  seqCopy.features = seqCopy.features.filter((f) => f.type !== 'source');
  // If the primer has been already added to the template, we don't add it again
  const pcrPrimers2Include = pcrPrimers.filter((p) => !seqCopy.primers.some(
    (p2) => p2.name === p.name && p2.start === p.start && p2.end === p.end,
  ));
  seqCopy.primers = [...seqCopy.primers, ...pcrPrimers2Include];
  const parentSource = useSelector((state) => state.cloning.sources.find((source) => source.id === sequenceId), isEqual);
  const stateSelectedRegion = useSelector((state) => state.cloning.selectedRegions.find((r) => r.id === sequenceId)?.selectedRegion, isEqual);
  const parentSequenceData = useSelector((state) => parentSource.input.map(({sequence}) => state.cloning.teselaJsonCache[sequence]), isEqual);
  const [rangeInParent, setRangeInParent] = React.useState(() => null);
  React.useEffect(() => {
    const callBack = getTransformCoords(parentSource, parentSequenceData, seqCopy.size);
    // Here we have to set the state like this, since it's a function
    // otherwise, react calls the function with the previous state
    setRangeInParent(() => callBack);
  }, [parentSource, parentSequenceData]);

  const { setSelectedRegions } = cloningActions;
  const dispatch = useDispatch();
  const [selectedRegion, setSelectedRegion] = React.useState({ selectionLayer: { start: -1, end: -1 }, caretPosition: -1 });
  const [timeOutId, setTimeOutId] = React.useState(null);

  const { selectionLayer, caretPosition } = selectedRegion;

  React.useEffect(() => {
    if (stateSelectedRegion !== undefined) {
      setSelectedRegion(stateSelectedRegion);
    } else {
      setSelectedRegion({ selectionLayer: { start: -1, end: -1 }, caretPosition: -1 });
    }
  }, [stateSelectedRegion]);

  const updateSelectedRegion = (eventOutput, isCaret) => {
    if (isCaret) {
      // TODO: something here?
    } else {
      const newRegion = transformToRegion(eventOutput);
      const newTimeOutId = setTimeout(() => {
        const parentSequenceIds = parentSource.input.map(({sequence}) => sequence);
        // We add the current sequence to the selectedRegions array
        const selectedRegions = [{ id: sequenceId, selectedRegion: newRegion }];
        // If possible, add the equivalent region in the parent sequence
        parentSequenceIds.forEach((id) => {
          const selectionLayerAssembly = rangeInParent(newRegion.selectionLayer, id);
          if (selectionLayerAssembly !== null) {
            selectedRegions.push({ id, selectedRegion: { selectionLayer: selectionLayerAssembly, caretPosition: -1 } });
          }
        });
        dispatch(setSelectedRegions(selectedRegions));
      }, 500);
      setSelectedRegion(newRegion);
      setTimeOutId((prev) => {
        clearTimeout(prev);
        return newTimeOutId;
      });
    }
  };

  return (
    <div>
      <SimpleCircularOrLinearView {...{
        sequenceData: seqCopy,
        editorName,
        height: seq.circular ? null : 'auto',
        withCaretEnabled: true,
        withSelectionEnabled: true,
        selectionLayer,
        selectionLayerUpdate: (a) => updateSelectedRegion(a, false),
        // TODO: this does not work
        caretPosition,
        caretPositionUpdate: (a) => updateSelectedRegion(a, true),
      }}
      />
      <OverhangsDisplay {...{ sequenceData: seq, sequence }} />
      <AddSourceComponent {...{ sequenceId }} />
    </div>
  );
}

export default React.memo(SequenceEditor);
