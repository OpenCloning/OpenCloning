import React from 'react';
import { Table, TableCell, TableRow, TableHead, TableBody, Tooltip } from '@mui/material';
import { Cancel as CancelIcon, Warning as WarningIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

function CustomTableRow({ primer }) {
  const { name, sequence, error } = primer;

  let msg = 'Valid primer';
  let icon = <CheckCircleIcon color="success" />;
  if (error === 'invalid') {
    msg = 'Invalid DNA sequence';
    icon = <CancelIcon color="error" />;
  } else if (error === 'existing') {
    msg = 'Primer already exists';
    icon = <WarningIcon color="warning" />;
  }

  return (
    <TableRow>
      <TableCell align="center">
        <Tooltip title={msg} placement="top">{icon}</Tooltip>
      </TableCell>
      <TableCell>{name}</TableCell>
      <TableCell className="sequence-cell">{sequence}</TableCell>
    </TableRow>
  );
}

function PrimersImportTable({ importedPrimers }) {
  return (
    <Table className="primers-table">
      <TableHead>
        <TableRow>
          <TableCell align="center">Status</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Sequence</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {importedPrimers.map((primer, index) => (
          <CustomTableRow key={index} primer={primer} />
        ))}
      </TableBody>
    </Table>
  );
}

export default PrimersImportTable;
