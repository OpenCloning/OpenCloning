import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, FormControl, IconButton, Typography } from '@mui/material';
import { AddCircle as AddCircleIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewLineUID from './NewLineUID';
import { getAlleleSequencesInLine, getPlasmidSequencesInLine } from '../utils/models_utils';
import useAppAlerts from '../hooks/useAppAlerts';
import error2String from '@opencloning/utils/error2String';

const emptyRow = (id) => ({ id, uid: '', checking: false });

/**
 * Creates new lines with the same parents, alleles and plasmids as an existing line,
 * e.g. other isolates (colonies) of the same transformation or cross. The user only provides the UIDs.
 */
function CreateIsolatesDialog({ line, open, onClose }) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const nextRowIdRef = React.useRef(1);
  const [rows, setRows] = React.useState([emptyRow(0)]);

  const resetAndClose = () => {
    nextRowIdRef.current = 1;
    setRows([emptyRow(0)]);
    onClose();
  };

  const updateRow = (rowId, changes) => setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, ...changes } : r)));
  const uids = rows.map((r) => r.uid);
  const duplicatedUids = [...new Set(uids.filter((uid, i) => uid && uids.findIndex((u) => u.toLowerCase() === uid.toLowerCase()) !== i))];

  const createMutation = useMutation({
    mutationFn: async (uidsToCreate) => {
      const body = {
        allele_ids: getAlleleSequencesInLine(line).map((a) => a.id),
        plasmid_ids: getPlasmidSequencesInLine(line).map((p) => p.id),
        parent_ids: line.parent_ids,
      };
      const created = [];
      // Sequential, so that if one fails the ones before it are created and reported
      for (const uid of uidsToCreate) {
        const { data } = await openCloningDBHttpClient.post(endpoints.postLine, { ...body, uid });
        created.push(data);
      }
      return created;
    },
    onSuccess: (created) => {
      addAlert({ message: `${created.length} line(s) created: ${created.map((l) => l.uid).join(', ')}`, severity: 'success' });
      resetAndClose();
    },
    onError: (error) => {
      addAlert({ message: error2String(error), severity: 'error' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      for (const parentId of line.parent_ids) {
        queryClient.invalidateQueries({ queryKey: ['line', parentId] });
        queryClient.invalidateQueries({ queryKey: ['lineChildren', parentId] });
      }
    },
  });

  const canSubmit = uids.every((uid) => uid) && duplicatedUids.length === 0
    && !rows.some((r) => r.checking) && !createMutation.isPending;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    createMutation.mutate(uids);
  };

  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={resetAndClose} data-testid="create-isolates-dialog">
      <DialogTitle>Create more isolates of {line.uid}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          The new lines will have the same parents, alleles and plasmids as {line.uid}.
        </Typography>
        <form onSubmit={handleSubmit}>
          {rows.map((row, index) => (
            <Box key={row.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
              <FormControl fullWidth>
                <NewLineUID
                  label={`Line UID ${index + 1}`}
                  onChange={(uid) => updateRow(row.id, { uid })}
                  onValidationStateChange={({ isChecking }) => updateRow(row.id, { checking: isChecking })}
                />
              </FormControl>
              {rows.length > 1 && (
                <IconButton onClick={() => setRows((prev) => prev.filter((r) => r.id !== row.id))} size="small" sx={{ mb: 3 }} aria-label="Remove line UID">
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>
          ))}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button onClick={() => setRows((prev) => [...prev, emptyRow(nextRowIdRef.current++)])} color="success" startIcon={<AddCircleIcon />}>
              Add another UID
            </Button>
          </Box>
          {duplicatedUids.length > 0 && (
            <Alert severity="error" sx={{ mt: 1 }}>Duplicate UIDs: {duplicatedUids.join(', ')}</Alert>
          )}
          <FormControl fullWidth sx={{ mt: 2 }}>
            <Button type="submit" variant="contained" disabled={!canSubmit}>
              {createMutation.isPending ? 'Creating…' : `Create ${rows.length} line${rows.length > 1 ? 's' : ''}`}
            </Button>
          </FormControl>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateIsolatesDialog;
