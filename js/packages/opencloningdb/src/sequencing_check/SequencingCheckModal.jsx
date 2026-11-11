import React from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import error2String from '@opencloning/utils/error2String';
import BulkUploadModal from '../bulk_upload/BulkUploadModal';
import { BulkTableContainer } from '../bulk_upload/common';
import GetSequencesInBulkComponent from '../GetSequencesInBulkComponent';
import SequencingCheckTable from './SequencingCheckTable';
import useSequencingCheck from './useSequencingCheck';

function SequencingCheckResults({ sequences, onPickOtherSequences, renderSequenceName }) {
  const { rows, filesLoading, filesError, run, isRunning, progress } = useSequencingCheck(sequences);

  return (
    <>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Each sequencing file is aligned to its sequence (exact matches are detected without aligning).
        Sequences are sorted by percentage identity, lowest first.
      </Typography>
      {filesError && <Alert severity="error" sx={{ mb: 2 }}>Could not load the sequencing files: {error2String(filesError)}</Alert>}
      <BulkTableContainer>
        <SequencingCheckTable rows={rows} renderSequenceName={renderSequenceName} />
      </BulkTableContainer>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
        {progress.total > 0 && (
          <Typography variant="body2" sx={{ mr: 'auto' }} data-testid="sequencing-check-progress">
            {progress.done} / {progress.total} sequencing files checked
          </Typography>
        )}
        <Button variant="outlined" onClick={onPickOtherSequences} disabled={isRunning}>
          Pick other sequences
        </Button>
        <Button
          variant="contained"
          onClick={() => run()}
          disabled={isRunning || filesLoading || progress.total === 0}
          data-testid="sequencing-check-run-button"
        >
          {isRunning ? <CircularProgress size={24} /> : 'Check sequencing files'}
        </Button>
      </Box>
    </>
  );
}

function SequencingCheckContent({ renderSequenceName }) {
  const [sequences, setSequences] = React.useState(null);
  if (sequences === null) {
    return <GetSequencesInBulkComponent onSequencesLoaded={setSequences} />;
  }
  return (
    <SequencingCheckResults
      sequences={sequences}
      onPickOtherSequences={() => setSequences(null)}
      renderSequenceName={renderSequenceName}
    />
  );
}

/**
 * Pick sequences in bulk and check them against their sequencing files (percentage identity).
 * renderSequenceName(sequence) can be passed to render the sequence names (e.g. as links), sequence is
 * an item of the output of GetSequencesInBulkComponent ({ databaseId, name, ... }).
 */
export default function SequencingCheckModal({ open, onClose, renderSequenceName }) {
  return (
    <BulkUploadModal open={open} onClose={onClose} title="Check sequencing files" dataTestId="sequencing-check-modal">
      <SequencingCheckContent renderSequenceName={renderSequenceName} />
    </BulkUploadModal>
  );
}
