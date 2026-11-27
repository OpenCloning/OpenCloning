import React from 'react';
import { useSelector } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Tooltip, Typography,
} from '@mui/material';
import {
  openCloningDBHttpClient, endpoints, BulkUploadModal, MAX_CONCURRENT_CHECKS, runWithConcurrency, SequenceSelect,
} from '@opencloning/opencloningdb';
import { useBackendHttpClient } from '@opencloning/ui/hooks';
import { readSequencingFile } from '@opencloning/utils/readNwrite';
import error2String from '@opencloning/utils/error2String';
import useAppAlerts from '../../hooks/useAppAlerts';
import {
  fastqSampleName, finalFastqFilesFromZip, isAlreadyLinked, linkEntries, linkRow, linkRowStatuses, newSampleCount,
  withMatches, withTarget,
} from '../../utils/bulk_upload';
import { fetchSampleByUid } from '../../utils/sample_queries';
import SampleTargetSelect from './SampleTargetSelect';

/** Samples can only be created for real sequences, not templates. */
const isRealSequence = (sequence) => sequence.type === 'sequence';

/**
 * The sequences without samples that are the read of the file circularised (whole-plasmid sequencing), or null if
 * the file cannot be read or checked (so that one file does not stop the others).
 */
async function exactMatches(backendHttpClient, file) {
  try {
    const { teselaJson } = await readSequencingFile(file);
    const { data: seguid } = await backendHttpClient.post('seguid', { sequence: teselaJson.sequence, circular: true });
    const { data } = await openCloningDBHttpClient.get(endpoints.sequencesBySeguid(seguid), { params: { without_samples: true } });
    return data;
  } catch {
    // Reported in the summary of the matches
    return null;
  }
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function RowStatus({ row, status }) {
  const chips = [];
  if (status.status === 'existing') chips.push(<Chip key="s" size="small" color="success" label="Existing sample" />);
  if (status.status === 'new') chips.push(<Chip key="s" size="small" color="info" label="New sample" />);
  if (status.status === 'no_sample') chips.push(<Chip key="s" size="small" color="warning" label="Choose a sample" />);
  if (status.status === 'no_sequence') chips.push(<Chip key="s" size="small" color="warning" label="Choose a sequence" />);
  if (status.status === 'skip') chips.push(<Chip key="s" size="small" label="Skipped" />);
  if (status.status === 'already_linked') {
    chips.push(
      <Tooltip key="s" title={`${row.uid} already has a sequencing file called ${row.file.name}. Choose another sample to link it.`}>
        <Chip size="small" label="Already linked" />
      </Tooltip>,
    );
  }
  if (row.matchedByRead && status.status === 'new') {
    chips.push(<Chip key="m" size="small" variant="outlined" label="Matched by read" />);
  }
  if (status.conflict) {
    chips.push(<Chip key="c" size="small" color="error" label="Same new sample, different sequences" />);
  }
  if (status.duplicates.length > 0) {
    chips.push(<Chip key="d" size="small" color="warning" variant="outlined" label={`Also used for ${status.duplicates.join(', ')}`} />);
  }
  return <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>{chips}</Stack>;
}

function SequenceCell({ row, onChange }) {
  if (!row.uid || row.skip) {
    return null;
  }
  if (row.sample) {
    return <Typography variant="body2">{row.sequence.name}</Typography>;
  }
  return (
    <Stack spacing={0.5}>
      <SequenceSelect
        multiple={false}
        label="Sequence"
        value={row.sequence}
        onChange={(sequence) => onChange({ sequence, matchedByRead: false })}
        filter={isRealSequence}
        size="small"
        sx={{ minWidth: 240 }}
      />
      {row.candidates.length > 0 && !row.sequence && (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="caption">{plural(row.candidates.length, 'sequence')} match the read:</Typography>
          {row.candidates.map((sequence) => (
            <Chip key={sequence.id} size="small" label={sequence.name} onClick={() => onChange({ sequence, matchedByRead: true })} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Link the .final.fastq files of a zipped sequencing run (one folder per sample) to samples. Each file goes to the
 * sample whose UID is its sample name, if it exists. Otherwise, the user picks an existing sample, or creates a new
 * one choosing its sequence. "Find exact matches" fills the sequence of new samples when the read is exactly a
 * sequence without samples (whole-plasmid sequencing).
 */
export default function BulkLinkSequencingFilesButton() {
  const isViewer = useSelector((state) => state.auth.workspace?.role) === 'viewer';
  const zipInput = React.useRef(null);
  // { zipName, rows }, see linkRow
  const [run, setRun] = React.useState(null);
  const { addAlert, addErrorAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const backendHttpClient = useBackendHttpClient();

  // changes: the fields to change, or a function of the current row that returns the new row
  const updateRow = (index, changes) => setRun((current) => ({
    ...current,
    rows: current.rows.map((row, i) => {
      if (i !== index) return row;
      return typeof changes === 'function' ? changes(row) : { ...row, ...changes };
    }),
  }));

  const readZip = useMutation({
    mutationFn: async (zipFile) => {
      const files = await finalFastqFilesFromZip(zipFile);
      // The sample whose UID is the sample name of the file, if any
      const samples = await runWithConcurrency(files, MAX_CONCURRENT_CHECKS, (file) => fetchSampleByUid(fastqSampleName(file)));
      const rows = files.map((file, i) => linkRow(file, samples[i])).sort((a, b) => a.sampleName.localeCompare(b.sampleName));
      return { zipName: zipFile.name, rows };
    },
    onSuccess: (data) => (data.rows.length > 0
      ? setRun(data)
      : addAlert({ message: `No .final.fastq files found in ${data.zipName}`, severity: 'error' })),
    onError: addErrorAlert,
  });

  const findMatches = useMutation({
    mutationFn: async () => {
      // Only the rows without sample, the user's choices are not changed
      const indexes = run.rows.map((row, i) => (!row.skip && !row.uid ? i : null)).filter((i) => i !== null);
      const matches = await runWithConcurrency(indexes, MAX_CONCURRENT_CHECKS, (i) => exactMatches(backendHttpClient, run.rows[i].file));
      return indexes.map((index, i) => ({ index, matches: matches[i] }));
    },
    onSuccess: (results) => {
      const matchesByIndex = Object.fromEntries(results.map(({ index, matches }) => [index, matches]));
      // Applied to the current rows: those that the user changed while matching are left as they are
      setRun((current) => ({ ...current, rows: current.rows.map((row, i) => withMatches(row, matchesByIndex[i])) }));
      const matched = results.filter(({ matches }) => matches?.length > 0).length;
      const failed = results.filter(({ matches }) => matches === null).map(({ index }) => run.rows[index].sampleName);
      const message = `Matched ${matched} of ${plural(results.length, 'file')} without sample`
        + (failed.length > 0 ? `. Could not check: ${failed.join(', ')}` : '');
      addAlert({ message, severity: matched > 0 ? 'success' : 'info' });
    },
    onError: addErrorAlert,
  });

  const link = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      linkEntries(run.rows).forEach(({ sampleUid, sequenceId, file }) => {
        formData.append('sample_uids', sampleUid);
        formData.append('sequence_ids', sequenceId);
        formData.append('files', file);
      });
      const { data } = await openCloningDBHttpClient.post(endpoints.sequenceSamplesSequencingFilesBulk, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: ({ created, created_samples: createdSamples }) => {
      const newSamples = createdSamples > 0 ? `, ${plural(createdSamples, 'new sample')}` : '';
      addAlert({ message: `Linked ${plural(created, 'sequencing file')} successfully${newSamples}`, severity: 'success' });
      ['sequence', 'sequences', 'sequence_samples', 'sequence_sample'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      closeModal();
    },
  });

  function closeModal() {
    setRun(null);
    link.reset();
    findMatches.reset();
  }

  if (isViewer) {
    return null;
  }

  const statuses = run ? linkRowStatuses(run.rows) : [];
  const linkedCount = run ? linkEntries(run.rows).length : 0;
  const newSamples = run ? newSampleCount(run.rows) : 0;
  const blocked = statuses.some(({ blocking }) => blocking);
  const unresolved = statuses.filter(({ status }) => status === 'no_sample').length;
  const alreadyLinked = statuses.filter(({ status }) => status === 'already_linked').length;
  const busy = link.isPending || findMatches.isPending;

  return (
    <>
      <Tooltip title="Link the .final.fastq files of a zipped sequencing run to samples">
        <Button onClick={() => zipInput.current?.click()} disabled={readZip.isPending} data-testid="bulk-link-sequencing-files-button">
          {readZip.isPending ? <CircularProgress size={24} /> : 'Link sequencing files'}
        </Button>
      </Tooltip>
      <input
        hidden
        type="file"
        accept=".zip"
        ref={zipInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          // So that the same file can be selected again
          event.target.value = null;
          if (file) readZip.mutate(file);
        }}
        data-testid="bulk-link-sequencing-files-zip-input"
      />

      <BulkUploadModal
        open={run !== null}
        onClose={busy ? undefined : closeModal}
        title="Link sequencing files"
        dataTestId="bulk-link-sequencing-files-modal"
      >
        {run && (
          <Stack spacing={2} sx={{ minHeight: 0 }}>
            <Typography data-testid="bulk-link-sequencing-files-count">
              {plural(run.rows.length, '.final.fastq file')} in {run.zipName}
              {' '}({statuses.filter(({ status }) => status === 'existing' || status === 'already_linked').length} with an
              {' '}existing sample of the same name{alreadyLinked > 0 && `, ${alreadyLinked} already linked`}).
            </Typography>
            <Typography variant="body2">
              Each file goes to the sample whose UID is its sample name. For the others, search an existing sample, or
              create a new one and choose its sequence. Uncheck a file to skip it.
            </Typography>
            <TableContainer sx={{ minHeight: 0, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">Link</TableCell>
                    <TableCell>File</TableCell>
                    <TableCell>Sample</TableCell>
                    <TableCell>Sequence</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {run.rows.map((row, i) => (
                    <TableRow key={row.sampleName} data-testid="bulk-link-row" data-sample-name={row.sampleName}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={!row.skip && !isAlreadyLinked(row)}
                          onChange={(event) => updateRow(i, { skip: !event.target.checked })}
                          disabled={busy || isAlreadyLinked(row)}
                          slotProps={{ input: { 'aria-label': `Link ${row.sampleName}` } }}
                        />
                      </TableCell>
                      <TableCell>{row.sampleName}</TableCell>
                      <TableCell>
                        {!row.skip && (
                          <SampleTargetSelect
                            value={row.uid ? { uid: row.uid, sample: row.sample } : null}
                            newUid={row.sampleName}
                            onChange={(target) => updateRow(i, (current) => withTarget(current, target))}
                          />
                        )}
                      </TableCell>
                      <TableCell><SequenceCell row={row} onChange={(changes) => updateRow(i, changes)} /></TableCell>
                      <TableCell><RowStatus row={row} status={statuses[i]} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {link.error && <Alert severity="error">{error2String(link.error)}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Tooltip title="For the files without sample: find sequences without samples that are exactly the read (whole-plasmid sequencing only)">
                <span>
                  <Button variant="outlined" onClick={() => findMatches.mutate()} disabled={busy || unresolved === 0}>
                    {findMatches.isPending ? <CircularProgress size={24} /> : 'Find exact matches'}
                  </Button>
                </span>
              </Tooltip>
              <Button variant="outlined" color="error" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => link.mutate()}
                disabled={busy || blocked || linkedCount === 0}
                data-testid="bulk-link-sequencing-files-submit"
              >
                {link.isPending
                  ? <CircularProgress size={24} />
                  : `Link ${plural(linkedCount, 'file')}${newSamples > 0 ? ` · create ${plural(newSamples, 'sample')}` : ''}`}
              </Button>
            </Box>
          </Stack>
        )}
      </BulkUploadModal>
    </>
  );
}
