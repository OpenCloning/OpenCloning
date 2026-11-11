import { FormControl, TextField } from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';
import ELabFTWCategorySelect from './ELabFTWCategorySelect';

function SubmitToDatabaseComponent({ id, setSubmissionData, resourceType }) {
  const name = useSelector((state) => {
    if (resourceType === 'primer') {
      return state.cloning.primers.find((p) => p.id === id).name;
    }
    return state.cloning.teselaJsonCache[id].name;
  });
  const [title, setTitle] = React.useState(name);
  const [category, setCategory] = React.useState(null);

  React.useEffect(() => {
    setTitle(name);
  }, [name]);

  React.useEffect(() => {
    if (category && title) {
      // We do this not overwrite primerCategoryId, set from a different component
      setSubmissionData((prev) => ({ ...prev, categoryId: category.id, title }));
    } else {
      setSubmissionData(null);
    }
  }, [category, title]);

  return (
    <>
      <FormControl fullWidth sx={{ mb: 2 }}>
        <TextField
          autoFocus
          required
          id="resource_title"
          label="Resource title"
          variant="standard"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormControl>
      <ELabFTWCategorySelect
        mode="template"
        fullWidth
        label={`Save ${resourceType} as`}
        setCategory={setCategory}
      />
    </>
  );
}
export default SubmitToDatabaseComponent;
