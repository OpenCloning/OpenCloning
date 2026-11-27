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
 * height is the height of the viewer in pixels.
 */
export default function SequencingAlignmentViewer({ sequence, file, onClose, height }) {
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
        // Same height as the viewer, so that the table above does not jump when it is loaded
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
          <CircularProgress />
        </Box>
      )}
      {error && <Alert severity="error">Could not align the sequencing file: {error2String(error)}</Alert>}
      {alignmentData && <SequenceViewer sequenceData={sequenceData} alignmentData={alignmentData} readOnly height={height} />}
    </Box>
  );
}
