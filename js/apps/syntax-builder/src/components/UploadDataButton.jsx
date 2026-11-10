import React from 'react'
import { Button } from '@mui/material'
import { Upload as UploadIcon } from '@mui/icons-material'

function UploadDataButton({ onFileChange }) {
  const fileInputRef = React.useRef(null);
  return (<>
    <Button size="large" variant="contained" startIcon={<UploadIcon />} onClick={() => fileInputRef.current.click()}>Upload syntax</Button>
    <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={(event) => onFileChange(event.target.files[0])} accept=".json,.tsv,.csv" />
  </>
  )
}

export default UploadDataButton
