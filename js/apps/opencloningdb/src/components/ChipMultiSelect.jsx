import React from 'react';
import { Autocomplete, Chip, TextField } from '@mui/material';

function ChipMultiSelect({ label, options, value, onChange, loading, disabled, sx }) {
  const optionById = React.useMemo(
    () => new Map(options.map((opt) => [opt.id, opt])),
    [options],
  );

  const selectedOptions = React.useMemo(
    () => value.map((id) => optionById.get(id)).filter(Boolean),
    [value, optionById],
  );

  return (
    <Autocomplete
      multiple
      size="small"
      options={options}
      getOptionLabel={(option) => option.label}
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
          label={label}
          variant="outlined"
        />
      )}
      loading={loading}
      disabled={disabled}
      sx={sx}
    />
  );
}

export default ChipMultiSelect;

