import { FormControl, FormControlLabel, FormLabel, Radio, RadioGroup, TextField } from '@mui/material';
import React from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { isEqual } from 'lodash-es';
import { downloadSequence } from '@opencloning/utils/readNwrite';
import { exportSubStateThunk } from '@opencloning/utils/thunks';
import { getPCRPrimers} from '@opencloning/store/cloning_utils';
import { substateHasFiles } from '@opencloning/utils/network';
import error2String from '@opencloning/utils/error2String';
import FormDialog from './common/FormDialog';
import useCloningAlerts from '../hooks/useCloningAlerts';

// You can override the downloadSequence function by passing a downloadCallback that takes the fileName and sequence as arguments
function DownloadSequenceFileDialog({ id, dialogOpen, setDialogOpen, downloadCallback }) {
  const [fileName, setFileName] = React.useState('');
  const [extension, setExtension] = React.useState('.gb');
  const hasFiles = useSelector(({ cloning }) => substateHasFiles(cloning, id), isEqual);
  const sequenceName = useSelector(({ cloning }) => cloning.teselaJsonCache[id]?.name || '', isEqual);
  const store = useStore();
  const dispatch = useDispatch();
  const { addAlert } = useCloningAlerts();

  React.useEffect(() => {
    setFileName(sequenceName);
  }, [sequenceName]);

  return (
    <FormDialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      title="Save sequence to file"
      submitLabel="Save file"
      onSubmit={async () => {
        setDialogOpen(false);
        if (extension === '.json' || extension === '.zip') {
          try {
            await dispatch(exportSubStateThunk(fileName + extension, id));
          } catch (error) {
            console.error(error);
            addAlert({ message: error2String(error), severity: 'error' });
          }
          return;
        }
        const {cloning} = store.getState();
        const seqCopy = structuredClone(cloning.teselaJsonCache[id]);
        const pcrPrimers = getPCRPrimers(cloning, id);
        seqCopy.primers = [...seqCopy.primers, ...pcrPrimers];
        if (downloadCallback) {
          downloadCallback(fileName + extension, seqCopy);
        } else {
          downloadSequence(fileName + extension, seqCopy);
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
        <FormLabel id="save-file-radio-group-label">File format</FormLabel>
        <RadioGroup
          aria-labelledby="save-file-radio-group-label"
          value={extension}
          variant="standard"
          onChange={(e) => setExtension(e.target.value)}
        >
          <FormControlLabel value=".gb" control={<Radio />} label="genbank (sequence + features)" />
          <FormControlLabel value=".fasta" control={<Radio />} label="fasta (sequence only)" />
          <FormControlLabel value=".json" control={<Radio />} label="json (sequence + features + history)" />
          {hasFiles && <FormControlLabel value=".zip" control={<Radio />} label="zip (sequence + features + history + verification files)" />}
        </RadioGroup>
      </FormControl>
    </FormDialog>
  );
}

export default DownloadSequenceFileDialog;
