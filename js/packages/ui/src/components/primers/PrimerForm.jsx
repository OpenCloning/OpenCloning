import React from 'react';
import { CheckCircle as CheckCircleIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';
import ValidatedTextField from '../form/ValidatedTextField';

import './PrimerForm.css';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';

function PrimerForm({
  primer = { name: '', sequence: '', id: null }, submitPrimer, cancelForm, existingNames, disabledSequenceText = '',
}) {
  const [errorStatus, setErrorStatus] = React.useState(primer.id ? { name: false, sequence: false } : { name: true, sequence: true });
  const [touched, setTouched] = React.useState(false);
  const [submissionAttempted, setSubmissionAttempted] = React.useState(false);
  const [name, setName] = React.useState(primer.name);
  const [sequence, setSequence] = React.useState(primer.sequence);

  React.useEffect(() => {
    setName(primer.name);
    setSequence(primer.sequence);
  }, [primer.name, primer.sequence]);

  const updateValidationStatus = (fieldName, valid) => {
    setTouched(true);
    // Update the validation status for the given field (taken from the ref.id)
    setErrorStatus((prevErrorStatus) => ({
      ...prevErrorStatus,
      [fieldName]: valid,
    }));
  };
  const submissionAllowed = Object.values(errorStatus).every((error) => !error);

  const onSubmit = (e) => {
    e.preventDefault();
    setSubmissionAttempted(true);
    if (submissionAllowed) {
      // Id is null in the case of adding new primer
      const { id } = primer;
      submitPrimer({ id, name, sequence });
      cancelForm();
    }
  };

  const onSequenceChange = (event) => {
    // Remove all non-letter characters on paste
    if (event.nativeEvent.inputType === 'insertFromPaste') {
      setSequence(event.target.value.replace(/[^a-zA-Z]/g, ''));
    } else {
      setSequence(event.target.value);
    }
  };

  const sequenceErrorChecker = (s) => (stringIsNotDNA(s) ? { error: true, helperText: 'Invalid DNA sequence' } : { error: false, helperText: '' });
  const nameErrorChecker = (s) => (existingNames.includes(s) ? { error: true, helperText: 'Name exists' } : { error: false, helperText: '' });

  return (
    <form className="primer-row" onSubmit={onSubmit} style={{ margin: 'auto' }}>
      <ValidatedTextField
        id="name"
        label="Name"
        value={name}
        onInputChange={(e) => setName(e.target.value)}
        sx={{ m: 1, display: { width: '20%' } }}
        submissionAttempted={submissionAttempted}
        required
        errorChecker={nameErrorChecker}
        updateValidationStatus={updateValidationStatus}
        floatingHelperText
      />
      <ValidatedTextField
        id="sequence"
        label="Sequence"
        value={sequence}
        onInputChange={onSequenceChange}
        sx={{ m: 1, display: { width: '60%' } }}
        className="sequence"
        submissionAttempted={submissionAttempted}
        required
        errorChecker={sequenceErrorChecker}
        updateValidationStatus={updateValidationStatus}
        floatingHelperText
        disabled={disabledSequenceText !== ''}
        initialHelperText={disabledSequenceText}
      />
      {touched
      && (
      <IconButton type="submit" sx={{ height: 'fit-content' }}>
        <Tooltip title={submissionAllowed ? 'Save changes' : 'Incorrect values'} arrow placement="top">
          <CheckCircleIcon size={25} className={submissionAllowed ? '' : 'form-invalid'} color={submissionAllowed ? 'success' : 'grey'} />
        </Tooltip>
      </IconButton>
      )}
      {cancelForm !== null && (
      <IconButton onClick={cancelForm} type="button" sx={{ height: 'fit-content' }}>
        <Tooltip title="Discard changes" arrow placement="top">
          <CancelIcon color="error" />
        </Tooltip>
      </IconButton>
      )}

    </form>
  );
}

export default PrimerForm;
