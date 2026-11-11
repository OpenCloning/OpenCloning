import React from 'react';
import { SimpleCircularOrLinearView } from '@teselagen/ove';
import { useSelector } from 'react-redux';
import { reversePositionInRange } from '@teselagen/range-utils';
import { isEqual } from 'lodash-es';
import { parseFeatureLocation } from '@teselagen/bio-parsers';
import { getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';

function getCutParameters(seq, cut, isLeft) {
  if (cut === null) {
    return isLeft ? [0, 0, 0] : [seq.size, seq.size, 0];
  }
  const { cut_watson: watson, overhang: ovhg } = cut;
  const crick = (watson - ovhg) % seq.size;
  return [watson, crick, ovhg];
}

function SubSequenceDisplayer({
  source, sourceId,
}) {
  if (!['PCRSource', 'RestrictionEnzymeDigestionSource'].includes(source.type)) {
    return null;
  }
  const inputSequenceIds = useSelector((state) => getInputSequencesFromSourceId(state, sourceId).map(({ id }) => id), isEqual);
  const seq = useSelector((state) => state.cloning.teselaJsonCache[inputSequenceIds[0]], isEqual);

  const editorName = `subsequence_editor_${sourceId}`;
  let selectionLayer = null;

  if (['PCRSource'].includes(source.type)) {
    const leftLocation = parseFeatureLocation(source.input[1].left_location, 0, 0, 1, seq.length)[0];
    const rightLocation = parseFeatureLocation(source.input[1].right_location, 0, 0, 1, seq.length)[0];
    // Special case for the whole sequence amplification
    if (isEqual(leftLocation, rightLocation)) {
      selectionLayer = {
        start: 0,
        end: seq.size - 1,
      };
    } else if (!source.input[1].reverse_complemented) {
      selectionLayer = {
        start: leftLocation.start,
        end: rightLocation.end,
      };
    } else {
      selectionLayer = {
        end: reversePositionInRange(leftLocation.start, seq.size),
        start: reversePositionInRange(rightLocation.end, seq.size),
      };
    }
  }
  if (['RestrictionEnzymeDigestionSource'].includes(source.type)) {
    // The edges have the form (watson_pos, ovhg)

    const [leftWatson, leftCrick, leftOvhg] = getCutParameters(seq, source.left_edge, true);
    const [rightWatson, rightCrick, RightOvhg] = getCutParameters(seq, source.right_edge, false);

    selectionLayer = {
      start: leftOvhg > 0 ? leftCrick : leftWatson,
      end: RightOvhg > 0 ? rightWatson : rightCrick,
    };
  }

  return (
    <div className="multiple-output-selector">
      <SimpleCircularOrLinearView {...{ sequenceData: seq, editorName, selectionLayer, caretPosition: null, height: 'auto' }} />
    </div>
  );
}

export default SubSequenceDisplayer;
