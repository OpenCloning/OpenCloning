import React from 'react';
import { TableCell, TableRow } from '@mui/material';

export default function TableSection({ title, values }) {
  return (
    <>
      {title && <TableRow><TableCell sx={{ fontWeight: 'bold', textAlign: 'center', fontSize: '1.2rem' }} colSpan={3}>{title}</TableCell></TableRow>}
      {values.map((value) => (
        <TableRow key={value[0]}>
          <TableCell width="50%" sx={{ fontWeight: 'bold', textAlign: 'right' }}>{value[0]}</TableCell>
          <TableCell colSpan={value[2] ? 1 : 2} sx={{ width: '1px', whiteSpace: 'nowrap' }}>{value[1]}</TableCell>
          {value[2] && <TableCell>{value[2]}</TableCell>}
        </TableRow>
      ))}
    </>
  );
}
