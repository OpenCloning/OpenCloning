import React from 'react';
import { useSelector } from 'react-redux';
import isEqual from 'lodash-es/isEqual';
import { getSortedSourceIds } from '@opencloning/utils/network';
import NetWorkNode from './NetworkNode';
import NewSourceBox from './sources/NewSourceBox';
import DragAndDropCloningHistoryWrapper from './DragAndDropCloningHistoryWrapper';
import CloningSpeedDial from './CloningSpeedDial';

function CloningHistory() {
  const startingSourceIds = useSelector(
    (state) => {
      const sequenceIds = state.cloning.sequences.map((sequence) => sequence.id);
      const sequenceIdsOfInputs = state.cloning.sources.flatMap((source) => source.input.map(({ sequence }) => sequence));
      const terminalSequences = sequenceIds.filter((sequenceId) => !sequenceIdsOfInputs.includes(sequenceId));
      const terminalSources = state.cloning.sources.filter((source) => terminalSequences.includes(source.id) || !sequenceIds.includes(source.id));
      return getSortedSourceIds(terminalSources, state.cloning.sources);
    },
    isEqual,
  );
  return (
    <DragAndDropCloningHistoryWrapper>
      <CloningSpeedDial />
      <div className="tf-tree tf-ancestor-tree">
        <div>
          <ul>
            {startingSourceIds.map((sourceId) => (
              <NetWorkNode key={sourceId} {...{ sourceId }} />
            ))}
            {/* There is always a box on the right side to add a source */}
            <li key="new_source_box" className="new_source_box">
              <span className="tf-nc"><span className="node-text"><NewSourceBox /></span></span>
            </li>
          </ul>
        </div>
      </div>
    </DragAndDropCloningHistoryWrapper>

  );
}

export default React.memo(CloningHistory);
