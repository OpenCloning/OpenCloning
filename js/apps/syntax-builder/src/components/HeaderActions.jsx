import React from 'react'
import { Box, Button } from '@mui/material'
import { Download as DownloadIcon } from '@mui/icons-material'
import { useDownloadData } from './useDownloadData'
import ResetButton from './ResetButton'
import UploadDataButton from './UploadDataButton'
import useUploadData from './useUploadData'

export default function HeaderActions() {
  const { downloadData } = useDownloadData()
  const { uploadData } = useUploadData()
  
  return (
    <Box className="header-actions">
      <Button 
        variant="contained" 
        startIcon={<DownloadIcon />} 
        onClick={downloadData}
        size="large"
      >
          Download Syntax
      </Button>
      <UploadDataButton onFileChange={uploadData} />
      <ResetButton />
    </Box>
    
  )
}
