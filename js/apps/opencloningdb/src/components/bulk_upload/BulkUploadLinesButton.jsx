import React from 'react';
import { openCloningDBHttpClient, endpoints, BulkUploadModal } from '@opencloning/opencloningdb';
import { delimitedFileToJson } from '@opencloning/utils/fileParsers';
import { error2String } from '@opencloning/utils';
import LineBulkUploadPreviewTable from './LineBulkUploadPreviewTable';
import { prepareLineRowsForValidation } from '../../utils/bulk_upload';
import BulkUploadMenuButton from './BulkUploadMenuButton';
import { BULK_SUBMISSION_TEMPLATES } from './bulkSubmissionTemplates';
import useBulkUploadFlow from './useBulkUploadFlow';

export default function BulkUploadLinesButton() {
  const {
    addErrorAlert,
    addAlert,
    closeModal,
    handleUploadClick,
    hiddenFileInput,
    isSubmitting,
    isValidating,
    isViewer,
    openModal,
    submitRows,
    bulkTags,
    setBulkTags,
    validationRows,
    validateSubmission,
  } = useBulkUploadFlow({
    supportsTags: true,
    validateMutationFn: async (items) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.linesValidateUpload, items);
      return data;
    },
    submitMutationFn: async ({ items, tags }) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.linesBulk, items, {
        params: {
          ...(tags?.length ? { tags } : {}),
        },
      });
      return data;
    },
    getSuccessMessage: (created) => `Imported ${created.length} line${created.length === 1 ? '' : 's'} successfully`,
    onSubmitSuccess: (_data, _variables, queryClient) => {
      queryClient.invalidateQueries({ queryKey: ['lines'] });
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
      const parsed = await delimitedFileToJson(
        fileUploaded,
        ['uid', 'plasmids', 'genotype', 'parent_uids'],
        true,
      );
      const normalizedItems = prepareLineRowsForValidation(parsed);
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
    const items = rows.map(({ uid, genotype, plasmids, parent_uids: parentUids }) => ({
      uid,
      genotype,
      plasmids,
      ['parent_uids']: parentUids,
    }));
    submitRows({ items, tags: bulkTags });
  };

  return (
    <>
      <BulkUploadMenuButton
        label="Bulk Upload Lines"
        dataTestId="bulk-upload-lines-button"
        onUploadClick={handleUploadClick}
        templatePath={BULK_SUBMISSION_TEMPLATES.lines}
        tooltip={(
          <span style={{ fontSize: '1.2em' }}>
            Upload a .csv or .tsv file with headers uid, plasmids, genotype, parent_uids (case-insensitive).
            Plasmids, genotype, and parent_uids are space-separated lists. At most two parent UIDs per line.
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
        dataTestId="bulk-upload-lines-modal"
        title="Bulk Upload Lines Preview"
      >
        <LineBulkUploadPreviewTable
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
