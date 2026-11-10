import React from 'react';
import { TableCell, TableRow } from '@mui/material';

export default function Primer3Figure({ figure }) {
  // Remove all trailing spaces
  const trimmedRows = figure.split('\n').map((row) => row.trim());
  const longestRow = Math.max(...trimmedRows.map((row) => row.length));
  return (
    <TableRow>
      <TableCell colSpan={3} sx={{ padding: 0, margin: 0 }}>
        <code style={{ width: '100%',
          whiteSpace: 'pre',
          fontFamily: 'monospace',
          display: 'block',
          maxWidth: '100%',
          overflow: 'auto',
          margin: 0,
          fontSize: `min(calc(100% * 80 / ${longestRow}), 1rem)` }}
        >
          {trimmedRows.join('\n')}
        </code>
      </TableCell>
    </TableRow>
  );
}
