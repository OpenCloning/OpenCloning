import React from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';
import { getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';

function SourceAnnotation({ source, requestStatus, sendSourceRequest }) {
  const [annotationTool, setAnnotationTool] = React.useState('plannotate');

  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, source.id), isEqual);
  const onSubmit = (event) => {
    event.preventDefault();

    const requestData = {
      sequence: inputSequences[0],
      source: { id: source.id, input: inputSequences.map((e) => ({ sequence: e.id })), annotation_tool: annotationTool },
    };
    sendSourceRequest({ endpoint: 'annotate/plannotate', requestData, source });
  };

  return (
    <form onSubmit={onSubmit}>
      <FormControl fullWidth>
        <InputLabel id="annotation-tool-label">Annotation Tool</InputLabel>
        <Select
          labelId="annotation-tool-label"
          id="annotation-tool"
          value={annotationTool}
          label="Annotation Tool"
          onChange={(e) => setAnnotationTool(e.target.value)}
        >
          <MenuItem value="plannotate">pLannotate</MenuItem>
        </Select>
      </FormControl>
      <SubmitButtonBackendAPI
        requestStatus={requestStatus}
        {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-annotation" })}
      >Annotate</SubmitButtonBackendAPI>
    </form>
  );
}

export default React.memo(SourceAnnotation);
