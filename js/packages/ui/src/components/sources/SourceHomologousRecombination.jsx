import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FormControl, InputAdornment, TextField } from '@mui/material';
import { isEqual } from 'lodash-es';
import SingleInputSelector from './SingleInputSelector';
import { cloningActions } from '@opencloning/store/cloning';
import { getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import SelectPrimerForm from '../primers/SelectPrimerForm';

// A component representing the ligation of several fragments
function SourceHomologousRecombination({ source, requestStatus, sendSourceRequest }) {
  const isCrispr = source.type === 'CRISPRSource';
  const { id: sourceId, input } = source;
  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, sourceId), isEqual);
  const inputsAreNotTemplates = inputSequences.every((sequence) => sequence.type !== 'TemplateSequence');
  const [template, setTemplate] = React.useState(input.length > 0 ? input[0].sequence : null);
  const [insert, setInsert] = React.useState(input.length > 1 ? input[1].sequence : null);
  const [selectedPrimers, setSelectedPrimers] = React.useState([]);
  const { updateSource, setCurrentTab } = cloningActions;
  const dispatch = useDispatch();

  const primers = useSelector((state) => state.cloning.primers, isEqual);

  const allowSubmit = (template !== null && insert !== null) && (isCrispr ? selectedPrimers.length > 0 : true) && inputsAreNotTemplates;
  const minimalHomologyRef = React.useRef(null);
  const onSubmit = (event) => {
    event.preventDefault();
    const requestData = {
      source: { id: sourceId, input, output_name: source.output_name },
      sequences: inputSequences,
    };
    const config = { params: { minimal_homology: minimalHomologyRef.current.value } };
    if (isCrispr) {
      requestData.guides = selectedPrimers.map((primerId) => primers.find((p) => p.id === primerId));
      sendSourceRequest({ endpoint: 'crispr', requestData, config, source });
    } else {
      sendSourceRequest({ endpoint: 'homologous_recombination', requestData, config, source });
    }
  };

  const onTemplateChange = (event) => {
    setTemplate(Number(event.target.value));
    const newInput = [Number(event.target.value)];
    if (insert) {
      newInput.push(insert);
    }
    dispatch(updateSource({ id: sourceId, input: newInput.map((id) => ({ sequence: id })) }));
  };

  const onInsertChange = (event) => {
    if (event.target.value === '') {
      setInsert(null);
      dispatch(updateSource({ id: sourceId, input: [{ sequence: template }] }));
    } else {
      setInsert(Number(event.target.value));
      dispatch(updateSource({ id: sourceId, input: [{ sequence: template }, { sequence: Number(event.target.value) }] }));
    }
  };

  const goToPrimerTab = () => {
    dispatch(setCurrentTab(1));
  };

  return (
    <div className="homologous-recombination">
      <form onSubmit={onSubmit}>
        <FormControl fullWidth>
          <SingleInputSelector
            label="Template sequence"
            {...{ selectedId: template,
              onChange: onTemplateChange,
                inputSequenceIds: [...new Set(input.map(({sequence}) => sequence))].filter(
                (id) => id !== insert,
              ) }}
          />
        </FormControl>
        <FormControl fullWidth>
          <SingleInputSelector
            label="Insert sequence"
            allowUnset
            {...{ selectedId: insert,
              onChange: onInsertChange,
              inputSequenceIds: [...new Set(input.map(({sequence}) => sequence))].filter(
                (id) => id !== template,
              ) }}
          />
        </FormControl>
        <FormControl fullWidth>
          <TextField
            label="Minimal homology length"
            inputRef={minimalHomologyRef}
            type="number"
            defaultValue={40}
            InputProps={{
              endAdornment: <InputAdornment position="end">bp</InputAdornment>,
              sx: { '& input': { textAlign: 'center' } },
            }}
          />
        </FormControl>
        {isCrispr && (
          <SelectPrimerForm
            primers={primers}
            selected={selectedPrimers}
            onChange={setSelectedPrimers}
            label="Select gRNAs (from primers)"
            goToPrimerTab={goToPrimerTab}
            multiple
          />
        )}
        { allowSubmit && (
        <SubmitButtonBackendAPI
          requestStatus={requestStatus}
          color="primary"
          {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": isCrispr ? "submit-crispr" : "submit-homologous-recombination" })}
        >
          {isCrispr ? 'Perform CRISPR' : 'Recombine'}
        </SubmitButtonBackendAPI>
        )}
      </form>
    </div>
  );
}

export default SourceHomologousRecombination;
