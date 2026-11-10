import React from 'react';
import {
  Box,
  Button,
  CircularProgress,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

import useAppAlerts from '../hooks/useAppAlerts';
import SequenceTypeSelect from './SequenceTypeSelect';

function EditSequenceNameAndType({ sequenceData, sequenceInDb, presentInLine, onSave }) {
  const queryClient = useQueryClient();
  const { addAlert } = useAppAlerts();

  const sequenceId = sequenceInDb.id;
  const isTemplateSequence = sequenceInDb.type === 'template_sequence';
  const isCircular = !isTemplateSequence ? sequenceData.circular : null;
  const changeTypeDisabled = presentInLine || isCircular;

  const [name, setName] = React.useState(sequenceInDb.name);
  const [sequenceType, setSequenceType] = React.useState(sequenceInDb.sequence_type);

  React.useEffect(() => {
    setName(sequenceInDb.name);
    setSequenceType(sequenceInDb.sequence_type);
  }, [sequenceInDb]);


  const submissionAllowed = name.trim().length > 0;

  const patchMutation = useMutation({
    mutationFn: async (payload) => openCloningDBHttpClient.patch(endpoints.sequence(sequenceId), payload),
    onSuccess: () => {
      addAlert({ message: 'Sequence updated successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
      onSave();
    },
    onError: (error) => {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Error updating sequence',
        severity: 'error',
      });
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newName = name.trim();
    if (!submissionAllowed) return;

    if (newName === sequenceInDb.name && sequenceType === sequenceInDb.sequence_type) {
      onSave();
    } else {
      patchMutation.mutate({
        name: newName,
        'sequence_type': changeTypeDisabled ? undefined : sequenceType,
      });
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
    >

      <TextField
        size="small"
        label="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={name.trim().length === 0}
        helperText={name.trim().length === 0 ? 'Name cannot be empty' : undefined}
        sx={{ minWidth: 220 }}
      />

      <SequenceTypeSelect
        value={sequenceType}
        onChange={setSequenceType}
        isCircular={isCircular}
        isTemplateSequence={isTemplateSequence}
        changeTypeDisabled={changeTypeDisabled}
      />

      <Button
        type="submit"
        variant="contained"
        size="small"
        disabled={!submissionAllowed || patchMutation.isLoading}
        startIcon={patchMutation.isLoading ? <CircularProgress size={16} /> : null}
      >
        {patchMutation.isLoading ? 'Submitting' : 'Save'}
      </Button>
      <Button
        variant="text"
        color="error"
        onClick={() => onSave()}
      >
        Cancel
      </Button>
    </Box>
  );
}

export default EditSequenceNameAndType;
