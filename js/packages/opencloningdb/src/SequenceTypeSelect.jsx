import React from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { ChipMultiSelect } from '@opencloning/ui';
import { SEQUENCE_TYPE_LABELS } from './sequenceTypes';

const ALL_SEQUENCE_TYPES = Object.keys(SEQUENCE_TYPE_LABELS);

/**
 * Select of sequence types (e.g. 'plasmid'), shown with their labels.
 *
 * - multiple=false: value is a type and onChange receives a type.
 * - multiple=true: value is an array of types and onChange receives an array of types.
 *   placeholder is shown when nothing is selected (e.g. 'All types' when used as a filter).
 *
 * types restricts the options (all types by default). labelId sets the id of the label,
 * which the options list references with aria-labelledby (single select only).
 */
function SequenceTypeSelect({
  value, onChange, multiple = false, types = ALL_SEQUENCE_TYPES, label = 'Type', labelId, placeholder,
  disabled, size = 'small', sx,
}) {
  const generatedId = React.useId();
  const id = labelId ?? `sequence-type-select-${generatedId}`;
  const options = React.useMemo(
    () => types.map((type) => ({ id: type, label: SEQUENCE_TYPE_LABELS[type] ?? type })),
    [types],
  );

  if (multiple) {
    return (
      <ChipMultiSelect
        label={label}
        options={options}
        value={value ?? []}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        size={size}
        sx={sx}
      />
    );
  }

  return (
    <FormControl size={size} sx={sx} disabled={disabled}>
      <InputLabel id={id}>{label}</InputLabel>
      <Select labelId={id} label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {options.map((option) => (
          <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export default SequenceTypeSelect;
