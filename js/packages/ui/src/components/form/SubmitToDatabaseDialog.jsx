import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import React from 'react';
import { batch, useDispatch, useSelector, useStore } from 'react-redux';
import useDatabase from '../../hooks/useDatabase';
import { cloningActions } from '@opencloning/store/cloning';
import { getSubState } from '@opencloning/utils/network';
import IntermediatesDisclaimer from './intermediates_disclaimer.svg';

function SubmitToDatabaseDialog({ id, dialogOpen, setDialogOpen, resourceType }) {
  const dispatch = useDispatch();
  const store = useStore();
  const [submissionData, setSubmissionData] = React.useState(null);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [disclaimerAccepted, setDisclaimerAccepted] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const database = useDatabase();

  // Checks if there are parent sources that are not in the database
  const hasUnsavedIntermediates = useSelector((state) => {
    if (resourceType === 'primer') {
      return false;
    }
    const substate = getSubState(state, id, true);
    const immediateParent = substate.sources.find((source) => source.id === id);
    return substate.sources.some((source) => (source.id !== immediateParent?.id) && !source.database_id);
  });

  const handleClose = () => {
    setDialogOpen(false);
    setErrorMessage('');
    setDisclaimerAccepted(false);
    setIsSubmitting(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    // This should never happen
    if (!database.isSubmissionDataValid(submissionData)) {
      setErrorMessage('Submission data is invalid');
      return;
    }
    try {
      setIsSubmitting(true);
      if (resourceType === 'primer') {
        const oldPrimer = store.getState().cloning.primers.find((p) => p.id === id);
        const primerDatabaseId = await database.submitPrimerToDatabase({ submissionData, primer: oldPrimer });
        const newPrimer = { ...oldPrimer, database_id: primerDatabaseId };
        batch(() => {
          dispatch(cloningActions.editPrimer(newPrimer));
          dispatch(cloningActions.addAlert({
            message: 'Primer created successfully',
            severity: 'success',
          }));
        });
      } else if (resourceType === 'sequence') {
        const substate = getSubState(store.getState(), id, true);
        let databaseId;
        let primerMappings;
        let sequenceMappings;
        try {
          ({ databaseId, primerMappings = [], sequenceMappings = [] } = await database.submitSequenceToDatabase({ submissionData, substate, id }));
        } catch (error) {
          console.error(error);
          setErrorMessage(error.message);
          setIsSubmitting(false);
          return;
        }
        batch(() => {
          primerMappings.forEach((mapping) => dispatch(cloningActions.addDatabaseIdToPrimer(mapping)));
          dispatch(cloningActions.addDatabaseIdToSequence({ databaseId, id }));
          sequenceMappings.forEach(({databaseId, localId}) => dispatch(cloningActions.addDatabaseIdToSequence({ databaseId, id: localId })));
          dispatch(cloningActions.addAlert({
            message: 'Sequence created successfully',
            severity: 'success',
          }));
        });
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }
    setDialogOpen(false);
    setIsSubmitting(false);
    setErrorMessage('');
  }

  if (!database.omitUnsavedIntermediatesDisclaimer && hasUnsavedIntermediates && !disclaimerAccepted) {
    return (
      <Dialog open={dialogOpen} onClose={handleClose} sx={{ textAlign: 'center' }}>
        <DialogTitle>Unsaved Intermediates</DialogTitle>
        <DialogContent sx={{ fontSize: '1.2em' }}>
          <p>There are intermediate sequences between the sequence being saved and its first ancestor in the database.</p>
          <p>
            Intermediate sequences will be stored in the history of the sequence you are saving, but not as separate entities
            in the database.
          </p>
          <img style={{ marginTop: '10px' }} src={IntermediatesDisclaimer} alt="Intermediates Disclaimer" />
        </DialogContent>
        <DialogActions>
          <Button color="success" onClick={() => setDisclaimerAccepted(true)}>I understand</Button>
          <Button color="error" onClick={handleClose}>Cancel</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      PaperProps={{
        component: 'form',
        sx: { width: '40%' },
        onSubmit: handleSubmit,
      }}
      data-testid="submit-to-database-component"
    >
      <DialogTitle>{`Save ${resourceType} to ${database.name}`}</DialogTitle>
      <DialogContent>
        <database.SubmitToDatabaseComponent id={id} submissionData={submissionData} setSubmissionData={setSubmissionData} resourceType={resourceType} />
        {resourceType === 'sequence' && !isSubmitting && <database.PrimersNotInDatabaseComponent id={id} submissionData={submissionData} setSubmissionData={setSubmissionData} />}
        {errorMessage && <Alert sx={{ marginTop: 2 }} severity="error">{errorMessage}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button type="submit" disabled={isSubmitting || submissionData === null || !database.isSubmissionDataValid(submissionData)}>{isSubmitting ? <CircularProgress /> : 'Submit'}</Button>
      </DialogActions>
    </Dialog>

  );
}

export default SubmitToDatabaseDialog;
