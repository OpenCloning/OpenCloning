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
    // Stays at the top of the page when scrolling
    <Box
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 'appBar',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 0.5,
        py: 1.25,
        px: '1.5px',
        bgcolor: 'grey.100',
        borderBottom: 2,
        borderColor: 'divider',
      }}
    >
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
