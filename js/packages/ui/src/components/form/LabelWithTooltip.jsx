import React from 'react';
import { Tooltip, Box } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

function LabelWithTooltip({ label, tooltip }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <span>{label}</span>
      <Tooltip title={tooltip} placement="right">
        <InfoIcon fontSize="small" color="primary" sx={{ marginLeft: '0.25em' }} />
      </Tooltip>
    </Box>
  );
}

export default React.memo(LabelWithTooltip);
