import React from 'react';
import { Box, CircularProgress, Tooltip } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import useDeleteSequenceUIDMutation from '../hooks/useDeleteSequenceUIDMutation';

export const sampleUidBadgeSx = {
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  bgcolor: 'action.hover',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  px: 1,
  py: 0.5,
};

function SampleUidBadge({ uid, canDelete = false }) {
  const deleteSequenceUIDMutation = useDeleteSequenceUIDMutation();
  if (!canDelete) {
    return (
      <Box component="span" sx={sampleUidBadgeSx} data-testid="sample-uid-badge-no-delete">
        {uid}
      </Box>
    );
  }
  return (
    <Box
      component="span"
      data-testid="sample-uid-badge-with-delete"
      sx={{ ...sampleUidBadgeSx, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
    >
      <Tooltip title="Remove sample UID" arrow placement="top">
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
