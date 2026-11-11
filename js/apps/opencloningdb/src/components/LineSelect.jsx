import React from 'react';
import { QuerySelect, useDebouncedSearchQuery } from '@opencloning/ui';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

const messages = {
  loadingMessage: 'retrieving lines',
  errorMessage: 'Could not retrieve lines from OpenCloningDB',
};

function formatLineLabel({ id, uid }) {
  return uid ?? `Line ${id}`;
}

const getGetQuery = () => (query) => ({
  queryKey: ['lines', { uid: query }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.lines, {
      params: { uid: query, page: 1, size: 25 },
    });
    return data.items;
  },
});

function LineSelect({ value, onChange, label, multiple = true, disabled = false, ...rest }) {
  const { query, autocompleteProps, clearInput } = useDebouncedSearchQuery(getGetQuery(), { minChars: 1 });

  return (
    <QuerySelect
      query={query}
      label={label}
      loadingMessage={messages.loadingMessage}
      errorMessage={messages.errorMessage}
      multiple={multiple}
      getOptionLabel={formatLineLabel}
      getOptionKey={(line) => line.id}
      value={value}
      onChange={onChange}
      autoComplete={true}
      autocompleteProps={{
        ...autocompleteProps,
        disabled,
      }}
      inputProps={{ disabled }}
      onClear={clearInput}
      {...rest}
    />
  );
}

export default LineSelect;
