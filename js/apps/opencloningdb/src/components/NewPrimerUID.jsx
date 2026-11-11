import React from 'react';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { TextFieldQueryValidated } from '@opencloning/ui';

const getPrimerUIDExistsErrorQuery = (value, excludeUid) => ({
  queryKey: ['primers', { uid: value, excludeUid: excludeUid ?? '' }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.primers, {
      params: { uid: value },
    });
    if (data.items.find((item) => item.uid === value && item.uid !== excludeUid)) {
      return 'UID already exists';
    }
    return '';
  },
});

function NewPrimerUID({
  onChange,
  onValidationStateChange,
  label = 'New Primer UID',
  placeholder = 'Enter a new primer UID',
  excludeUid = null,
  ...rest
}) {
  const getQuery = React.useCallback((value) => getPrimerUIDExistsErrorQuery(value, excludeUid), [excludeUid]);
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

export default NewPrimerUID;
