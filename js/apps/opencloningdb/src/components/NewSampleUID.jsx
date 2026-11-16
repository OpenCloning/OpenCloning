import React from 'react';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { TextFieldQueryValidated } from '@opencloning/ui';

const getSampleUIDExistsErrorQuery = (value, excludeUid) => ({
  queryKey: ['sequence_sample', value, { excludeUid: excludeUid ?? '' }],
  queryFn: async () => {
    // Renaming a sample to its own uid (e.g. changing the case) is allowed
    if (excludeUid && value.toLowerCase() === excludeUid.toLowerCase()) {
      return '';
    }
    try {
      await openCloningDBHttpClient.get(endpoints.sequenceSample(value));
      return 'UID already exists';
    } catch (e) {
      if (e.response?.status === 404) {
        return '';
      }
      throw e;
    }
  },
});

function NewSampleUID({
  onChange,
  onValidationStateChange,
  label = 'New Sample UID',
  placeholder = 'Enter a new sample UID',
  excludeUid = null,
  ...rest
}) {
  const getQuery = React.useCallback((value) => getSampleUIDExistsErrorQuery(value, excludeUid), [excludeUid]);
  return (
    <TextFieldQueryValidated
      label={label}
      placeholder={placeholder}
      onChange={onChange}
      onValidationStateChange={onValidationStateChange}
      getQuery={getQuery}
      {...rest}
    />
  );
}

export default NewSampleUID;
