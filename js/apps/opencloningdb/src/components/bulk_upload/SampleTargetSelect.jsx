import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Autocomplete, Box, TextField } from '@mui/material';
import { AddCircle as AddCircleIcon } from '@mui/icons-material';
import { useDebouncedSearchQuery } from '@opencloning/ui';
import { sampleSearchQuery } from '../../utils/sample_queries';
import { sampleUidError } from '../../utils/sample_uid';

// A new sample cannot be created with an invalid UID
const optionError = (option) => (option.sample ? '' : sampleUidError(option.uid));

const sameTarget = (a, b) => a.uid.toLowerCase() === b.uid.toLowerCase() && Boolean(a.sample) === Boolean(b.sample);

/**
 * The sample a sequencing file goes to: an existing sample, searched by UID, or a new one with the typed UID
 * (with the sample name of the file, newUid, if nothing is typed). value and onChange use { uid, sample },
 * sample null for a new sample.
 */
export default function SampleTargetSelect({ value, onChange, newUid }) {
  const { query, autocompleteProps } = useDebouncedSearchQuery(sampleSearchQuery, { minChars: 1, debounceMs: 300 });
  const typed = autocompleteProps.inputValue.trim();
  // The typed text is the selected value (shown in the field), not a search
  const searching = Boolean(typed) && !(value && typed === value.uid);
  // Only search while the user types: otherwise every row would query the UID of its selected sample
  const { data: samples = [] } = useQuery({ ...query, enabled: query.enabled && searching });

  const options = React.useMemo(() => {
    const found = searching ? samples.map((sample) => ({ uid: sample.uid, sample })) : [];
    const uid = searching ? typed : newUid;
    const exists = found.some((option) => option.uid.toLowerCase() === uid.toLowerCase());
    return exists ? found : [...found, { uid, sample: null }];
  }, [samples, searching, typed, newUid]);

  return (
    <Autocomplete
      {...autocompleteProps}
      size="small"
      sx={{ minWidth: 240 }}
      options={options}
      value={value}
      onChange={(_event, option) => onChange(option)}
      getOptionLabel={(option) => option.uid}
      getOptionKey={(option) => `${option.sample ? 'existing' : 'new'}-${option.uid}`}
      isOptionEqualToValue={sameTarget}
      getOptionDisabled={(option) => Boolean(optionError(option))}
      renderOption={({ key, ...props }, option) => (
        <Box component="li" key={key} {...props}>
          {option.sample
            ? `${option.uid} · ${option.sample.sequence?.name ?? `Sequence ${option.sample.sequence_id}`}`
            : (
              <>
                <AddCircleIcon color="success" fontSize="small" sx={{ mr: 1 }} />
                Create sample &quot;{option.uid}&quot;
                {optionError(option) && ` (${optionError(option)})`}
              </>
            )}
        </Box>
      )}
      renderInput={(params) => <TextField {...params} placeholder="Search or create a sample" />}
      data-testid="bulk-link-sample-select"
    />
  );
}
