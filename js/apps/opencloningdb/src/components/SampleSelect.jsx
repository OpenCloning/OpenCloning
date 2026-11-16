import React from 'react';
import { QuerySelect, useDebouncedSearchQuery } from '@opencloning/ui';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

const getSearchQuery = (filter) => (uid) => ({
  queryKey: ['sequence_samples', { uid }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSamples, { params: { uid } });
    return data.items;
  },
  select: (samples) => samples.filter(filter),
});

/** Pick one sample of the workspace by UID, among the samples for which filter(sample) is true. */
function SampleSelect({ value, onChange, label = 'Search UIDs', filter = () => true }) {
  const getQuery = React.useMemo(() => getSearchQuery(filter), [filter]);
  const { query, autocompleteProps, clearInput } = useDebouncedSearchQuery(getQuery);
  return (
    <QuerySelect
      query={query}
      label={label}
      multiple={false}
      getOptionLabel={(sample) => `${sample.uid} (${sample.sequence?.name ?? sample.sequence_id})`}
      getOptionKey={(sample) => sample.uid}
      value={value}
      onChange={onChange}
      autoComplete
      autocompleteProps={autocompleteProps}
      onClear={clearInput}
    />
  );
}

export default SampleSelect;
