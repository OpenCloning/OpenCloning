import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';

function SourceReverseComplement({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId, input } = source;
  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, sourceId), shallowEqual);
  const onSubmit = (event) => {
    event.preventDefault();

    const requestData = {
      sequences: inputSequences,
      source: { id: sourceId, input },
    };
    sendSourceRequest({ endpoint: 'reverse_complement', requestData, source });
  };
    // No need for MultipleOutputsSelector, since there is only one output
  return (
    <div className="ReverseComplementSource">
      <form onSubmit={onSubmit}>
        <SubmitButtonBackendAPI
          requestStatus={requestStatus}
          {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-reverse-complement" })}
        >
          Reverse complement
        </SubmitButtonBackendAPI>
      </form>
    </div>
  );
}

export default SourceReverseComplement;
