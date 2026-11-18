import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from '@mui/material';
import React from 'react';
import { useSelector, useStore } from 'react-redux';
import { downloadStateAsJson, downloadStateAsZip } from '@opencloning/utils/readNwrite';
import useCloningAlerts from '../hooks/useCloningAlerts';
import FormDialog from './common/FormDialog';


function DownloadCloningStrategyDialog({ open, setOpen }) {
  const [fileName, setFileName] = React.useState('cloning_strategy');
  const [extension, setExtension] = React.useState('.json');
  const hasVerificationFiles = useSelector(({ cloning }) => cloning.files.length > 0);

  const store = useStore();
  const { addAlert } = useCloningAlerts();

  return (
    <FormDialog
      open={open}
      className="download-cloning-strategy-dialog"
      onClose={() => setOpen(false)}
      title="Save cloning strategy to file"
      submitLabel="Save file"
      onSubmit={async () => {
        setOpen(false);
        const cloningState = store.getState().cloning;
        if (extension === '.zip') {
          try {
            await downloadStateAsZip(cloningState, fileName + extension);
          } catch (error) {
            console.error(error);
            addAlert({ message: error.message, severity: 'error' });
          }
        } else {
          downloadStateAsJson(cloningState, fileName + extension);
        }
      }}
    >
      <FormControl fullWidth>
        <TextField
          autoFocus
          required
          id="file_name"
          label="File name"
          variant="standard"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          sx={{ mb: 2 }}
        />
        {hasVerificationFiles && (
          <>
            <FormLabel id="save-file-radio-group-label">File format</FormLabel>
            <RadioGroup
              aria-labelledby="save-file-radio-group-label"
              value={extension}
              variant="standard"
              onChange={(e) => setExtension(e.target.value)}
            >
              <FormControlLabel value=".json" control={<Radio />} label="json (cloning strategy)" />
              <FormControlLabel value=".zip" control={<Radio />} label="zip (cloning strategy + verification files)" />
            </RadioGroup>
          </>
        )}
      </FormControl>
    </FormDialog>
  );
}

export default DownloadCloningStrategyDialog;
