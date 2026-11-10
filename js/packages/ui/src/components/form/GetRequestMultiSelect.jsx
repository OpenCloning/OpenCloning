import * as React from 'react';
import { Autocomplete, TextField, Alert, Button, CircularProgress, FormControl, FormHelperText, InputLabel, MenuItem, Select } from '@mui/material';

export default function GetRequestMultiSelect({ 
  getOptionsFromResponse,
  url,
  label,
  messages,
  onChange,
  httpClient,
  multiple = true,
  autoComplete = true,
  getOptionLabel,
  requestHeaders = {},
  noOptionsMessage = 'No options found',
  requestParams = {},
  ...rest
}) {
  const { loadingMessage, errorMessage } = messages;
  const [options, setOptions] = React.useState([]);
  const [connectAttempt, setConnectAttemp] = React.useState(0);
  const [error, setError] = React.useState(false);
  const [waitingMessage, setWaitingMessage] = React.useState(loadingMessage);

  React.useEffect(() => {
    httpClient.get(url, { headers: requestHeaders, params: requestParams }).then(({ data }) => {
      setWaitingMessage(null);
      const respOptions = getOptionsFromResponse(data);
      if (!Array.isArray(respOptions)) {
        throw new Error('Expected array of options from getOptionsFromResponse');
      }
      setOptions(respOptions);
      setError(false);
    }).catch((e) => { setWaitingMessage(errorMessage); setError(true); setOptions([]); });
  }, [connectAttempt]);

  if (error) {
    return (
      <Alert
        sx={{ alignItems: 'center' }}
        severity="error"
        action={(
          <Button color="inherit" size="small" onClick={() => { setWaitingMessage('Retrying...'); setConnectAttemp(connectAttempt + 1); }}>
            Retry
          </Button>
        )}
      >
        {waitingMessage}
      </Alert>
    );
  }

  if (waitingMessage) {
    return (

      <Alert severity="info" icon={<CircularProgress color="inherit" size="1em" />}>
        {waitingMessage}
      </Alert>

    );
  }

  return (
    <FormControl {...rest}>
      {autoComplete ? (
        <Autocomplete
          multiple={multiple}
          onChange={(event, value) => { onChange(value); }}
          options={options}
          getOptionLabel={getOptionLabel}
          defaultValue={multiple ? [] : ''}
          freeSolo
          forcePopupIcon
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              error={error}
              helperText={options.length === 0 ? noOptionsMessage : ''}
            />
          )}
        />
      ) : (
        <>
          <InputLabel id={`select-${label.replaceAll(' ', '-')}`}>{label}</InputLabel>
          <Select
            multiple={multiple}
            onChange={(event) => { onChange(event.target.value, options); }}
            label={label}
            defaultValue={multiple ? [] : ''}
            error={options.length === 0}
          >
            {options.map((option) => (
              <MenuItem key={getOptionLabel(option)} value={getOptionLabel(option)}>
                {getOptionLabel(option)}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>{options.length === 0 ? noOptionsMessage : ''}</FormHelperText>
        </>
      )}
    </FormControl>
  );
}
