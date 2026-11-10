import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';
import EnzymeMultiSelect from '../form/EnzymeMultiSelect';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';

// A component providing an interface for the user to perform a restriction reaction
// with one or more restriction enzymes, move between output fragments, and eventually
// select one as an output.
function SourceRestriction({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId } = source;
  const [enzymes, setEnzymes] = React.useState([]);
  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, sourceId), shallowEqual);

  const onSubmit = (e) => {
    e.preventDefault();
    if (enzymes.length === 0) { return; }
    const requestData = {
      source: { id: sourceId, input: source.input },
      sequences: inputSequences,
    };
    sendSourceRequest({ endpoint: 'restriction', requestData, source, config: { params: { restriction_enzymes: enzymes } } });
  };

  return (
    <div className="restriction">
      <form onSubmit={onSubmit}>
        <EnzymeMultiSelect setEnzymes={setEnzymes} />
        {(enzymes.length > 0) && (
          <SubmitButtonBackendAPI
            requestStatus={requestStatus}
            color="success"
            {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-restriction" })}
          >Perform restriction</SubmitButtonBackendAPI>
        )}
      </form>
    </div>
  );
}

export default SourceRestriction;
