import React from 'react';
import { useSelector } from 'react-redux';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import BulkUploadMenuButton from './BulkUploadMenuButton';
import { BULK_SUBMISSION_TEMPLATES } from './bulkSubmissionTemplates';
import useAppAlerts from '../../hooks/useAppAlerts';

/** Link zipped .fastq files to existing sequences, from a table (sequence_name, zip_file_name) and the zip files. */
export default function BulkLinkSequencingFilesButton() {
  const isViewer = useSelector((state) => state.auth.workspace?.role) === 'viewer';
  const hiddenFileInput = React.useRef(null);
  const { addAlert, addErrorAlert } = useAppAlerts();
  const queryClient = useQueryClient();

  const { mutate } = useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const { data } = await openCloningDBHttpClient.post(endpoints.sequencingFilesBulk, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: ({ created }) => {
      addAlert({ message: `Linked ${created} sequencing file${created === 1 ? '' : 's'} successfully`, severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence'] });
    },
    onError: addErrorAlert,
  });

  if (isViewer) {
    return null;
  }

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = null;
    if (files.length > 0) {
      mutate(files);
    }
  };

  return (
    <>
      <BulkUploadMenuButton
        label="Link sequencing files"
        tooltip={(
          <span style={{ fontSize: '1.2em' }}>
            Select a .tsv / .csv table (sequence_name, zip_file_name) and the .zip files, each containing a .fastq file
          </span>
        )}
        dataTestId="bulk-link-sequencing-files-button"
        onUploadClick={() => hiddenFileInput.current?.click()}
        templatePath={BULK_SUBMISSION_TEMPLATES.sequencingFiles}
        uploadLabel="Upload files"
      />
      <input
        style={{ display: 'none' }}
        type="file"
        multiple
        accept=".zip,.csv,.tsv"
        ref={hiddenFileInput}
        onChange={handleFileUpload}
        data-testid="bulk-link-sequencing-files-input"
      />
    </>
  );
}
