import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import DetailPageSection from './DetailPageSection';
import DetailTable from './DetailTable';
import { SequenceLink } from './EntityLinks';
import { sampleUidBadgeSx } from './SampleUidBadge';

/**
 * Samples moved to or from a sequence, e.g. a sample planned as this sequence that turned out to be another one
 * when sequenced. Not shown if there are none.
 */
function SampleHistorySection({ sequenceId }) {
  const { data: history = [] } = useQuery({
    queryKey: ['sequence', sequenceId, 'sample_history'],
    queryFn: async () => (await openCloningDBHttpClient.get(endpoints.sequenceSampleHistory(sequenceId))).data,
  });
  if (history.length === 0) return null;

  return (
    <DetailPageSection title="Sample history" data-testid="sequence-sample-history">
      <DetailTable maxWidth={1000}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sample</TableCell>
              <TableCell>Moved from</TableCell>
              <TableCell>Moved to</TableCell>
              <TableCell>Note</TableCell>
              <TableCell>By</TableCell>
              <TableCell>Date</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {history.map((entry) => (
              <TableRow key={entry.id} data-testid="sample-history-row">
                <TableCell>
                  {entry.sample_uid ? <Box component="span" sx={sampleUidBadgeSx}>{entry.sample_uid}</Box> : '—'}
                </TableCell>
                <TableCell>
                  {entry.from_sequence.id === sequenceId ? <i>this sequence</i> : <SequenceLink {...entry.from_sequence} />}
                </TableCell>
                <TableCell>
                  {entry.to_sequence.id === sequenceId ? <i>this sequence</i> : <SequenceLink {...entry.to_sequence} />}
                </TableCell>
                <TableCell>{entry.note ?? '—'}</TableCell>
                <TableCell>{entry.created_by?.display_name ?? '—'}</TableCell>
                <TableCell>{new Date(entry.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DetailTable>
    </DetailPageSection>
  );
}

export default SampleHistorySection;
