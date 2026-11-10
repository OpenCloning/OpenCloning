import React from 'react';
import ChipMultiSelect from './ChipMultiSelect';
import { VALID_SEQUENCE_TYPES, SEQUENCE_TYPE_LABELS } from '../utils/query_utils';

const SEQUENCE_TYPE_OPTIONS = VALID_SEQUENCE_TYPES.map((type) => ({ id: type, label: SEQUENCE_TYPE_LABELS[type] }));

function SequenceTypeMultiSelect({ value, onChange, label = 'Type', ...rest }) {
  return (
    <ChipMultiSelect
      label={label}
      options={SEQUENCE_TYPE_OPTIONS}
      value={value ?? []}
      onChange={onChange}
      {...rest}
    />
  );
}

export default SequenceTypeMultiSelect;
