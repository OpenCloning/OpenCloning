import React from 'react'
import { Box } from '@mui/material'

function PageContainer({ children, ...rest }) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 5 }} {...rest}>
      {children}
    </Box>
  )
}

export default PageContainer
