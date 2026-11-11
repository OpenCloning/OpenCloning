import React from 'react';
import { Tooltip } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

function LabelWithTooltip({ label, tooltip }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <span>{label}</span>
      <Tooltip title={<span style={{ fontSize: '1.4em' }}>{tooltip}</span>} arrow placement="right">
        <InfoIcon fontSize="small" color="primary" sx={{ marginLeft: '0.25em' }} />
      </Tooltip>
    </div>
  );
}

export default React.memo(LabelWithTooltip);
