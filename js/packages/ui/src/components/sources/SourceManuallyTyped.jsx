import React from 'react';
import { Checkbox, FormControl, FormControlLabel, TextField } from '@mui/material';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import ValidatedTextField from '../form/ValidatedTextField';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';

function SourceManuallyTyped({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId } = source;

  const [userInput, setUserInput] = React.useState('');
  const [isCircular, setIsCircular] = React.useState(false);
  const [overhangCrick3prime, setOverhangCrick3prime] = React.useState(0);
  const [overhangWatson3prime, setOverhangWatson3prime] = React.useState(0);
  const [errorStatus, setErrorStatus] = React.useState({ sequence: true });
  const [touched, setTouched] = React.useState(false);
  const [submissionAttempted, setSubmissionAttempted] = React.useState(false);

  const submissionAllowed = touched && Object.values(errorStatus).every((error) => !error);
  const updateValidationStatus = (fieldName, valid) => {
    setTouched(true);
    // Update the validation status for the given field (taken from the ref.id)
    setErrorStatus((prevErrorStatus) => ({
      ...prevErrorStatus,
      [fieldName]: valid,
    }));
  };

  const onInputChange = (event) => {
    // Remove all non-letter characters on paste
    if (event.nativeEvent.inputType === 'insertFromPaste') {
      setUserInput(event.target.value.replace(/[^a-zA-Z]/g, ''));
    } else {
      setUserInput(event.target.value);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setSubmissionAttempted(true);
    if (submissionAllowed) {
      const requestData = {
        source: { id: sourceId },
        sequence: {
          id: sourceId,
          sequence: userInput,
          circular: isCircular,
          overhang_crick_3prime: overhangCrick3prime,
          overhang_watson_3prime: overhangWatson3prime,
        },
      };
      sendSourceRequest({ endpoint: 'manually_typed', requestData, source });
    }
  };

  const onCircularChange = () => {
    // See constrains of ManuallyTyped in the backend
    const newIsCircular = !isCircular;
    setIsCircular(newIsCircular);
    if (newIsCircular) {
      setOverhangCrick3prime(0);
      setOverhangWatson3prime(0);
    }
  };

  const sequenceErrorChecker = (s) => (stringIsNotDNA(s) ? { error: true, helperText: 'invalid DNA sequence' } : { error: false, helperText: '' });

  return (
    <form onSubmit={onSubmit}>
      <ValidatedTextField
        fullWidth
        id="sequence"
        label="Sequence"
        variant="outlined"
        value={userInput}
        onInputChange={onInputChange}
        className="sequence"
        submissionAttempted={submissionAttempted}
        required
        errorChecker={sequenceErrorChecker}
        updateValidationStatus={updateValidationStatus}
      />
      {
        !isCircular && (
          <>
            <FormControl fullWidth>
              <TextField
                label="Overhang crick 3'"
                value={overhangCrick3prime}
                type="number"
                onChange={(event) => setOverhangCrick3prime(event.target.value)}
              />
            </FormControl>
            <FormControl fullWidth>
              <TextField
                label="Overhang watson 3'"
                value={overhangWatson3prime}
                type="number"
                onChange={(event) => setOverhangWatson3prime(event.target.value)}
              />
            </FormControl>
          </>
        )
      }

      <FormControl fullWidth style={{ textAlign: 'left' }}>
        <FormControlLabel control={<Checkbox value={isCircular} onChange={onCircularChange} />} label="Circular DNA" />
      </FormControl>
      <SubmitButtonBackendAPI
        requestStatus={requestStatus}
        {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-manually-typed" })}
      >Submit</SubmitButtonBackendAPI>
    </form>
  );
}

export default SourceManuallyTyped;
