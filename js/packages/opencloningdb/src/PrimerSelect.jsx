import React from 'react';
import { QuerySelect, useDebouncedSearchQuery } from '@opencloning/ui';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';

const messages = { loadingMessage: 'retrieving primers', errorMessage: 'Could not retrieve primers from OpenCloningDB' };

const getGetQuery = (filterDatabaseIds) => {
  return (name) => ({
    queryKey: ['primers-search', name],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.primers, {
        params: { name },
      });
      return data.items.filter((primer) => !filterDatabaseIds.includes(primer.id));
    },
  });
};

function PrimerSelect({ setPrimer, filterDatabaseIds = [], ...rest }) {
  const { query, autocompleteProps, clearInput } = useDebouncedSearchQuery(getGetQuery(filterDatabaseIds));

  return (
    <QuerySelect
      query={query}
      label="Primer"
      loadingMessage={messages.loadingMessage}
      errorMessage={messages.errorMessage}
      onChange={setPrimer}
      getOptionLabel={(option) => (option === '' ? '' : option.name)}
      getOptionKey={(option) => option.id}
      multiple={false}
      autocompleteProps={autocompleteProps}
      onClear={clearInput}
      {...rest}
    />
  );
}

export default PrimerSelect;
