import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewLineUID from './NewLineUID';
import UidRowsForm from './UidRowsForm';
import useUidRows from '../hooks/useUidRows';
import { getAlleleSequencesInLine, getPlasmidSequencesInLine } from '../utils/models_utils';
import useAppAlerts from '../hooks/useAppAlerts';

// Inside the dialog, so that its state is reset when the dialog closes
function CreateIsolatesForm({ line, onClose }) {
  const { addAlert, addErrorAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const uidRows = useUidRows();

  const createMutation = useMutation({
    mutationFn: async (uids) => {
      const body = {
        allele_ids: getAlleleSequencesInLine(line).map((a) => a.id),
        plasmid_ids: getPlasmidSequencesInLine(line).map((p) => p.id),
        parent_ids: line.parent_ids,
      };
      const created = [];
      // Sequential, so that if one fails the ones before it are created
      for (const uid of uids) {
        const { data } = await openCloningDBHttpClient.post(endpoints.postLine, { ...body, uid });
        created.push(data);
      }
      return created;
    },
    onSuccess: (created) => {
      addAlert({ message: `${created.length} line(s) created: ${created.map((l) => l.uid).join(', ')}`, severity: 'success' });
      onClose();
    },
    onError: addErrorAlert,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      for (const parentId of line.parent_ids) {
        queryClient.invalidateQueries({ queryKey: ['line', parentId] });
        queryClient.invalidateQueries({ queryKey: ['lineChildren', parentId] });
      }
    },
  });

  const count = uidRows.rows.length;
  return (
    <>
      <DialogTitle>Create more isolates of {line.uid}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          The new lines will have the same parents, alleles and plasmids as {line.uid}.
        </Typography>
        <UidRowsForm
          uidRows={uidRows}
          UidField={NewLineUID}
          uidLabel="Line UID"
          onSubmit={() => createMutation.mutate(uidRows.rows.map((r) => r.uid))}
          submitting={createMutation.isPending}
          submitText={`Create ${count} line${count > 1 ? 's' : ''}`}
        />
      </DialogContent>
    </>
  );
}

/**
 * Creates new lines with the same parents, alleles and plasmids as an existing line,
 * e.g. other isolates (colonies) of the same transformation or cross. The user only provides the UIDs.
 */
function CreateIsolatesDialog({ line, open, onClose }) {
  return (
    <Dialog fullWidth maxWidth="sm" open={open} onClose={onClose} data-testid="create-isolates-dialog">
      <CreateIsolatesForm line={line} onClose={onClose} />
    </Dialog>
  );
}

export default CreateIsolatesDialog;
