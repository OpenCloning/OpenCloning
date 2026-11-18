import React from 'react'
import { Typography } from '@mui/material';
import { FormDialog } from '@opencloning/ui/components/common';

function ConfirmMutationDialog({ open, onClose, mutation, title, content, confirmButtonText}) {
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      onSubmit={() => mutation.mutate()}
      submitLabel={mutation.isPending ? 'Submitting...' : confirmButtonText}
      submitDisabled={mutation.isPending}
      submitButtonProps={{ color: 'error', variant: 'contained' }}
      // Not red: the confirm button already is
      cancelButtonProps={{ color: 'primary', disabled: mutation.isPending }}
    >
      <Typography>
        {content}
      </Typography>
    </FormDialog>
  )
}

export default ConfirmMutationDialog
