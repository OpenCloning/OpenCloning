import React from 'react';
import { openCloningDBHttpClient, endpoints, BulkUploadModal } from '@opencloning/opencloningdb';
import { delimitedFileToJson } from '@opencloning/utils/fileParsers';
import TemplateSequenceBulkUploadPreviewTable from './TemplateSequenceBulkUploadPreviewTable';
import {
  prepareTemplateSequenceRowsForValidation,
  VALID_TEMPLATE_SEQUENCE_TYPE_KEYS,
} from '../../utils/bulk_upload';
import { error2String } from '@opencloning/utils';
import BulkUploadMenuButton from './BulkUploadMenuButton';
import { BULK_SUBMISSION_TEMPLATES } from './bulkSubmissionTemplates';
import useBulkUploadFlow from './useBulkUploadFlow';

const VALID_TYPES_HINT = VALID_TEMPLATE_SEQUENCE_TYPE_KEYS.join(', ');

export default function BulkUploadTemplateSequencesButton() {
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
    validateMutationFn: async (items) => {
      const { data } = await openCloningDBHttpClient.post(
        endpoints.templateSequencesValidateUpload,
        items,
      );
      return data;
    },
    submitMutationFn: async ({ items, tags }) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.templateSequencesBulk, items, {
        params: {
          ...(tags?.length ? { tags } : {}),
        },
      });
      return data;
    },
    getSuccessMessage: (created) => `Imported ${created.length} template sequence${created.length === 1 ? '' : 's'} successfully`,
    onSubmitSuccess: (_data, _variables, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
    },
  });

  if (isViewer) {
    return null;
  }

  const handleFileUpload = async (event) => {
    const fileUploaded = event.target.files?.[0];
    if (!fileUploaded) {
      return;
    }

    try {
      const parsed = await delimitedFileToJson(fileUploaded, ['name', 'sequence_type'], true);
      const normalizedItems = prepareTemplateSequenceRowsForValidation(parsed);
      await validateSubmission(normalizedItems);
    } catch (error) {
      addAlert({
        message: error2String(error),
        severity: 'error',
      });
    } finally {
      event.target.value = null;
    }
  };

  const handleSubmit = (rows) => {
    if (rows.length < 1) {
      return;
    }
    const items = rows.map(({ name, sequence_type: sequenceType }) => ({
      name,
      ['sequence_type']: sequenceType,
    }));
    submitRows({ items, tags: bulkTags });
  };

  return (
    <>
      <BulkUploadMenuButton
        label="Bulk Upload Template Sequences"
        dataTestId="bulk-upload-template-sequences-button"
        onUploadClick={handleUploadClick}
        templatePath={BULK_SUBMISSION_TEMPLATES.templateSequences}
        tooltip={(
          <span style={{ fontSize: '1.2em' }}>
            Upload a .csv or .tsv file with headers name, sequence_type (case-insensitive).
            {' '}
            Valid sequence_type values:
            {' '}
            {VALID_TYPES_HINT}
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
        dataTestId="bulk-upload-template-sequences-modal"
        title="Bulk Upload Template Sequences Preview"
      >
        <TemplateSequenceBulkUploadPreviewTable
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
