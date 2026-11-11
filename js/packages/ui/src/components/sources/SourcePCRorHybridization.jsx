import React from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { Button, Checkbox, FormControl, FormControlLabel, InputAdornment, TextField } from '@mui/material';

import { doesSourceHaveOutput, getInputSequencesFromSourceId, getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import PCRUnitForm from './PCRUnitForm';
import PrimerDesignSourceForm from '../primers/primer_design/SourceComponents/PrimerDesignSourceForm';
import { cloningActions } from '@opencloning/store/cloning';
import useStoreEditor from '../../hooks/useStoreEditor';
import LabelWithTooltip from '../form/LabelWithTooltip';

function SourcePCRorHybridization({ source, requestStatus, sendSourceRequest }) {
  // Represents a PCR if inputs != [], else is a oligo hybridization

  const dispatch = useDispatch();
  const { updateStoreEditor } = useStoreEditor();
  const { setCurrentTab, setMainSequenceId } = cloningActions;
  const { id: sourceId } = source;

  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, sourceId), shallowEqual);
  const primers = useSelector((state) => state.cloning.primers);
  const isPcr = inputSequences.length !== 0;
  const hasOutput = useSelector((state) => doesSourceHaveOutput(state.cloning, sourceId));
  const outputIsPrimerDesign = useSelector((state) => isPcr && hasOutput && state.cloning.sequences.find((e) => e.id === source.id).primer_design !== undefined);

  const [forwardPrimerId, setForwardPrimerId] = React.useState('');
  const [reversePrimerId, setReversePrimerId] = React.useState('');
  const [designingPrimers, setDesigningPrimers] = React.useState(false);
  const [addPrimerFeatures, setAddPrimerFeatures] = React.useState(false);

  const minimalAnnealingRef = React.useRef(null);
  const allowedMismatchesRef = React.useRef(null);

  React.useEffect(() => {
    if (isPcr && source.input.length === 3) {
      setForwardPrimerId(source.input[0].sequence);
      setReversePrimerId(source.input[2].sequence);
    } else if (!isPcr && source.input.length === 2) {
      setForwardPrimerId(source.input[0].sequence);
      setReversePrimerId(source.input[1].sequence);
    }
  }, [source.input]);

  React.useEffect(() => {
    if (source.add_primer_annotations) { setAddPrimerFeatures(source.add_primer_annotations); }
  }, [source.add_primer_annotations]);

  const onSubmit = (event) => {
    event.preventDefault();

    const requestData = {
      sequences: inputSequences,
      primers: [forwardPrimerId, reversePrimerId].map((id) => primers.find((p) => p.id === id)),
      source: { id: sourceId, input: inputSequences.map((e) => ({ sequence: e.id })), output_name: source.output_name },
    };

    if (!isPcr) {
      requestData.source.input = [forwardPrimerId, reversePrimerId].map((id) => ({ sequence: id }));
      const config = { params: { minimal_annealing: minimalAnnealingRef.current.value } };
      sendSourceRequest({ endpoint: 'oligonucleotide_hybridization', requestData, config, source });
    } else {
      const config = { params: {
        minimal_annealing: minimalAnnealingRef.current.value,
        allowed_mismatches: allowedMismatchesRef.current.value,
      } };
      requestData.source.add_primer_features = addPrimerFeatures;
      sendSourceRequest({ endpoint: 'pcr', requestData, config, source });
    }
  };

  const onPrimerDesign = () => {
    setDesigningPrimers(true);
  };

  if (outputIsPrimerDesign && !forwardPrimerId && !reversePrimerId) {
    const goToPrimerDesign = () => {
      dispatch(setCurrentTab(3));
      const templateSequenceId = getPcrTemplateSequenceId(source);
      dispatch(setMainSequenceId(templateSequenceId));
      updateStoreEditor('mainEditor', templateSequenceId);
      // Scroll to the top of the tab panels container
      document.querySelector('.tab-panels-container')?.scrollTo({
        top: 0,
        behavior: 'instant',
      });
    };
    return (
      <Button variant="contained" color="success" sx={{ mt: 1 }} onClick={goToPrimerDesign}>
        <span style={{ fontSize: '1.2em', marginRight: 12 }}>✨</span>
        {' '}
        Design primers
        {' '}
        <span style={{ fontSize: '1.2em', marginLeft: 12 }}>✨</span>
      </Button>
    );
  }

  if (designingPrimers && !hasOutput) {
    return <PrimerDesignSourceForm source={source} />;
  }

  return (
    <div className="pcr_or_hybridization">
      <form onSubmit={onSubmit}>
        {isPcr && !hasOutput && !forwardPrimerId && !reversePrimerId && (
          <Button variant="contained" color="success" sx={{ my: 2 }} onClick={onPrimerDesign}>Design primers</Button>
        )}
        <PCRUnitForm
          sourceId={sourceId}
          primers={primers}
          forwardPrimerId={forwardPrimerId}
          reversePrimerId={reversePrimerId}
          onChangeForward={setForwardPrimerId}
          onChangeReverse={setReversePrimerId}
        />
        <FormControl fullWidth>
          <TextField
            label="Minimal annealing length"
            inputRef={minimalAnnealingRef}
            type="number"
            defaultValue={12}
            InputProps={{
              endAdornment: <InputAdornment position="end">bp</InputAdornment>,
              sx: { '& input': { textAlign: 'center' } },
            }}
          />
        </FormControl>
        {isPcr && (
          <>
            <FormControl fullWidth>
              <TextField
                label="Mismatches allowed"
                inputRef={allowedMismatchesRef}
                type="number"
                defaultValue={0}
                InputProps={{
                  sx: { '& input': { textAlign: 'center' } },
                }}
              />
            </FormControl>
            <FormControl fullWidth>
              <FormControlLabel
                control={<Checkbox checked={addPrimerFeatures} onChange={() => setAddPrimerFeatures(!addPrimerFeatures)} />}
                label={(
                  <LabelWithTooltip label="Add primer features" tooltip="Add features representing the primers to the PCR product" />
            )}
              />
            </FormControl>
          </>
        )}
        {forwardPrimerId && reversePrimerId && (
          <SubmitButtonBackendAPI
            requestStatus={requestStatus}
            {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": !isPcr ? "submit-hybridization" : "submit-pcr" })}
          >
            {!isPcr ? 'Perform hybridization' : 'Perform PCR'}
          </SubmitButtonBackendAPI>
        )}
      </form>
    </div>
  );
}

export default SourcePCRorHybridization;
