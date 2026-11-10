import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormControlLabel, Radio, RadioGroup } from '@mui/material';
import React from 'react';

function HistoryLoadedDialog({ fileLoaderFunctions }) {
  const [selectedOption, setSelectedOption] = React.useState('replace');
  const { addState, replaceState, clear } = fileLoaderFunctions;
  return (
    <Dialog
      open
      onClose={clear}
      PaperProps={{
        component: 'form',
        onSubmit: async (event) => {
          event.preventDefault();
          if (selectedOption === 'replace') {
            replaceState();
          } else {
            addState();
          }
          clear();
        },
      }}
      className="history-loaded-dialog"
    >
      <DialogTitle>History loaded</DialogTitle>
      <DialogContent>
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

      </DialogContent>
      <DialogActions>
        <Button onClick={clear}>
          Cancel
        </Button>
        <Button type="submit">Select</Button>
      </DialogActions>
    </Dialog>
  );
}

export default HistoryLoadedDialog;
