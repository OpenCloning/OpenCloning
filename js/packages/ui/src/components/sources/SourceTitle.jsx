import React from 'react';
import { Typography } from '@mui/material';

// The title at the top of a source box (e.g. "Import a sequence"). Takes the props of MUI's Typography.
function SourceTitle({ children, ...props }) {
  return (
    <Typography variant="h5" component="h2" sx={{ fontWeight: 'fontWeightLight', mb: 0.5 }} {...props}>
      {children}
    </Typography>
  );
}

export default SourceTitle;
