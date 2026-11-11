import { Alert, FormControl, TextField } from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';
import { Edit as EditIcon } from '@mui/icons-material';

function SubmitToDatabaseComponent({ id, setSubmissionData, resourceType }) {
  const name = useSelector((state) => {
    if (resourceType === 'primer') {
      return state.cloning.primers.find((p) => p.id === id).name;
    }
    return state.cloning.teselaJsonCache[id].name;
  });

  React.useEffect(() => {
    if (name) {
      setSubmissionData((prev) => ({ ...prev, title: name }));
    } else {
      setSubmissionData(null);
    }
  }, [name, setSubmissionData]);

  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>
        <span style={{ display: 'flex', alignItems: 'center' }}>
          {`To change the ${resourceType} name, go back and click on the icon`}
          <EditIcon sx={{ verticalAlign: 'middle', ml: 0.5, fontSize: '1.5rem' }} />
        </span>

      </Alert>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <TextField
          id="resource_title"
          label="Name"
          variant="standard"
          value={name}
          disabled
        />
      </FormControl>
    </>
  );
}

export default SubmitToDatabaseComponent;
