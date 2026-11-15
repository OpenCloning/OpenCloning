import React from 'react';
import { Paper, TableContainer } from '@mui/material';

// A table in a section of a detail page (e.g. the children of a sequence): on paper, and not too wide
function DetailTable({ maxWidth = 800, children }) {
  return (
    <TableContainer component={Paper} sx={{ maxWidth }}>
      {children}
    </TableContainer>
  );
}

export default DetailTable;
