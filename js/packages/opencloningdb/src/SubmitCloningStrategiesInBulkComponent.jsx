import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button } from '@mui/material';
import error2String from '@opencloning/utils/error2String';
import BulkUploadModal from './bulk_upload/BulkUploadModal';
import CloningStrategyBulkUploadPreviewTable from './bulk_upload/CloningStrategyBulkUploadPreviewTable';
import { validateCloningStrategyFiles, submitCloningStrategies } from './bulk_upload/cloning_strategy_bulk_api';
import { rowsToCloningStrategySyncResults } from './bulk_upload/bulk_upload_utils';

// Each dialog validates its own files, this gives it a unique key in the query cache
let validationCounter = 0;

/**
 * Dialog to submit several cloning strategies at once (the bulk upload of sequences with history):
 * the files are validated (and synced with the database), the user reviews the result, and the
 * importable ones are submitted.
 *
 * files: array of File (OpenCloning JSON or SnapGene .dna).
 * onSuccess(sequenceRefs, syncResults): sequenceRefs are returned by the server, all the sequences of the
 * submitted strategies, both the created ones and those that were already in the database. syncResults
 * are the submitted strategies ({ file_name, cloning_strategy }).
 */
function SubmitCloningStrategiesInBulkComponent({
  files,
  onClose,
  onSuccess,
  title = 'Upload to OpenCloningDB',
  dataTestId = 'submit-cloning-strategies-in-bulk-dialog',
}) {
  // Files cannot be part of the query key (they are not serializable), and React.useId would be
  // reused if the dialog is closed and opened again in the same place, so a counter is used.
  const [validationId] = React.useState(() => ++validationCounter);
  const queryClient = useQueryClient();
  const [bulkTags, setBulkTags] = React.useState([]);
  // Validation rows returned by the server when a submission conflicts with the database
  const [conflictRows, setConflictRows] = React.useState(null);
  const [message, setMessage] = React.useState(null);

  // A query (not a mutation) so that it is not sent twice in strict mode, gcTime 0 so that it is never reused
  const validation = useQuery({
    queryKey: ['cloningStrategyBulkValidate', validationId],
    queryFn: () => validateCloningStrategyFiles(files),
    retry: false,
    gcTime: 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
  const rows = conflictRows ?? validation.data ?? [];

  const submission = useMutation({
    mutationFn: submitCloningStrategies,
    onSuccess: (sequenceRefs, { syncResults }) => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      queryClient.invalidateQueries({ queryKey: ['primers'] });
      onSuccess?.(sequenceRefs, syncResults);
      onClose();
    },
    onError: (error) => {
      const updatedRows = error?.response?.status === 409 ? error.response.data : null;
      if (Array.isArray(updatedRows)) {
        setConflictRows(updatedRows);
        setMessage({ severity: 'warning', text: 'Conflicts detected while importing. Review the updated validation results.' });
        return;
      }
      setMessage({ severity: 'error', text: error2String(error) });
    },
  });

  const handleSubmit = (submittedRows) => {
    const syncResults = rowsToCloningStrategySyncResults(submittedRows);
    if (syncResults.length < 1) {
      setMessage({ severity: 'warning', text: 'No importable cloning strategies selected' });
      return;
    }
    setMessage(null);
    submission.mutate({ syncResults, tags: bulkTags });
  };

  return (
    <BulkUploadModal open onClose={submission.isPending ? undefined : onClose} title={title} dataTestId={dataTestId}>
      {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}
      {validation.error ? (
        <>
          <Alert severity="error" sx={{ mb: 2 }}>{error2String(validation.error)}</Alert>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={onClose}>Close</Button>
          </Box>
        </>
      ) : (
        <CloningStrategyBulkUploadPreviewTable
          rows={rows}
          handleSubmit={handleSubmit}
          handleCancel={onClose}
          isSubmitting={submission.isPending}
          isValidating={validation.isPending}
          bulkTags={bulkTags}
          onBulkTagsChange={setBulkTags}
          onTagCreateError={(error) => setMessage({ severity: 'error', text: `Could not create tag: ${error2String(error)}` })}
        />
      )}
    </BulkUploadModal>
  );
}

export default SubmitCloningStrategiesInBulkComponent;
