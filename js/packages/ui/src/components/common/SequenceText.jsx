import React from 'react';
import { Typography } from '@mui/material';

/**
 * A DNA sequence (or an overhang, a site...) in running text, in the theme's `sequence` typography
 * (monospace, at the size of the surrounding text). Renders a span; takes the props of MUI's Typography.
 *
 * For a table cell, use `sx={{ typography: 'sequence' }}`, and for a text field, `sequenceInputSx`.
 */
function SequenceText({ children, ...props }) {
  return (
    <Typography variant="sequence" {...props}>
      {children}
    </Typography>
  );
}

// sx for a TextField where the user types a sequence
export const sequenceInputSx = { '& .MuiInputBase-input': { typography: 'sequence' } };

export default SequenceText;
