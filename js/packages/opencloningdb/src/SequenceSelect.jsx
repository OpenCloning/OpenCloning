import React from 'react';
import { QuerySelect, useDebouncedSearchQuery } from '@opencloning/ui';
import { formatSequenceName, openCloningDBHttpClient } from './common';
import endpoints from './endpoints';

const messages = {
  loadingMessage: 'retrieving sequences',
  errorMessage: 'Could not retrieve sequences from OpenCloningDB',
};


const getGetQuery = (sequenceTypes) => {
  return (query) => ({
    queryKey: ['sequences', { sequence_types: sequenceTypes, query }],
    queryFn: async () => {
      const results = await Promise.all([
        openCloningDBHttpClient.get(endpoints.sequences, {
          params: { sequence_types: sequenceTypes, uid: query },
        }),
        openCloningDBHttpClient.get(endpoints.sequences, {
          params: { sequence_types: sequenceTypes, name: query },
        }),
      ]);
      return [...results[0].data.items, ...results[1].data.items];
    },
  })};

function SequenceSelect({ value, onChange, label, multiple = true, sequenceTypes = undefined, ...rest }) {
  const { query, autocompleteProps, clearInput } = useDebouncedSearchQuery(getGetQuery(sequenceTypes), {minChars: 1});

  return (
    <QuerySelect
      query={query}
      label={label}
      loadingMessage={messages.loadingMessage}
      errorMessage={messages.errorMessage}
      multiple={multiple}
      getOptionLabel={formatSequenceName}
      getOptionKey={(seq) => seq.id}
      value={value}
      onChange={onChange}
      autoComplete={true}
      autocompleteProps={autocompleteProps}
      onClear={clearInput}
      {...rest}
    />
  );
}

export default SequenceSelect;
