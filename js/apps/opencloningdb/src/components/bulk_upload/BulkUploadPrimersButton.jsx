import React from 'react';
import { openCloningDBHttpClient, endpoints, BulkUploadModal } from '@opencloning/opencloningdb';
import { delimitedFileToJson } from '@opencloning/utils/fileParsers';
import PrimerBulkUploadPreviewTable from './PrimerBulkUploadPreviewTable';
import { normalizePrimerSubmission } from '../../utils/bulk_upload';
import BulkUploadMenuButton from './BulkUploadMenuButton';
import { BULK_SUBMISSION_TEMPLATES } from './bulkSubmissionTemplates';
import useBulkUploadFlow from './useBulkUploadFlow';


export default function BulkUploadPrimersButton() {
  const {
    addErrorAlert,
    addAlert,
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
    validateMutationFn: async (primers) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.primersValidateUpload, primers);
      return data;
    },
    submitMutationFn: async ({ primers, modeLabel, tags }) => {
      const strict = modeLabel === 'clear';
      const { data } = await openCloningDBHttpClient.post(endpoints.primersBulk, primers, {
        params: {
          strict,
          ...(tags?.length ? { tags } : {}),
        },
      });
      return data;
    },
    getSuccessMessage: (createdPrimers, variables) => `Imported ${createdPrimers.length} ${variables.modeLabel} primer${createdPrimers.length === 1 ? '' : 's'} successfully`,
    onSubmitSuccess: (_data, _variables, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['primers'] });
    },
  });


  const handleFileUpload = async (event) => {
    const fileUploaded = event.target.files?.[0];
    if (!fileUploaded) {
      return;
    }

    try {
      const parsed = await delimitedFileToJson(fileUploaded, ['name', 'sequence', 'uid'], true);
      const normalizedRows = parsed.map(normalizePrimerSubmission);
      if (normalizedRows.length < 1) {
        throw new Error('File does not contain primer rows');
      }
      await validateSubmission(normalizedRows);
    } catch (error) {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Failed to parse or validate primers file',
        severity: 'error',
      });
    } finally {
      event.target.value = null;
    }
  };

  const handleSubmit = (primers, modeLabel) => {
    if (primers.length < 1) {
      return;
    }
    const primers2submit = primers.map(({name, sequence, uid}) => ({name, sequence, uid}));
    submitRows({ primers: primers2submit, modeLabel, tags: bulkTags });
  };

  if (isViewer) {
    return null;
  }

  return (
    <>
      <BulkUploadMenuButton
        label="Bulk Upload Primers"
        dataTestId="bulk-upload-primers-button"
        onUploadClick={handleUploadClick}
        templatePath={BULK_SUBMISSION_TEMPLATES.primers}
        tooltip={(
          <span style={{ fontSize: '1.2em' }}>
            Upload a .csv or .tsv file with headers name, sequence, uid
          </span>
        )}
      />

      <input
        style={{ display: 'none' }}
        type="file"
        accept=".csv,.tsv"
        ref={hiddenFileInput}
        onChange={handleFileUpload}
      />

      <BulkUploadModal
        open={openModal}
        onClose={closeModal}
        dataTestId="bulk-upload-primers-modal"
        title="Bulk Upload Primers Preview"
      >
        <PrimerBulkUploadPreviewTable
          rows={validationRows}
          handleSubmit={handleSubmit}
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
