import React from 'react';
import { useSelector } from 'react-redux';
import { SubmitCloningStrategiesInBulkComponent } from '@opencloning/opencloningdb';
import useAppAlerts from '../../hooks/useAppAlerts';
import { FileUploadButton } from '@opencloning/ui/components/common';

export default function BulkUploadCloningStrategiesButton() {
  const { addAlert } = useAppAlerts();
  const isViewer = useSelector((state) => state.auth.workspace?.role) === 'viewer';
  // Files being uploaded (null if the dialog is closed)
  const [files, setFiles] = React.useState(null);

  if (isViewer) {
    return null;
  }


  const onSuccess = (sequenceRefs, syncResults) => {
    const strategyCount = syncResults.length;
    // The server returns all the sequences of the strategies, the ones that were in the database already
    // are those of the sources with a database_id
    const existingIds = new Set(syncResults.flatMap(({ cloning_strategy: cloningStrategy }) => cloningStrategy.sources
      .map((source) => source.database_id)
      .filter((id) => id !== null && id !== undefined)));
    const createdCount = new Set(sequenceRefs.map((ref) => ref.id).filter((id) => !existingIds.has(id))).size;
    addAlert({
      message: `Imported ${strategyCount} cloning strateg${strategyCount === 1 ? 'y' : 'ies'} successfully${createdCount > 0 ? ` (${createdCount} sequence${createdCount === 1 ? '' : 's'} created)` : ''}`,
      severity: 'success',
    });
  };

  return (
    <>
      <FileUploadButton
        onFiles={setFiles}
        accept=".json,.dna"
        multiple
        data-testid="bulk-upload-cloning-strategies-button"
        tooltip={(
          <span style={{ fontSize: '1.2em' }}>
            Upload OpenCloning JSON files (cloning strategy files) or SnapGene (.dna) files
          </span>
        )}
      >
        Upload sequences with history
      </FileUploadButton>

      {files && (
        <SubmitCloningStrategiesInBulkComponent
          files={files}
          onClose={() => setFiles(null)}
          onSuccess={onSuccess}
          title="Bulk Upload Cloning Strategies Preview"
          dataTestId="bulk-upload-cloning-strategies-modal"
        />
      )}
    </>
  );
}
