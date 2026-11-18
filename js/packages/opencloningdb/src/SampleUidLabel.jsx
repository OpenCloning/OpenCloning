import React from 'react';
import { Box } from '@mui/material';

/** Style of the label of a sample UID (also used for other UIDs, e.g. of primers and lines). */
export const sampleUidLabelSx = {
  fontFamily: 'monospace',
  fontSize: '0.875rem',
  bgcolor: 'action.hover',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1,
  px: 1,
  py: 0.5,
};

/** A sample UID shown as a label. */
export default function SampleUidLabel({ uid, sx, ...props }) {
  return (
    <Box component="span" sx={{ ...sampleUidLabelSx, ...sx }} {...props}>
      {uid}
    </Box>
  );
}
