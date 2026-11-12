import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

/**
 * Multi-select that shows the selected options as chips.
 * options is an array of { id, label }, value and onChange use arrays of ids.
 * placeholder is shown when nothing is selected, id is set on the input.
 */
function ChipMultiSelect({ label, options, value, onChange, loading, disabled, sx, size = 'small', placeholder, id }) {
  const optionById = React.useMemo(
    () => new Map(options.map((opt) => [opt.id, opt])),
    [options],
  );

  const selectedOptions = React.useMemo(
    () => value.map((optionId) => optionById.get(optionId)).filter(Boolean),
    [value, optionById],
  );

  return (
    <Autocomplete
      multiple
      size={size}
      options={options}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, selected) => option.id === selected.id}
      value={selectedOptions}
      onChange={(_, newValue) => {
        const ids = newValue.map((opt) => opt.id);
        onChange(ids);
      }}
      renderTags={(tagValue, getTagProps) =>
        tagValue.map((option, index) => (
          <Chip
            {...getTagProps({ index })}
            key={option.id}
            label={option.label}
            size="small"
          />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          id={id ?? params.id}
          label={label}
          variant="outlined"
          placeholder={selectedOptions.length === 0 ? placeholder : undefined}
          // Keep the label above the input, so that it does not cover the placeholder
          InputLabelProps={placeholder ? { ...params.InputLabelProps, shrink: true } : params.InputLabelProps}
        />
      )}
      loading={loading}
      disabled={disabled}
      sx={sx}
    />
  );
}

export default ChipMultiSelect;
