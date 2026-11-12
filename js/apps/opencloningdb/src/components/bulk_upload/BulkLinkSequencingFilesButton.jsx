import React from 'react';
import { useSelector } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, Tooltip, Typography } from '@mui/material';
import { openCloningDBHttpClient, endpoints, BulkUploadModal, MAX_CONCURRENT_CHECKS, runWithConcurrency } from '@opencloning/opencloningdb';
import { useBackendHttpClient } from '@opencloning/ui/hooks';
import { downloadTextFile, readSequencingFile } from '@opencloning/utils/readNwrite';
import { delimitedFileToJson } from '@opencloning/utils/fileParsers';
import error2String from '@opencloning/utils/error2String';
import useAppAlerts from '../../hooks/useAppAlerts';
import { fastqSampleName, finalFastqFilesFromZip, pairFastqFilesWithSequences, sampleTableTsv } from '../../utils/bulk_upload';

/** Call mutate with the selected file, and clear the input so that the same file can be selected again. */
const onFileSelected = (mutate) => (event) => {
  const file = event.target.files?.[0];
  event.target.value = null;
  if (file) {
    mutate(file);
  }
};

/**
 * Name of the first sequence of the workspace with the seguid of the read circularised (sequencing runs of
 * whole plasmids), null if there is none or the file could not be read.
 */
async function matchingSequenceName(backendHttpClient, file) {
  try {
    const { teselaJson } = await readSequencingFile(file);
    const { data: seguid } = await backendHttpClient.post('seguid', { sequence: teselaJson.sequence, circular: true });
    const { data: matches } = await openCloningDBHttpClient.get(endpoints.sequencesBySeguid(seguid));
    return matches[0]?.name ?? null;
  } catch {
    return null;
  }
}

/** { sampleName: sequenceName } of the samples that match a sequence of the workspace. */
async function matchingSequenceNames(backendHttpClient, files) {
  const names = await runWithConcurrency(files, MAX_CONCURRENT_CHECKS, (file) => matchingSequenceName(backendHttpClient, file));
  return Object.fromEntries(files.map((file, i) => [fastqSampleName(file), names[i]]).filter(([, name]) => name));
}

/**
 * Link the .final.fastq files of a zipped sequencing run (one folder per sample) to existing sequences:
 * the user downloads a table with the sample names, fills in the sequence names by hand and uploads it.
 * The samples that match a sequence of the workspace exactly are already filled in the table.
 */
export default function BulkLinkSequencingFilesButton() {
  const isViewer = useSelector((state) => state.auth.workspace?.role) === 'viewer';
  const zipInput = React.useRef(null);
  const tableInput = React.useRef(null);
  // { zipName, files, sequenceNames }, sequenceNames as returned by matchingSequenceNames
  const [run, setRun] = React.useState(null);
  const { addAlert, addErrorAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const backendHttpClient = useBackendHttpClient();

  const readZip = useMutation({
    mutationFn: async (zipFile) => {
      const files = await finalFastqFilesFromZip(zipFile);
      return { zipName: zipFile.name, files, sequenceNames: await matchingSequenceNames(backendHttpClient, files) };
    },
    onSuccess: (data) => (data.files.length > 0
      ? setRun(data)
      : addAlert({ message: `No .final.fastq files found in ${data.zipName}`, severity: 'error' })),
    onError: addErrorAlert,
  });

  const link = useMutation({
    mutationFn: async (tableFile) => {
      const rows = await delimitedFileToJson(tableFile, ['sample_name', 'sequence_name'], true);
      const formData = new FormData();
      pairFastqFilesWithSequences(run.files, rows).forEach(({ sequenceName, file }) => {
        formData.append('sequence_names', sequenceName);
        formData.append('files', file);
      });
      const { data } = await openCloningDBHttpClient.post(endpoints.sequencingFilesBulk, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: ({ created }) => {
      addAlert({ message: `Linked ${created} sequencing file${created === 1 ? '' : 's'} successfully`, severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence'] });
      closeModal();
    },
  });

  function closeModal() {
    setRun(null);
    link.reset();
  }

  if (isViewer) {
    return null;
  }

  return (
    <>
      <Tooltip arrow title={<span style={{ fontSize: '1.2em' }}>Link the .final.fastq files of a zipped sequencing run to sequences</span>}>
        <Button onClick={() => zipInput.current?.click()} disabled={readZip.isPending} data-testid="bulk-link-sequencing-files-button">
          {readZip.isPending ? <CircularProgress size={24} /> : 'Link sequencing files'}
        </Button>
      </Tooltip>
      <input style={{ display: 'none' }} type="file" accept=".zip" ref={zipInput} onChange={onFileSelected(readZip.mutate)} data-testid="bulk-link-sequencing-files-zip-input" />
      <input style={{ display: 'none' }} type="file" accept=".csv,.tsv" ref={tableInput} onChange={onFileSelected(link.mutate)} data-testid="bulk-link-sequencing-files-table-input" />

      <BulkUploadModal
        open={run !== null}
        onClose={link.isPending ? undefined : closeModal}
        title="Link sequencing files"
        dataTestId="bulk-link-sequencing-files-modal"
      >
        {run && (
          <>
            <Typography sx={{ mb: 2 }} data-testid="bulk-link-sequencing-files-count">
              Found {run.files.length} .final.fastq file{run.files.length === 1 ? '' : 's'} in {run.zipName}
              {' '}({Object.keys(run.sequenceNames).length} match an existing sequence exactly).
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Download the sample table, fill in the sequence_name column with the sequence each sample should be
              linked to (leave it empty to skip a sample), and upload it. The samples that match an existing
              sequence are already filled in.
            </Typography>
            {link.error && <Alert severity="error" sx={{ mb: 2 }}>{error2String(link.error)}</Alert>}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button variant="outlined" color="error" onClick={closeModal} disabled={link.isPending}>
                Cancel
              </Button>
              <Button
                variant="outlined"
                onClick={() => downloadTextFile(sampleTableTsv(run.files, run.sequenceNames), `${run.zipName.replace(/\.zip$/i, '')}_samples.tsv`)}
              >
                Download sample table
              </Button>
              <Button variant="contained" onClick={() => tableInput.current?.click()} disabled={link.isPending}>
                {link.isPending ? <CircularProgress size={24} /> : 'Upload filled table'}
              </Button>
            </Box>
          </>
        )}
      </BulkUploadModal>
    </>
  );
}
