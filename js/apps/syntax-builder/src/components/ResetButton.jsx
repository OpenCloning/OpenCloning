import React from 'react'
import { useFormData } from '../context/FormDataContext'
import { Button } from '@mui/material'

export default function ResetButton() {
  const { resetFormData } = useFormData();

  const handleReset = React.useCallback(() => {
    if (window.confirm('Are you sure you want to reset the form? This will clear all parts data and cannot be undone.')) {
      resetFormData();
    }
  }, [resetFormData]);

  return (
    <Button color="error" size="large" variant="contained" onClick={handleReset}>
      Reset form
    </Button>
  )
}
