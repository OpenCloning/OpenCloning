import React from 'react';
import GetRequestMultiSelect from '@opencloning/ui/components/form/GetRequestMultiSelect';
import { eLabFTWHttpClient, readHeaders } from './common';
import { encodePathSegment } from '@opencloning/utils/urlUtils';

function ELabFTWFileSelect({ itemId, setFileInfo, ...rest }) {
  const url = `/api/v2/items/${encodePathSegment(itemId)}`;
  const getOptionsFromResponse = ({ uploads }) => uploads;
  const label = 'File with sequence';
  const messages = { loadingMessage: 'retrieving attachments', errorMessage: 'Could not retrieve attachment from eLab' };
  const onChange = (realName, options) => setFileInfo(options.find((option) => option.real_name === realName));

  return (
    <GetRequestMultiSelect
      getOptionsFromResponse={getOptionsFromResponse}
      httpClient={eLabFTWHttpClient}
      requestHeaders={readHeaders}
      url={url}
      label={label}
      messages={messages}
      onChange={onChange}
      getOptionLabel={(option) => (option === '' ? '' : option.real_name)}
      multiple={false}
      autoComplete={false}
      {...rest}
    />
  );
}

export default ELabFTWFileSelect;
