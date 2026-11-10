import React from 'react'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

function ConfirmMutationDialog({ open, onClose, mutation, title, content, confirmButtonText}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>
          {content}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={mutation.isPending}>
        Cancel
        </Button>
        <Button color="error" variant="contained" onClick={mutation.mutate} disabled={mutation.isPending}>
          {mutation.isPending ? 'Submitting...' : confirmButtonText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConfirmMutationDialog
