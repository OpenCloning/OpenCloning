import React from 'react';
import { Typography } from '@mui/material';
import { SEQUENCE_TYPE_COLORS, SEQUENCE_TYPE_LABELS } from '../utils/query_utils';



function SequenceTypeChip({ sequenceType, ...rest }) {
  if (!sequenceType) return null;

  const config = SEQUENCE_TYPE_COLORS[sequenceType] ?? { color: 'default' };
  const label = SEQUENCE_TYPE_LABELS[sequenceType] ?? sequenceType;

  const {sx, ...restRest} = rest;
  return (
    <Typography
      variant="body2"
      sx={{ color: config.color, ...sx }}
      {...restRest}
    >
      {label}
    </Typography>
  );
}

export default SequenceTypeChip;
