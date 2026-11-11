import React from 'react';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio, TextField } from '@mui/material';
import { useSelector } from 'react-redux';
import primersToTabularFile from './primersToTabularFile';

import { downloadTextFile } from '@opencloning/utils/readNwrite';
import { usePCRDetails } from './primer_details/usePCRDetails';
import RequestStatusWrapper from '../form/RequestStatusWrapper';
import useMultiplePrimerDetails from './primer_details/useMultiplePrimerDetails';
import { isCompleteOligoHybridizationSource, isCompletePCRSource } from '@opencloning/store/cloning_utils';

function DownloadPrimersDialog({ primers, open, onClose }) {
  const pcrSourceIds = useSelector((state) => state.cloning.sources
    .filter((source) => isCompletePCRSource(source) || isCompleteOligoHybridizationSource(source))
    .map((source) => source.id));
  const [fileName, setFileName] = React.useState('primers');
  const [extension, setExtension] = React.useState('.csv');

  const { pcrDetails, retryGetPCRDetails, requestStatus: pcrDetailsRequestStatus } = usePCRDetails(pcrSourceIds);
  const { primerDetails, retryGetPrimerDetails, requestStatus: primerDetailsRequestStatus } = useMultiplePrimerDetails(primers);

  const handleDownload = () => {
    const fullFileName = fileName + extension;
    const separator = extension === '.csv' ? ',' : '\t';
    const fileContent = primersToTabularFile(primerDetails, pcrDetails, separator);

    downloadTextFile(fileContent, fullFileName);
    onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{
        component: 'form',
        onSubmit: (event) => {
          event.preventDefault();
          handleDownload();
        },
      }}
    >
      <DialogTitle>Save Primers to File</DialogTitle>
      <DialogContent>
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
          <FormLabel id="save-primers-radio-group-label">File format</FormLabel>
          <RadioGroup
            aria-labelledby="save-primers-radio-group-label"
            value={extension}
            variant="standard"
            onChange={(e) => setExtension(e.target.value)}
          >
            <FormControlLabel value=".csv" control={<Radio />} label="csv" />
            <FormControlLabel value=".tsv" control={<Radio />} label="tsv" />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <RequestStatusWrapper requestStatus={primerDetailsRequestStatus} retry={() => { retryGetPrimerDetails(); retryGetPCRDetails(); }}>
          <RequestStatusWrapper requestStatus={pcrDetailsRequestStatus} retry={retryGetPCRDetails}>
            <Button onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save file</Button>
          </RequestStatusWrapper>
        </RequestStatusWrapper>
      </DialogActions>
    </Dialog>
  );
}

function DownloadPrimersButton({ primers }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
      >
        Download Primers
      </Button>
      {dialogOpen && (
        <DownloadPrimersDialog
          primers={primers}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      )}
    </>
  );
}

export default DownloadPrimersButton;
