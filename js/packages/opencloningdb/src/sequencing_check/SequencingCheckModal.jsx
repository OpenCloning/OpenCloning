import React from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import BulkUploadModal from '../bulk_upload/BulkUploadModal';
import { BulkTableContainer } from '../bulk_upload/common';
import GetSequencesInBulkComponent from '../GetSequencesInBulkComponent';
import SequencingCheckTable from './SequencingCheckTable';
import SequencingAlignmentViewer from './SequencingAlignmentViewer';
import useSequencingCheck from './useSequencingCheck';

// Height of the alignment viewer, about half of the window (the editor is at least 400px high)
const alignmentViewerHeight = () => Math.max(400, Math.round(window.innerHeight * 0.5));

function SequencingCheckResults({ sequences, onPickOtherSequences, renderSequenceName }) {
  const { rows, run, isRunning, progress } = useSequencingCheck(sequences);
  // { sequence, file } of the alignment shown below the table, null if none
  const [selectedAlignment, setSelectedAlignment] = React.useState(null);
  const onViewAlignment = (sequence, file) => setSelectedAlignment(sequence ? { sequence, file } : null);

  return (
    <>
      <Typography variant="body2" sx={{ mb: 2 }}>
        Each sequencing file is aligned to its sequence (exact matches are detected without aligning).
        Sequences are sorted by percentage identity, lowest first.
      </Typography>
      {/*
        The table scrolls on its own, taking the height left by the alignment viewer (if shown). Everything scrolls
        together only if the window is too short for both, so that the buttons stay visible.
      */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <BulkTableContainer sx={{ maxHeight: 'none', flex: '1 1 auto', minHeight: 150 }}>
          <SequencingCheckTable
            rows={rows}
            renderSequenceName={renderSequenceName}
            selectedFileId={selectedAlignment?.file.id ?? null}
            onViewAlignment={onViewAlignment}
          />
        </BulkTableContainer>
        {selectedAlignment && (
          <SequencingAlignmentViewer
            key={selectedAlignment.file.id}
            sequence={selectedAlignment.sequence}
            file={selectedAlignment.file}
            onClose={() => setSelectedAlignment(null)}
            height={alignmentViewerHeight()}
          />
        )}
      </Box>
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
          disabled={isRunning || progress.total === 0}
          data-testid="sequencing-check-run-button"
        >
          {isRunning ? <CircularProgress size={24} /> : 'Check sequencing files'}
        </Button>
      </Box>
    </>
  );
}

// The samples are shown with each sequencing file, so the sequence names go without them
const sequenceNameOnly = ({ id, name }) => name || `Sequence ${id}`;

function SequencingCheckContent({ renderSequenceName }) {
  const [sequences, setSequences] = React.useState(null);
  if (sequences === null) {
    return <GetSequencesInBulkComponent onSequencesLoaded={setSequences} formatName={sequenceNameOnly} />;
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
// Bigger than the other bulk modals, to fit the table and the alignment viewer
const modalSx = { width: 'min(1800px, 98vw)', maxHeight: '94vh', my: '3vh' };

export default function SequencingCheckModal({ open, onClose, renderSequenceName }) {
  return (
    <BulkUploadModal open={open} onClose={onClose} title="Check sequencing files" dataTestId="sequencing-check-modal" sx={modalSx}>
      <SequencingCheckContent renderSequenceName={renderSequenceName} />
    </BulkUploadModal>
  );
}
