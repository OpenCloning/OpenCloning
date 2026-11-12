import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, CircularProgress, IconButton, Tooltip, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import SequenceViewer from '@opencloning/ui/components/SequenceViewer';
import { buildSequencingAlignmentConfig } from '@opencloning/utils/alignmentUtils';
import { convertToTeselaJson } from '@opencloning/utils/readNwrite';
import error2String from '@opencloning/utils/error2String';
import useSequencingQueries from './useSequencingQueries';

/**
 * Alignment of one sequencing file to its sequence, shown in the SequenceViewer with the alignment tab selected.
 * sequence is an item of the output of GetSequencesInBulkComponent, file a sequencing file of that sequence.
 */
export default function SequencingAlignmentViewer({ sequence, file, onClose }) {
  const sequenceData = React.useMemo(() => convertToTeselaJson(sequence.textFileSequence), [sequence]);

  // Shared with the sequencing check, so files that were already aligned are not aligned again
  const { alignmentQuery } = useSequencingQueries();
  const { data, isPending, error } = useQuery(alignmentQuery(sequence, file));
  const alignmentData = React.useMemo(() => data && buildSequencingAlignmentConfig(
    sequence.textFileSequence,
    sequenceData,
    [{ fileName: file.name, fileContent: data.fileContent }],
    data.alignedSequences,
  ), [data, sequence, sequenceData, file.name]);

  return (
    <Box sx={{ mb: 2 }} data-testid="sequencing-alignment-viewer">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle1" sx={{ flex: 1, overflowWrap: 'anywhere' }}>
          Alignment of <Box component="span" sx={{ fontFamily: 'monospace' }}>{file.name}</Box> to {sequence.name}
        </Typography>
        <Tooltip title="Close alignment">
          <IconButton size="small" onClick={onClose} aria-label="Close alignment">
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Box>
      {isPending && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">Could not align the sequencing file: {error2String(error)}</Alert>}
      {alignmentData && <SequenceViewer sequenceData={sequenceData} alignmentData={alignmentData} readOnly />}
    </Box>
  );
}
