import * as React from 'react';
import { Autocomplete, TextField, Alert, Button, FormControl } from '@mui/material';

export default function PostRequestSelect({ setValue, getOptions, getOptionLabel, isOptionEqualToValue, textLabel, disableFiltering = true, ...rest }) {
  // The reason for disableFiltering is that we allow the server to filter the options,
  // and whatever matches may not end up in the option label. For instance, when querying
  // for species, we show the species name + id, but it may be that something else matches
  // .e.g. "yeast" for "Saccharomyces cerevisiae - 4932"
  const [options, setOptions] = React.useState([]);
  const [connectAttempt, setConnectAttemp] = React.useState(0);
  const [error, setError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  // user input state
  const [userInput, setUserInput] = React.useState('');
  const [noOptionsText, setNoOptionsText] = React.useState('');

  React.useEffect(() => {
    async function fetchData() {
      if (userInput.length >= 3) {
        try {
          setNoOptionsText('Loading options...');
          const receivedOptions = await getOptions(userInput);
          setOptions(receivedOptions);
          setErrorMessage(null);
          setError(false);
          if (receivedOptions.length === 0) { setNoOptionsText('No results found'); }
        } catch (e) {
          setErrorMessage('Could not retrieve data');
          setError(true);
        }
      } else { setNoOptionsText(''); setOptions([]); }
    }
    // Delay the fetch to avoid too many requests
    const timeOutId = setTimeout(() => fetchData(), 500);
    return () => clearTimeout(timeOutId);
  }, [connectAttempt]);

  React.useEffect(() => {
    // Reset the value when the component is re-rendered at the same position
    // with different functions
    setUserInput('');
    setOptions([]);
    setNoOptionsText('');
  }, [setValue, getOptions, getOptionLabel, isOptionEqualToValue, textLabel]);

  if (error) {
    return (
      <Alert
        sx={{ alignItems: 'center' }}
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => { setErrorMessage('Retrying...'); setConnectAttemp(connectAttempt + 1); }}>
            Retry
          </Button>
        )}
      >
        {errorMessage}
      </Alert>
    );
  }

  return (
    <FormControl {...rest}>
      <Autocomplete
        onChange={(event, value) => { setValue(value); setUserInput(getOptionLabel(value)); }}
        // Change options only when input changes (not when an option is picked)
        onInputChange={(event, newInputValue, reason) => { if (reason === 'input') { setUserInput(newInputValue); setConnectAttemp(connectAttempt + 1); } }}
        options={options}
        noOptionsText={noOptionsText || 'Type at least 3 characters to search'}
        getOptionLabel={getOptionLabel}
        isOptionEqualToValue={isOptionEqualToValue}
        inputValue={userInput}
        filterOptions={disableFiltering ? (x) => x : undefined}
        renderInput={(params) => (
          <TextField
            {...params}
            label={textLabel}
          />
        )}
      />
    </FormControl>
  );
}
