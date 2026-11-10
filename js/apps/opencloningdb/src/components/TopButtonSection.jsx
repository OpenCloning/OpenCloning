import React from 'react'
import { Box } from '@mui/material'

function TopButtonSection({ children }) {
  return (
    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
      {children}
    </Box>
  )
}

export default TopButtonSection
