import React from 'react';
import { Box, CircularProgress, Tooltip } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import { SampleUidLabel, sampleUidLabelSx } from '@opencloning/opencloningdb';
import useDeleteSequenceUIDMutation from '../hooks/useDeleteSequenceUIDMutation';

export { sampleUidLabelSx as sampleUidBadgeSx };

function SampleUidBadge({ uid, canDelete = false }) {
  const deleteSequenceUIDMutation = useDeleteSequenceUIDMutation();
  if (!canDelete) {
    return <SampleUidLabel uid={uid} data-testid="sample-uid-badge-no-delete" />;
  }
  return (
    <Box
      component="span"
      data-testid="sample-uid-badge-with-delete"
      sx={{ ...sampleUidLabelSx, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <Tooltip title="Remove sample UID" placement="top">
        {deleteSequenceUIDMutation.isPending ? <CircularProgress size={10} /> : (
          <ClearIcon
            onClick={() => deleteSequenceUIDMutation.mutate(uid)}
            fontSize="x-small"
            sx={{ cursor: 'pointer' }}
          />
        )}
      </Tooltip>
      {uid}
    </Box>
  );
}

export default SampleUidBadge;
