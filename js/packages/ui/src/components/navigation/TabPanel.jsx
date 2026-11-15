import React from 'react';
import { Box } from '@mui/material';

const TabPanel = React.forwardRef(({ children, value, index, ...other }, ref) => {
  // Hidden panels stay mounted (they keep their state), but take no space
  const sx = value === index ? { visibility: 'visible' } : {
    visibility: 'hidden',
    position: 'absolute',
    width: '1px',
    height: 0,
    overflow: 'hidden',
  };

  return (
    <Box
      ref={ref}
      role="tabpanel"
      sx={sx}
      id={`tab-panel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {children}
    </Box>
  );
});

export default TabPanel;
