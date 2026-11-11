import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { FormHelperText, InputLabel, MenuItem, Select } from '@mui/material';
import { isEqual } from 'lodash-es';
import { getIdsOfSequencesWithoutChildSource } from '@opencloning/store/cloning_utils';

function SingleInputSelector({ selectedId, onChange, label, inputSequenceIds, allowUnset = false, helperText = '', disabled = false }) {
  const idsWithoutChild = useSelector(({ cloning }) => getIdsOfSequencesWithoutChildSource(cloning.sources, cloning.sequences), shallowEqual);
  const options = [...new Set([...idsWithoutChild, ...inputSequenceIds])];
  const sequenceNames = useSelector(({ cloning }) => options.map((id) => ({ id, name: cloning.teselaJsonCache[id]?.name || 'template' })), isEqual);
  const renderedOptions = options.sort((a, b) => (a - b)).map((id) => (
    <MenuItem key={id} value={id}>
      {`${id} - ${sequenceNames.find(({ id: id2 }) => id2 === id).name}`}
    </MenuItem>
  ));
  if (allowUnset) {
    renderedOptions.unshift(<MenuItem key="unset" value=""><em>None</em></MenuItem>);
  }
  return (
    <>
      <InputLabel id="select-single-inputs">{label}</InputLabel>
      <Select
        value={selectedId !== null ? selectedId : ''}
        onChange={onChange}
        labelId="select-single-inputs"
        label={label}
        disabled={disabled}
      >
        {renderedOptions}
      </Select>
      <FormHelperText>{helperText}</FormHelperText>
    </>
  );
}

export default SingleInputSelector;
