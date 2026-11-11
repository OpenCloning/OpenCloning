import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, TextField, FormControl, FormHelperText, InputLabel, MenuItem, Select, Button } from '@mui/material';
import QueryStatusWrapper from './QueryStatusWrapper';
import { AddCircle as AddCircleIcon } from '@mui/icons-material';

export default function QuerySelect({
  query,
  label,
  loadingMessage = 'Loading...',
  errorMessage = 'Could not load options',
  onChange = () => {},
  value,
  multiple = true,
  autoComplete = true,
  getOptionLabel,
  getOptionKey = getOptionLabel,
  autocompleteProps = {},
  inputProps = {},
  onClear = () => {},
  noOptionsAction = null, // { label: string, onClick: () => void }
  ...rest
}) {
  const queryResult = useQuery(query);
  const { data: options = [] } = queryResult;
  const [inputValue, setInputValue] = React.useState('');
  const [internalValue, setInternalValue] = React.useState(() => (multiple ? [] : null));

  const isControlled = value !== undefined;
  const effectiveValue = isControlled ? value : internalValue;

  const isOptionEqualToValue = React.useCallback((option, val) => getOptionKey(option) === getOptionKey(val), [getOptionKey]);

  // Selected + query options so selected items stay visible when typing
  const displayOptions = React.useMemo(() => {
    const selected = multiple ? (effectiveValue || []) : effectiveValue ? [effectiveValue] : [];
    const allOptions = [...selected, ...options];
    return allOptions.filter((obj, index, self) =>
      index === self.findIndex((t) => getOptionKey(t) === getOptionKey(obj))
    );
  }, [effectiveValue, multiple, options, getOptionKey]);

  const handleAutocompleteChange = React.useCallback(
    (event, newValue) => {
      if (!isControlled) setInternalValue(newValue);
      onChange(newValue);
      setInputValue('');
      onClear();
    },
    [onChange, isControlled, onClear],
  );

  const autocompleteValue = effectiveValue !== undefined ? effectiveValue : (multiple ? [] : null);

  const noOptionsText = React.useMemo(() => {
    if (noOptionsAction) {
      return <MenuItem onClick={() => noOptionsAction.onClick(inputValue)} value="">
        <AddCircleIcon color="success" />
        <em style={{ marginLeft: 8 }}>{noOptionsAction.label}</em>
      </MenuItem>
    }
    return undefined;
  }, [noOptionsAction, inputValue]);

  return (
    <QueryStatusWrapper renderIfLoading={autoComplete} queryResult={queryResult} loadingMessage={loadingMessage} errorMessage={errorMessage}>
      <FormControl {...rest}>
        {autoComplete ? (
          <Autocomplete
            multiple={multiple}
            onChange={handleAutocompleteChange}
            options={displayOptions}
            noOptionsText={noOptionsText}
            getOptionLabel={getOptionLabel}
            getOptionKey={getOptionKey}
            value={autocompleteValue}
            forcePopupIcon
            isOptionEqualToValue={isOptionEqualToValue}
            inputValue={inputValue}
            onInputChange={(event, newInputValue, reason) => {
              if (reason === 'reset') return;
              setInputValue(newInputValue);
            }}
            {...autocompleteProps}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
                {...inputProps}
              />
            )}
          />
        ) : (
          <>
            <InputLabel id={`select-${label.replaceAll(' ', '-')}`}>{label}</InputLabel>
            <Select
              multiple={multiple}
              onChange={(event) => {
                const keys = event.target.value;
                const keyList = multiple ? (Array.isArray(keys) ? keys : [keys]) : [keys];
                const nextValue = multiple
                  ? keyList.map((k) => options.find((o) => getOptionKey(o) === k)).filter(Boolean)
                  : options.find((o) => getOptionKey(o) === keys) ?? null;
                if (!isControlled) setInternalValue(nextValue);
                onChange?.(nextValue);
              }}
              value={
                multiple
                  ? (effectiveValue || []).map((o) => getOptionKey(o))
                  : effectiveValue ? getOptionKey(effectiveValue) : ''
              }
              label={label}
              error={options.length === 0}
              inputProps={inputProps}
            >
              {options.map((option) => (
                <MenuItem key={getOptionKey(option)} value={getOptionKey(option)}>
                  {getOptionLabel(option)}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>{options.length === 0 ? autocompleteProps?.noOptionsText : ''}</FormHelperText>
          </>
        )}
      </FormControl>
    </QueryStatusWrapper>
  );
}
