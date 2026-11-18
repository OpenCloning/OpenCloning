import React from 'react'
import { Upload as UploadIcon } from '@mui/icons-material'
import { FileUploadButton } from '@opencloning/ui/components/common'

function UploadDataButton({ onFileChange }) {
  return (
    <FileUploadButton size="large" variant="contained" startIcon={<UploadIcon />} onFiles={([file]) => onFileChange(file)} accept=".json,.tsv,.csv">
      Upload syntax
    </FileUploadButton>
  )
}

export default UploadDataButton
