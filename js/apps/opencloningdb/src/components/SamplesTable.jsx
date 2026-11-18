import React from 'react';
import { Checkbox, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { SequenceLink } from './EntityLinks';
import TagChipList from './TagChipList';
import SequenceTypeChip from './SequenceTypeChip';
import SelectAllCheckbox from './SelectAllCheckbox';
import { SampleUidLabel } from '@opencloning/opencloningdb';

/** One row per sample (output of GET /sequence_samples), with the sequence it points to. */
function SamplesTable({ samples, withCheckbox = false, selectedIds = new Set(), toggleRow = () => {} }) {
  const ids = samples.map((sample) => sample.id);

  return (
    <Table size="small" data-testid="samples-table">
      <TableHead>
        <TableRow>
          {withCheckbox && (
            <TableCell padding="checkbox">
              <SelectAllCheckbox
                ids={ids}
                selectedIds={selectedIds}
                toggleRow={toggleRow}
                ariaLabel="select all samples"
              />
            </TableCell>
          )}
          <TableCell>UID</TableCell>
          <TableCell>Sequence</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Location</TableCell>
          <TableCell>Sequencing files</TableCell>
          <TableCell>Tags</TableCell>
          <TableCell>Created by</TableCell>
          <TableCell>Created at</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {samples.map((sample) => (
          <TableRow key={sample.id} hover data-testid="samples-table-row">
            {withCheckbox && (
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={selectedIds.has(sample.id)}
                  onChange={(e) => toggleRow(sample.id, e)}
                />
              </TableCell>
            )}
            <TableCell>
              <SampleUidLabel uid={sample.uid} />
            </TableCell>
            <TableCell>
              <SequenceLink id={sample.sequence.id} name={sample.sequence.name} />
            </TableCell>
            <TableCell>
              <SequenceTypeChip sequenceType={sample.sequence.sequence_type} />
            </TableCell>
            <TableCell>{sample.location ?? '—'}</TableCell>
            <TableCell>{sample.sequencing_files.length || '—'}</TableCell>
            <TableCell>
              <TagChipList tags={sample.sequence.tags ?? []} />
            </TableCell>
            <TableCell>{sample.created_by?.display_name ?? '—'}</TableCell>
            <TableCell>{sample.created_at ? new Date(sample.created_at).toLocaleDateString() : '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default SamplesTable;
