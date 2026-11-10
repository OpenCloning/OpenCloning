import React from 'react'
import useServerStaticFiles from '../../hooks/useServerStaticFiles';
import RequestStatusWrapper from './RequestStatusWrapper';
import { Alert, Autocomplete, Button, FormControl, TextField } from '@mui/material';

function ServerStaticFileSelect({ onFileSelected, multiple = false, type = 'sequence' }) {
  const [selectedCategory, setSelectedCategory] = React.useState('');
  const [selectedOptions, setSelectedOptions] = React.useState(multiple ? [] : null);
  const [error, setError] = React.useState(null);

  const localFiles = useServerStaticFiles();
  const{ index, indexRequestStatus, indexRetry, requestFile } = localFiles;

  const options = React.useMemo(() => {
    if (index === null) return [];
    if (type !== 'sequence') {
      return index.syntaxes;
    }
    const sequencesIdAdded = index.sequences.map((sequence, index) => ({...sequence, id: index}));
    const prePendArray = multiple ? ['__all__'] : [];
    if (selectedCategory === '') {
      return [...prePendArray, ...sequencesIdAdded];
    }

    return [...prePendArray, ...sequencesIdAdded.filter((sequence) => sequence.categories?.includes(selectedCategory))];
  }, [type, index, selectedCategory, multiple]);

  const categoryOptions = React.useMemo(() => {
    if (!index?.categories) return [];
    return ['All', ...index.categories];
  }, [index]);

  const optionToFile = React.useCallback(async (option) => {
    if (!option.path) {
      throw new Error('Malformatted option, must have a path');
    }
    let fileContent = null;
    try {
      fileContent = await requestFile(option.path);
    } catch (error) {
      throw new Error(`Error requesting file: ${error.message}`);
    }
    if (typeof fileContent !== 'string') {
      fileContent = JSON.stringify(fileContent);
    }
    const file = new File([fileContent], option.path, { type: 'text/plain' });
    return file;
  }, [requestFile]);

  const onSubmit = React.useCallback(async (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!multiple) {
        const file = await optionToFile(selectedOptions);
        onFileSelected(file);
      } else {
        const files = await Promise.all(selectedOptions.map((option) => optionToFile(option)));
        onFileSelected(files);
      }
    } catch (error) {
      setError(error.message);
    }
  }, [multiple, selectedOptions, onFileSelected, optionToFile]);

  const onCategoryChange = React.useCallback((event, newValue) => {
    setSelectedOptions(multiple ? [] : null);
    if (!newValue || newValue === 'All') {
      setSelectedCategory('');
    } else {
      setSelectedCategory(newValue);
    }
  }, [multiple]);

  const buttonDisabled = multiple ? selectedOptions.length === 0 : !selectedOptions;

  const label = type === 'sequence' ? 'Sequence' : 'Syntax';

  const onOptionsChange = React.useCallback((event, value) => {
    if (multiple && type === 'sequence') {
      if (value.includes('__all__')) {
        const allSequences = options.filter((option) => option !== '__all__');
        setSelectedOptions(allSequences);
        return;
      }
    }
    setSelectedOptions(value);
  }, [multiple, type, options]);

  return (
    <RequestStatusWrapper requestStatus={indexRequestStatus} retry={indexRetry}>
      {error && <Alert severity="error">{error}</Alert>}
      <form onSubmit={onSubmit}>
        {type === 'sequence' && (
          <FormControl fullWidth sx={{ my: 1 }}>
            <Autocomplete
              id="category-select"
              options={categoryOptions}
              value={selectedCategory === '' ? 'All' : selectedCategory}
              onChange={onCategoryChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Category"
                />
              )}
            />
          </FormControl>
        )}
        <FormControl fullWidth sx={{ my: 1 }}>
          <Autocomplete
            id="option-select"
            multiple={multiple}
            options={options}
            value={selectedOptions}
            onChange={onOptionsChange}
            getOptionKey={(option) => option.id || option}
            getOptionLabel={(option) => (option === '__all__' ? 'Select all' : option?.name || option?.path || '')}
            disableCloseOnSelect={multiple}
            renderInput={(params) => (
              <TextField
                {...params}
                label={label}
              />
            )}
          />
        </FormControl>
        <FormControl fullWidth>
          <Button disabled={buttonDisabled} type="submit" variant="contained" color="primary">Submit</Button>
        </FormControl>
      </form>
    </RequestStatusWrapper>
  );
}

export default ServerStaticFileSelect
