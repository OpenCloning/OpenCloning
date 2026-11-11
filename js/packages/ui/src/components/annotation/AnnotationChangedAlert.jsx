import React from 'react'
import { Alert, Button } from '@mui/material';

function AnnotationChangedAlert({ onSave, onCancel }) {
  return (
    <Alert
      style={{maxWidth: '500px', margin: '10px auto'}}
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
