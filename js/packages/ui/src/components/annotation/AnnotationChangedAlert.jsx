import React from 'react'
import { Alert, Button } from '@mui/material';

function AnnotationChangedAlert({ onSave, onCancel }) {
  return (
    <Alert
      sx={{ maxWidth: 500, mx: 'auto', my: '10px' }}
      severity="info"
      data-testid="annotation-changed-alert"
      action={
        <>
          <Button color="primary" onClick={onSave}>
              Save
          </Button>
          <Button color="secondary" onClick={onCancel}>
              Cancel
          </Button>
        </>
      }
    >
      <strong>Annotation Changed</strong>
    </Alert>
  )
}

export default AnnotationChangedAlert
