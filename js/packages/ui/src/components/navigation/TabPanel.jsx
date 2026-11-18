import React from 'react';
import { Box } from '@mui/material';

// Inactive panels are hidden instead of unmounted, so their content keeps its state when switching tabs
function TabPanel({ children, value, index, ...other }) {
  const sx = value === index ? {
    visibility: 'visible',

  } : {
    visibility: 'hidden',
    position: 'absolute',
    width: '1px',
    height: 0,
    overflow: 'hidden',
  };

  return (
    <Box
      role="tabpanel"
      sx={sx}
      id={`tab-panel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {children}
    </Box>
  );
}

export default TabPanel;
