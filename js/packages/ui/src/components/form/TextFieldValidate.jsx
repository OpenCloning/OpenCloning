import React from 'react';
import { Alert, Button, FormControl, TextField } from '@mui/material';

export default function TextFieldValidate({ getterFunction, onChange, label, defaultHelperText = '' }) {
  const [helperText, setHelperText] = React.useState('');
  const [userInput, setUserInput] = React.useState('');
  const [error, setError] = React.useState(false);
  const [connectionError, setConnectionError] = React.useState(false);
  const [connectionAttempt, setConnectionAttempt] = React.useState(0);
  React.useEffect(() => {
    // Send an empty response to clear the form
    onChange('', null);
    // Validate assemblyId with a 500ms delay
    if ((userInput !== '')) {
      setHelperText(`Validating ${label}...`);
      const timeOutId = setTimeout(async () => {
        try {
          const resp = await getterFunction(userInput);
          if (resp === null) {
            setHelperText(`${label} does not exist`);
            setError(true);
          } else {
            setHelperText('');
            setError(false);
          }
          onChange(userInput, resp);
        } catch (e) {
          console.error(e);
          setConnectionError(true);
        }
      }, 500);
      return () => clearTimeout(timeOutId);
    }
    // Also set to null if assemblyId is empty
    setHelperText(defaultHelperText);
    setError(false);
    return () => {};
  }, [userInput, connectionAttempt]);

  if (connectionError) {
    return (
      <Alert
        sx={{ alignItems: 'center' }}
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => { setConnectionError(false); setConnectionAttempt(connectionAttempt + 1); }}>
            Retry
          </Button>
    )}
      >
        Could not connect to server for validation.
      </Alert>
    );
  }
  return (
    <FormControl fullWidth>
      <TextField
        label={label}
        value={userInput}
        error={error}
        helperText={helperText}
        onChange={(event) => { setUserInput(event.target.value); }}
      />
    </FormControl>

  );
}
