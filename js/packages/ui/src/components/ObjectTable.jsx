// A react fucntioncal component that renders a table
// where each row contains a key-value pair of an object
// it uses mui

import { Table, TableCell, TableRow } from '@mui/material';
import React from 'react';

function ObjectTable({ object }) {
  return (

    <Table sx={{ my: 2 }}>

      {Object.keys(object).map((key) => (
        <TableRow key={key}>
          <TableCell sx={{ py: 0.5 }}><strong>{key}</strong></TableCell>
          <TableCell sx={{ py: 0.5 }}>{object[key]}</TableCell>
        </TableRow>
      ))}
    </Table>

  );
}

export default React.memo(ObjectTable);
