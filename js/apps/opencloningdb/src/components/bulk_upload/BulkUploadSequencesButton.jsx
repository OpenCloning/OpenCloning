import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { openCloningDBHttpClient, endpoints, BulkUploadModal } from '@opencloning/opencloningdb';
import SequenceBulkUploadPreviewTable from './SequenceBulkUploadPreviewTable';
import useBulkUploadFlow from './useBulkUploadFlow';

export default function BulkUploadSequencesButton() {
  const {
    addErrorAlert,
    bulkTags,
    closeModal,
    handleUploadClick,
    hiddenFileInput,
    isSubmitting,
    isValidating,
    isViewer,
    openModal,
    setBulkTags,
    submitRows,
    validationRows,
    validateSubmission,
  } = useBulkUploadFlow({
    supportsTags: true,
    validateMutationFn: async (files) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      const { data } = await openCloningDBHttpClient.post(endpoints.sequencesValidateUpload, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    submitMutationFn: async ({ submittedRows, mode, tags }) => {
      const strict = mode === 'clear';
      const formData = new FormData();
      submittedRows.forEach((row) => {
        formData.append('files', row.file);
      });
      const { data } = await openCloningDBHttpClient.post(endpoints.sequencesBulk, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        params: {
          strict,
          ...(tags?.length ? { tags } : {}),
        },
      });
      return data;
    },
    getSuccessMessage: (createdSequences) => `Imported ${createdSequences.length} sequence${createdSequences.length === 1 ? '' : 's'} successfully`,
    onSubmitSuccess: (_data, _variables, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
  });

  if (isViewer) {
    return null;
  }

  const handleFileUpload = async (event) => {
    const uploadedFiles = Array.from(event.target.files ?? []);
    if (uploadedFiles.length < 1) {
      return;
    }

    const hasDnaFiles = uploadedFiles.some((file) => file.name.toLowerCase().endsWith('.dna'));
    if (hasDnaFiles && !window.confirm(
      'Your upload includes SnapGene (.dna) file(s). Only the sequence will be imported. If you want to import the history, use the "Upload sequences with history" button.',
    )) {
      event.target.value = null;
      return;
    }

    try {
      await validateSubmission(uploadedFiles, {
        mapRows: (rows) => rows.map((row, index) => ({ ...row, file: uploadedFiles[index] })),
      });
    } finally {
      event.target.value = null;
    }
  };

  return (
    <>
      <Tooltip
        arrow
        title={(
          <span style={{ fontSize: '1.2em' }}>
            Upload sequence files (.fasta, .gb, .dna, .gbk, .ape)
          </span>
        )}
      >
        <Button onClick={handleUploadClick} data-testid="bulk-upload-sequences-button">
          Upload Sequences
        </Button>
      </Tooltip>

      <input
        style={{ display: 'none' }}
        type="file"
        multiple
        ref={hiddenFileInput}
        onChange={handleFileUpload}
      />

      <BulkUploadModal
        open={openModal}
        onClose={closeModal}
        dataTestId="bulk-upload-sequences-modal"
        title="Bulk Upload Sequences Preview"
      >
        <SequenceBulkUploadPreviewTable
          rows={validationRows}
          handleSubmit={(submittedRows, mode) => submitRows({ submittedRows, mode, tags: bulkTags })}
          handleCancel={closeModal}
          isSubmitting={isSubmitting}
          isValidating={isValidating}
          bulkTags={bulkTags}
          onBulkTagsChange={setBulkTags}
          onTagCreateError={addErrorAlert}
        />
      </BulkUploadModal>
    </>
  );
}
