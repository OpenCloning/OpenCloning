import React from 'react';
import { FormControl, TextField } from '@mui/material';
import '../../PrimerForm.css';
import '../../PrimerList.css';

function PrimerResultForm({
  primer: { name, sequence }, updatePrimerName, existingPrimerNames,
}) {
  let nameError = '';
  if (existingPrimerNames.includes(name)) {
    nameError = 'Name exists';
  }
  if (name === '') {
    nameError = 'Name is required';
  }
  return (
    <div className="primer-design-form">
      <FormControl sx={{ mx: 1, width: '30%', mb: 1 }}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => updatePrimerName(e.target.value)}
          error={nameError !== ''}
          helperText={nameError}
          slotProps={{
            formHelperText: { component: 'div' }
          }}
        />
      </FormControl>
      <FormControl sx={{ mx: 1, width: '60%' }}>
        <TextField
          label="Sequence"
          value={sequence}
          disabled
          // Add an empty helper text to maintain consistent height
          helperText=" "
          sx={{
            '& .MuiInputBase-root': {
              height: '56px', // Maintain the default height of TextField
            },
          }}
          slotProps={{
            htmlInput: {
              id: 'sequence',
              style: { fontSize: '0.8rem' }, // Reduce font size
            }
          }}
        />
      </FormControl>
    </div>
  );
}

export default PrimerResultForm;
