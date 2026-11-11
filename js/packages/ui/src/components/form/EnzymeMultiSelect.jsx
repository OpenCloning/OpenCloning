import * as React from 'react';
import GetRequestMultiSelect from './GetRequestMultiSelect';
import useBackendHttpClient from '../../hooks/useBackendHttpClient';

function EnzymeMultiSelect({ setEnzymes, label = 'Enzymes used', multiple = true }) {
  const url = 'restriction_enzyme_list';
  const getOptionsFromResponse = React.useCallback((data) => data.enzyme_names, []);
  const messages = React.useMemo(() => ({
    loadingMessage: 'retrieving enzymes...',
    errorMessage: 'Could not retrieve enzymes from server',
  }), []);
  const onChange = React.useCallback((value) => setEnzymes(value), [setEnzymes]);
  const httpClient = useBackendHttpClient();

  return (

    <GetRequestMultiSelect
      fullWidth
      className="enzyme-multi-select"
      getOptionsFromResponse={getOptionsFromResponse}
      url={url}
      label={label}
      httpClient={httpClient}
      messages={messages}
      onChange={onChange}
      multiple={multiple}
      getOptionLabel={(option) => option}
    />
  );
}

export default React.memo(EnzymeMultiSelect);
