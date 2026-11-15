import React from 'react';
import { Box } from '@mui/material';

// The text of the tooltip of an action button (upload, link, check...), larger than the default tooltip
function ButtonTooltipText({ children }) {
  return <Box component="span" sx={{ fontSize: '1.2em' }}>{children}</Box>;
}

export default ButtonTooltipText;
