import React from 'react';
import { Checkbox, Table, TableBody, TableCell, TableHead, TableRow, Box } from '@mui/material';
import { SequenceLink } from './EntityLinks';
import TagChipList from './TagChipList';
import SequenceTypeChip from './SequenceTypeChip';
import SelectAllCheckbox from './SelectAllCheckbox';
import SampleUidBadge from './SampleUidBadge';

function SequenceTableRow({ seq, withCheckbox, showSampleUids, showType, showCreatedBy, showCreatedAt, selectedIds, toggleRow }) {
  return (
    <TableRow key={seq.id} hover>
      {withCheckbox && (
        <TableCell padding="checkbox">
          <Checkbox
            size="small"
            checked={selectedIds.has(seq.id)}
            onChange={(e) => toggleRow(seq.id, e)}
          />
        </TableCell>
      )}
      {showSampleUids && (
        <TableCell>
          {seq.sample_uids?.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {seq.sample_uids.map((uid) => <SampleUidBadge key={uid} uid={uid} />)}
            </Box>
          ) : '—'}
        </TableCell>
      )}
      <TableCell>
        <SequenceLink id={seq.id} name={seq.name} />
      </TableCell>
      {showType && (
        <TableCell>
          <SequenceTypeChip sequenceType={seq.sequence_type} />
        </TableCell>
      )}
      <TableCell>
        <TagChipList tags={seq.tags ?? []} />
      </TableCell>
      {showCreatedBy && (
        <TableCell>{seq.created_by?.display_name ?? '—'}</TableCell>
      )}
      {showCreatedAt && (
        <TableCell>{seq.created_at ? new Date(seq.created_at).toLocaleDateString() : '—'}</TableCell>
      )}
    </TableRow>
  );
}

function SequenceTable({
  sequences,
  showType = true,
  showSampleUids = false,
  showCreatedBy = false,
  showCreatedAt = false,
  withCheckbox = false,
  selectedIds = new Set(),
  toggleRow = () => {},
}) {
  const ids = sequences.map((seq) => seq.id);

  return (
    <Table size="small" data-testid="sequence-table">
      <TableHead>
        <TableRow>
          {withCheckbox && (
            <TableCell padding="checkbox">
              <SelectAllCheckbox
                ids={ids}
                selectedIds={selectedIds}
                toggleRow={toggleRow}
                ariaLabel="select all sequences"
              />
            </TableCell>
          )}
          {showSampleUids && <TableCell>UID</TableCell>}
          <TableCell>Name</TableCell>
          {showType && <TableCell>Type</TableCell>}
          <TableCell>Tags</TableCell>
          {showCreatedBy && <TableCell>Created by</TableCell>}
          {showCreatedAt && <TableCell>Created at</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {sequences.map((seq) => (
          <SequenceTableRow
            key={seq.id}
            seq={seq}
            withCheckbox={withCheckbox}
            showSampleUids={showSampleUids}
            showType={showType}
            showCreatedBy={showCreatedBy}
            showCreatedAt={showCreatedAt}
            selectedIds={selectedIds}
            toggleRow={toggleRow} />
        ))}
      </TableBody>
    </Table>
  );

}

export default SequenceTable;
