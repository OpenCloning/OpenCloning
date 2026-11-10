import React from 'react'
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { TextFieldQueryValidated } from '@opencloning/ui';

const getLineUIDExistsErrorQuery = (value, excludeUid) => ({
  queryKey: ['lines', { uid: value, excludeUid: excludeUid ?? '' }],
  queryFn: async () => {
    const { data } = await openCloningDBHttpClient.get(endpoints.lines, {
      params: { uid: value },
    });
    if (data.items.find((item) => item.uid === value && item.uid !== excludeUid)) {
      return 'Line UID already exists';
    }
    return '';
  },
});

function NewLineUID({
  onChange,
  onValidationStateChange,
  label = 'New Line UID',
  placeholder = 'Enter a new line UID',
  excludeUid = null,
  ...rest
}) {
  const getQuery = React.useCallback((value) => getLineUIDExistsErrorQuery(value, excludeUid), [excludeUid]);
  return (
    <TextFieldQueryValidated
      label={label}
      placeholder={placeholder}
      onChange={onChange}
      onValidationStateChange={onValidationStateChange}
      getQuery={getQuery}
      {...rest}
    />
  )
}

export default NewLineUID
