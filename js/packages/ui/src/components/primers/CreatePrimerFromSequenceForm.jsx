import React from 'react';
import { FormControl, TextField } from '@mui/material';
import './PrimerForm.css';
import './PrimerList.css';
import CustomFormHelperText from '../form/CustomFormHelperText';

function CreatePrimerFromSequenceForm({
  primer: { name, sequence }, setName, setSequence, existingPrimerNames,
}) {
  let nameError = '';
  if (existingPrimerNames.includes(name)) {
    nameError = 'Name exists';
  }
  if (name === '') {
    nameError = 'Name is required';
  }
  return (
    <div className="primer-result-form">
      <FormControl sx={{ m: 1, pb: 2, display: { width: '30%' } }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError !== ''}
          FormHelperTextProps={{ component: 'div' }}
          helperText={<CustomFormHelperText>{nameError}</CustomFormHelperText>}
        />
      </FormControl>
      <FormControl sx={{ m: 1, pb: 2, display: { width: '60%' } }}>
        <TextField
          label="Sequence"
          value={sequence}
          onChange={(e) => setSequence(e.target.value)}
          inputProps={{ id: 'sequence' }}
          FormHelperTextProps={{ component: 'div' }}
        />
      </FormControl>
    </div>
  );
}

export default CreatePrimerFromSequenceForm;
