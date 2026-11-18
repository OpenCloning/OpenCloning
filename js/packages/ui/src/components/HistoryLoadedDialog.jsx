import { FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import React from 'react';
import FormDialog from './common/FormDialog';

function HistoryLoadedDialog({ fileLoaderFunctions }) {
  const [selectedOption, setSelectedOption] = React.useState('replace');
  const { addState, replaceState, clear } = fileLoaderFunctions;
  return (
    <FormDialog
      open
      onClose={clear}
      className="history-loaded-dialog"
      title="History loaded"
      submitLabel="Select"
      onSubmit={() => {
        if (selectedOption === 'replace') {
          replaceState();
        } else {
          addState();
        }
        clear();
      }}
    >
      <FormControl fullWidth>
        <RadioGroup
          value={selectedOption}
          variant="standard"
          onChange={(e) => setSelectedOption(e.target.value)}
        >
          <FormControlLabel value="replace" control={<Radio />} label="Replace existing" />
          <FormControlLabel value="add" control={<Radio />} label="Add to existing" />
        </RadioGroup>
      </FormControl>
    </FormDialog>
  );
}

export default HistoryLoadedDialog;
