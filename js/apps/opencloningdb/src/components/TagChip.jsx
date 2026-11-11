import React from 'react';
import { Chip, Box, CircularProgress } from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';
import { Tooltip } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAppAlerts from '../hooks/useAppAlerts';

function TagChip({ tag, entityId, entityType, canDelete = false }) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const url = entityType === 'lines' ? endpoints.tagUnlinkLine(entityId, tag.id) : endpoints.tagUnlinkInputEntity(entityId, tag.id);
  const deleteTagMutation = useMutation({
    mutationFn: () => openCloningDBHttpClient.delete(url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityType, entityId] });
      queryClient.invalidateQueries({ queryKey: ['sequence', entityId, 'cloning_strategy'] });
      queryClient.invalidateQueries({ queryKey: ['line', entityId] });
      queryClient.invalidateQueries({ queryKey: ['primer', entityId] });
    },
    onError: (error) => {
      addAlert({ message: error?.response?.data?.detail || error?.message || 'Failed to delete tag', severity: 'error' });
    },
  });
  if (canDelete !== true) {
    return <Chip label={tag.name} size="small" variant="outlined" data-testid="tag-chip-no-delete" />;
  }
  return (
    <Chip
      data-testid="tag-chip-with-delete"
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Remove tag" arrow placement="top">
            {deleteTagMutation.isPending ? <CircularProgress size={10} /> : (
              <ClearIcon onClick={() => deleteTagMutation.mutate()} fontSize="x-small" sx={{ cursor: 'pointer' }}/>
            )}
          </Tooltip>
          {tag.name}
        </Box>
      }
      size="small"
      variant="outlined"
    />
  );
}

export default TagChip;
