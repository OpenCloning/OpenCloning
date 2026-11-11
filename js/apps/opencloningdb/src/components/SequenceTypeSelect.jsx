import React from 'react';
import { Box, Tooltip } from '@mui/material';
import { SequenceTypeSelect as BaseSequenceTypeSelect } from '@opencloning/opencloningdb';
import { CIRCULAR_SEQUENCE_TYPES, LINEAR_SEQUENCE_TYPES, TEMPLATE_SEQUENCE_TYPES } from '../utils/query_utils';

/** Type select for editing / creating a sequence, which only offers the types valid for the sequence. */
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
      {/* Wrapper, so that the tooltip also works when the select is disabled */}
      <Box sx={{ display: 'inline-flex' }}>
        <BaseSequenceTypeSelect
          labelId="sequence-type-label"
          value={value}
          onChange={onChange}
          types={Object.keys(options)}
          disabled={changeTypeDisabled}
          sx={{ minWidth: 200 }}
        />
      </Box>
    </Tooltip>
  );
}

export default SequenceTypeSelect;
