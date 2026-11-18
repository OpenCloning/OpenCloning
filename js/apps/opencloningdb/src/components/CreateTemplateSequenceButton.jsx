import React from 'react';
import { Button, TextField } from '@mui/material';
import { FormDialog } from '@opencloning/ui/components/common';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import useAppAlerts from '../hooks/useAppAlerts';
import SequenceTypeSelect from './SequenceTypeSelect';
import error2String from '@opencloning/utils/error2String';

export default function CreateTemplateSequenceButton() {
  const queryClient = useQueryClient();
  const { addAlert } = useAppAlerts();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [sequenceType, setSequenceType] = React.useState('allele');

  const createMutation = useMutation({
    mutationFn: async (body) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.templateSequences, body);
      return data;
    },
    onSuccess: () => {
      addAlert({ message: 'Template sequence created successfully', severity: 'success' });
      setDialogOpen(false);
      setName('');
      setSequenceType('allele');
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
    onError: (error) => {
      addAlert({
        message: error2String(error),
        severity: 'error',
      });
    },
  });

  const handleOpen = () => setDialogOpen(true);
  const handleClose = () => {
    setDialogOpen(false);
    setName('');
    setSequenceType('allele');
  };

  const submissionAllowed = name.trim().length > 0 && !createMutation.isPending;

  return (
    <>
      <Button onClick={handleOpen} data-testid="create-template-sequence-button">
        Create Template Sequence
      </Button>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        data-testid="create-template-sequence-dialog"
        title="Create Template Sequence"
        submitLabel="Create"
        submitDisabled={!submissionAllowed}
        onSubmit={() => {
          if (!submissionAllowed) return;
          createMutation.mutate({ name: name.trim(), sequence_type: sequenceType });
        }}
        contentSx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 350, pt: 1 }}
      >
        <TextField
          autoFocus
          required
          label="Name"
          variant="standard"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={name.length > 0 && name.trim().length === 0}
          helperText={name.length > 0 && name.trim().length === 0 ? 'Name cannot be empty' : undefined}
        />
        <SequenceTypeSelect
          value={sequenceType}
          onChange={setSequenceType}
          isTemplateSequence
        />
      </FormDialog>
    </>
  );
}
