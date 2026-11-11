import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Button, CircularProgress, FormControl, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material';
import SequenceSelect from './SequenceSelect';
import TagMultiSelect from './TagMultiSelect';
import { formatSequenceName, openCloningDBHttpClient } from './common';
import endpoints from './endpoints';

/**
 * Load several sequences from OpenCloningDB, either all the sequences with any of the selected tags,
 * or the sequences picked by the user. Template sequences are not included (they have no content).
 *
 * onSequencesLoaded receives an array of { databaseId, name, seguid, textFileSequence }.
 */
function GetSequencesInBulkComponent({ onSequencesLoaded }) {
  const [mode, setMode] = React.useState('tags');
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [selectedSequences, setSelectedSequences] = React.useState([]);
  const [emptyResult, setEmptyResult] = React.useState(false);

  const { mutate, isPending, error, reset } = useMutation({
    mutationFn: async (params) => {
      const { data } = await openCloningDBHttpClient.get(endpoints.sequenceTextFiles, { params });
      return data.map(({ sequence_ref, sequence }) => ({
        databaseId: sequence_ref.id,
        name: formatSequenceName(sequence_ref),
        seguid: sequence_ref.seguid,
        textFileSequence: sequence,
      }));
    },
    onSuccess: (sequences) => {
      setEmptyResult(sequences.length === 0);
      if (sequences.length > 0) {
        onSequencesLoaded(sequences);
      }
    },
    retry: false,
  });

  const onModeChange = (event, newMode) => {
    if (newMode !== null) {
      setMode(newMode);
      setEmptyResult(false);
      reset();
    }
  };

  const selection = mode === 'tags' ? selectedTags : selectedSequences;
  const onLoad = () => {
    setEmptyResult(false);
    // selectedTags are ids, selectedSequences are sequence objects
    mutate(mode === 'tags' ? { tags: selectedTags } : { ids: selectedSequences.map((item) => item.id) });
  };

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <ToggleButtonGroup value={mode} exclusive onChange={onModeChange} size="small" color="primary">
        <ToggleButton value="tags">By tag</ToggleButton>
        <ToggleButton value="sequences">Pick sequences</ToggleButton>
      </ToggleButtonGroup>
      <FormControl fullWidth>
        {mode === 'tags'
          ? <TagMultiSelect label="Tags" value={selectedTags} onChange={setSelectedTags} allowCreate={false} />
          : <SequenceSelect label="Sequences" value={selectedSequences} onChange={setSelectedSequences} />}
      </FormControl>
      {error && <Alert severity="error">{error.response?.data?.detail || error.message || 'Could not load sequences from OpenCloningDB'}</Alert>}
      {emptyResult && <Alert severity="info">{mode === 'tags' ? 'No sequences found with the selected tags.' : 'The selected sequences have no content (template sequences cannot be loaded).'}</Alert>}
      {isPending
        ? <CircularProgress sx={{ alignSelf: 'center' }} />
        : <Button variant="contained" disabled={selection.length === 0} onClick={onLoad}>Load sequences</Button>}
    </Stack>
  );
}

export default GetSequencesInBulkComponent;
