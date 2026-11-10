import React from 'react';
import { Checkbox, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { PrimerLink } from './EntityLinks';
import TagChipList from './TagChipList';
import SelectAllCheckbox from './SelectAllCheckbox';
import SampleUidBadge from './SampleUidBadge';

function PrimersTable({ primers, showCreatedBy = false, showCreatedAt = false, withCheckbox, selectedIds, toggleRow}) {
  const ids = primers.map((primer) => primer.id);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {withCheckbox && (
            <TableCell padding="checkbox">
              <SelectAllCheckbox
                ids={ids}
                selectedIds={selectedIds}
                toggleRow={toggleRow}
                ariaLabel="select all primers"
              />
            </TableCell>
          )}
          <TableCell>UID</TableCell>
          <TableCell>Name</TableCell>
          <TableCell>Tags</TableCell>
          <TableCell>Sequence</TableCell>
          {showCreatedBy && <TableCell>Created by</TableCell>}
          {showCreatedAt && <TableCell>Created at</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {primers.map((primer) => (
          <TableRow key={primer.id} hover>
            {withCheckbox && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={selectedIds.has(primer.id)}
                  onChange={(e) => toggleRow(primer.id, e)}
                />
              </TableCell>
            )}
            <TableCell>{primer.uid ? <SampleUidBadge uid={primer.uid} /> : '—'}</TableCell>
            <TableCell>
              <PrimerLink id={primer.id} name={primer.name} />
            </TableCell>
            <TableCell>
              <TagChipList tags={primer.tags ?? []} />
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace' }}>{primer.sequence ?? '—'}</TableCell>
            {showCreatedBy && (
              <TableCell>{primer.created_by?.display_name ?? '—'}</TableCell>
            )}
            {showCreatedAt && (
              <TableCell>{primer.created_at ? new Date(primer.created_at).toLocaleDateString() : '—'}</TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default PrimersTable;

