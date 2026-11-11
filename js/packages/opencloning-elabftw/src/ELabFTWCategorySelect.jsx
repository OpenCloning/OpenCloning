import React from 'react';
import GetRequestMultiSelect from '@opencloning/ui/components/form/GetRequestMultiSelect';
import RequestStatusWrapper from '@opencloning/ui/components/form/RequestStatusWrapper';
import { eLabFTWHttpClient, getELabFTWVersion, readHeaders } from './common';

function ELabFTWCategorySelect({ setCategory, mode, label = 'Resource category', ...rest }) {
  const [eLabFTWVersion, setELabFTWVersion] = React.useState(null);
  const [requestStatus, setRequestStatus] = React.useState({ status: 'loading' });
  const [retry, setRetry] = React.useState(0);
  React.useEffect(() => {
    setRequestStatus({ status: 'loading' });
    getELabFTWVersion().then(
      (version) => {
        setELabFTWVersion(version);
        setRequestStatus({ status: 'success' });
      }
    ).catch(() => setRequestStatus({ status: 'error', message: 'Could not retrieve eLabFTW version' }));
  }, [retry]);
  let url;
  if (mode === 'resource_type') {
    url = '/api/v2/teams/current/resources_categories';
  } else if (mode === 'template') {
    url = '/api/v2/items_types';
  } else {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const getOptionsFromResponse = (data) => data;
  const messages = { loadingMessage: 'retrieving categories', errorMessage: 'Could not retrieve categories from eLab' };
  const onChange = (value) => setCategory(value);

  return (
    <RequestStatusWrapper requestStatus={requestStatus} retry={() => { setRetry(retry + 1); }}>
      <GetRequestMultiSelect
        getOptionsFromResponse={getOptionsFromResponse}
        httpClient={eLabFTWHttpClient}
        requestHeaders={readHeaders}
        url={url}
        label={label}
        messages={messages}
        onChange={onChange}
        getOptionLabel={(option) => (option === '' ? '' : option.title)}
        multiple={false}
        {...rest}
      />
    </RequestStatusWrapper>
  );
}

export default ELabFTWCategorySelect;
