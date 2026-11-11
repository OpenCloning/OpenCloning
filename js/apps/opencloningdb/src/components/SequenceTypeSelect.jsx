import React from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import { CIRCULAR_SEQUENCE_TYPES, LINEAR_SEQUENCE_TYPES, TEMPLATE_SEQUENCE_TYPES } from '../utils/query_utils';

function SequenceTypeSelect({ value, onChange, isCircular, changeTypeDisabled, isTemplateSequence }) {
  const tooltipText = isCircular ? 'Circular sequences can only be plasmids' : 'Cannot change type of sequence present in a line';
  let options = LINEAR_SEQUENCE_TYPES;
  if (isCircular) {
    options = CIRCULAR_SEQUENCE_TYPES;
  }
  if (isTemplateSequence) {
    options = TEMPLATE_SEQUENCE_TYPES;
  }
  return (
    <Tooltip
      title={tooltipText}
      disableHoverListener={!changeTypeDisabled}
    >
      <FormControl size="small" sx={{ minWidth: 200 }}>
        <InputLabel id="sequence-type-label">Type</InputLabel>
        <Select
          labelId="sequence-type-label"
          label="Type"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={changeTypeDisabled}
        >
          {Object.keys(options).map((t) => (
            <MenuItem key={t} value={t}>{options[t]}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Tooltip>
  );
}

export default SequenceTypeSelect;
