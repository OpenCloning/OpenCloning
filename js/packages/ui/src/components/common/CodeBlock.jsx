import React from 'react';
import { Box } from '@mui/material';

// A grey box for code or other preformatted text
function CodeBlock({ sx = [], children }) {
  return (
    <Box
      component="code"
      sx={[
        (theme) => ({
          display: 'block',
          p: 2,
          borderRadius: 1,
          bgcolor: 'grey.300',
          boxShadow: `inset 0 0 0 3px ${theme.palette.grey[600]}`,
          textAlign: 'left',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {children}
    </Box>
  );
}

export default CodeBlock;
