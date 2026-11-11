import { SimpleCircularOrLinearView } from '@teselagen/ove';
import React from 'react';
import { ArrowForward, ArrowBack } from '@mui/icons-material';
import { Button, IconButton } from '@mui/material';
import { convertToTeselaJson } from '@opencloning/utils/readNwrite';
import OverhangsDisplay from '../OverhangsDisplay';
import SubSequenceDisplayer from './SubSequenceDisplayer';
import AssemblyPlanDisplayer from './AssemblyPlanDisplayer';

function MultipleOutputsSelector({
  sources,
  sequences,
  sourceId,
  onFragmentChosen,
  mockable = {}, // for testing
}) {
  const [selectedOutput, setSelectedOutput] = React.useState(0);
  const {
    SubSequenceDisplayerComponent = SubSequenceDisplayer,
    AssemblyPlanDisplayerComponent = AssemblyPlanDisplayer,
    CircularOrLinearViewComponent = SimpleCircularOrLinearView,
    OverhangsDisplayComponent = OverhangsDisplay,
    convertSequence = convertToTeselaJson,
  } = mockable;

  React.useEffect(() => setSelectedOutput(0), [sources]);

  // If the output is already set or the list of outputs is empty, do not show this element
  if (sources.length === 0) { return null; }

  // Functions called to move between outputs of a restriction reaction
  const incrementSelectedOutput = () => setSelectedOutput((current) => (
    (current + 1) % sources.length
  ));
  const decreaseSelectedOutput = () => setSelectedOutput((current) => (
    (current !== 0) ? (current - 1) : sources.length - 1
  ));

  // The function to pick the fragment as the output, and execute the step
  const chooseFragment = (e) => {
    e.preventDefault();
    onFragmentChosen(Math.min(selectedOutput, sources.length - 1));
  };

  const editorName = `source_editor_${sourceId}`;
  const safeSelectedOutput = Math.min(selectedOutput, sources.length - 1);

  const seq = convertSequence(sequences[safeSelectedOutput]);

  return (
    <div className="multiple-output-selector">
      <div className="multiple-output-selector-navigate">
        <IconButton onClick={decreaseSelectedOutput} type="button" sx={{ height: 'fit-content' }}>
          <ArrowBack />
        </IconButton>
        {`${safeSelectedOutput + 1} / ${sources.length}`}
        <IconButton onClick={incrementSelectedOutput} type="button" sx={{ height: 'fit-content' }}>
          <ArrowForward />
        </IconButton>
      </div>

      <div className="fragment-picker">
        <SubSequenceDisplayerComponent {...{ source: sources[safeSelectedOutput], sourceId }} />
        <AssemblyPlanDisplayerComponent {...{ source: sources[safeSelectedOutput] }} />
        <CircularOrLinearViewComponent {...{ sequenceData: seq, editorName, height: 'auto' }} />
        <OverhangsDisplayComponent {...{ sequenceData: seq, sequence: sequences[safeSelectedOutput] }} />
      </div>
      <form onSubmit={chooseFragment}>
        <Button fullWidth type="submit" variant="contained">Choose product</Button>
      </form>
    </div>
  );
}

export default React.memo(MultipleOutputsSelector);
