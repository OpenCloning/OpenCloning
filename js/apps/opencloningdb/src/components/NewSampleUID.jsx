import React from 'react';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { TextFieldQueryValidated } from '@opencloning/ui';

const getSampleUIDExistsErrorQuery = (value) => ({
  queryKey: ['sequence_sample', value],
  queryFn: async () => {
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
  ...rest
}) {
  return (
    <TextFieldQueryValidated
      label={label}
      placeholder={placeholder}
      onChange={onChange}
      onValidationStateChange={onValidationStateChange}
      getQuery={getSampleUIDExistsErrorQuery}
      {...rest}
    />
  );
}

export default NewSampleUID;
