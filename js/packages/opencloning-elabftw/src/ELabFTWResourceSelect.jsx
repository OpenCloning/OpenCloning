import React from 'react';
import PostRequestSelect from '@opencloning/ui/components/form/PostRequestSelect';
import { eLabFTWHttpClient, readHeaders } from './common';

function ELabFTWResourceSelect({ setResource, categoryId, ...rest }) {
  const url = '/api/v2/items';

  const resourcePostRequestSettings = React.useMemo(() => ({
    setValue: setResource,
    getOptions: async (userInput) => {
      const resp = await eLabFTWHttpClient.get(url, { headers: readHeaders, params: { cat: categoryId, extended: `title:${userInput}`, limit: 9999 } });
      return resp.data;
    },
    getOptionLabel: (option) => (option ? option.title : ''),
    isOptionEqualToValue: (option, value) => option?.id === value?.id,
    textLabel: 'Resource',
  }), [setResource, categoryId]);
  return (
    <PostRequestSelect {...resourcePostRequestSettings} {...rest} />
  );
}

export default ELabFTWResourceSelect;
