import React from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { Checkbox, FormControlLabel, InputLabel, MenuItem, Select, TextField, FormControl, InputAdornment } from '@mui/material';
import MultipleInputsSelector from './MultipleInputsSelector';
import { anyAssemblyInputIsLinear, getInputSequencesFromSourceId } from '@opencloning/store/cloning_utils';
import EnzymeMultiSelect from '../form/EnzymeMultiSelect';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import { classNameToEndPointMap } from '@opencloning/utils/sourceFunctions';
import { cloningActions } from '@opencloning/store/cloning';
import LabelWithTooltip from '../form/LabelWithTooltip';
import RecombinaseList from './RecombinaseList';

const helpSingleSite = 'Even if input sequences contain multiple att sites '
  + '(typically 2), a product could be generated where only one site recombines. '
  + 'Select this option to get those products.';

// A component representing the ligation or gibson assembly of several fragments
function SourceAssembly({ source, requestStatus, sendSourceRequest }) {
  const assemblyType = source.type;
  const { id: sourceId, input: sourceInput } = source;
  const inputSequences = useSelector((state) => getInputSequencesFromSourceId(state, sourceId), shallowEqual);
  const inputContainsTemplates = inputSequences.some((sequence) => sequence.type === 'TemplateSequence');
  const anyInputIsLinear = useSelector(
    (state) => anyAssemblyInputIsLinear(source, state.cloning.teselaJsonCache),
  );
  // It starts as undefined to avoid flashing the checkbox when the component mounts
  const [inputContainsGenome, setInputContainsGenome] = React.useState(undefined);
  const [minimalHomology, setMinimalHomology] = React.useState(20);
  const [allowPartialOverlap, setAllowPartialOverlap] = React.useState(false);
  const [circularOnly, setCircularOnly] = React.useState(false);
  const [bluntLigation, setBluntLigation] = React.useState(false);
  const [gatewaySettings, setGatewaySettings] = React.useState({ greedy: false, reactionType: null, onlyMultiSite: true });
  const [enzymes, setEnzymes] = React.useState([]);
  const [recombinases, setRecombinases] = React.useState([]);
  const [reverseRecombinase, setReverseRecombinase] = React.useState(false);

  const dispatch = useDispatch();

  React.useEffect(() => {
    if (assemblyType === 'GatewaySource') {
      setCircularOnly(true);
    }
  }, [assemblyType]);

  React.useEffect(() => {
    if (assemblyType === 'GatewaySource' && source.reaction_type) {
      setGatewaySettings({ ...gatewaySettings, reactionType: source.reaction_type });
    }
  }, [source]);

  React.useEffect(() => {
    if (inputSequences.length == 1) {
      setInputContainsGenome(false);
    } else {
      setInputContainsGenome(anyInputIsLinear);
    }
  }, [anyInputIsLinear, inputSequences.length]);
  const { updateSource } = cloningActions;

  const preventSubmit = (
    (assemblyType === 'RestrictionAndLigationSource' && enzymes.length === 0)
    || (assemblyType === 'GatewaySource' && gatewaySettings.reactionType === null)
    || (assemblyType === 'RecombinaseSource' && recombinases.length === 0)
    || inputContainsTemplates
  );

  const flipAllowPartialOverlap = () => {
    setAllowPartialOverlap(!allowPartialOverlap);
    if (!allowPartialOverlap) {
      setBluntLigation(false);
    }
  };

  const flipBluntLigation = () => {
    setBluntLigation(!bluntLigation);
    if (!bluntLigation) {
      setAllowPartialOverlap(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    const requestData = {
      source: { id: sourceId, input: inputSequences.map((e) => ({ sequence: e.id })), output_name: source.output_name },
      sequences: inputSequences,
    };
    if (['GibsonAssemblySource', 'OverlapExtensionPCRLigationSource', 'InFusionSource', 'InVivoAssemblySource'].includes(assemblyType)) {
      const config = { params: {
        minimal_homology: minimalHomology,
        circular_only: circularOnly,
      } };
      // To instantiate the correct class on the backend
      requestData.source.type = assemblyType;
      sendSourceRequest({ endpoint: 'gibson_assembly', requestData, config, source });
    } else if (assemblyType === 'RestrictionAndLigationSource') {
      if (enzymes.length === 0) { return; }
      requestData.source.restriction_enzymes = enzymes;
      const config = { params: {
        circular_only: circularOnly,
      } };
      sendSourceRequest({ endpoint: 'restriction_and_ligation', requestData, config, source });
    } else if (assemblyType === 'GatewaySource') {
      requestData.source.greedy = gatewaySettings.greedy;
      requestData.source.reaction_type = gatewaySettings.reactionType;
      const config = { params: { circular_only: circularOnly, only_multi_site: gatewaySettings.onlyMultiSite } };
      sendSourceRequest({ endpoint: 'gateway', requestData, config, source });
    } else if (assemblyType === 'CreLoxRecombinationSource') {
      sendSourceRequest({ endpoint: 'cre_lox_recombination', requestData, source });
    } else if (assemblyType === 'RecombinaseSource') {
      if (recombinases.length === 0) { return; }
      requestData.source.recombinases = recombinases;
      const config = { params: {
        reverse_recombinase: reverseRecombinase,
        input_contains_genome: inputContainsGenome,
      } };
      sendSourceRequest({ endpoint: 'recombinase', requestData, config, source });
    } else {
      const config = { params: {
        allow_partial_overlap: allowPartialOverlap,
        circular_only: circularOnly,
        blunt: bluntLigation,
      } };
      sendSourceRequest({ endpoint: classNameToEndPointMap[assemblyType], requestData, config, source });
    }
  };

  const onChangeInput = (newInputSequenceIds) => {
    const newInput = newInputSequenceIds.map((id) => ({ sequence: id }));
    // We prevent setting empty input
    if (newInput.length === 0) {
      return;
    }
    dispatch(updateSource({ id: sourceId, input: newInput, type: assemblyType }));
  };

  return (
    <div className="assembly">
      <form onSubmit={onSubmit}>
        <FormControl fullWidth>
          <MultipleInputsSelector {...{
            inputSequenceIds: sourceInput.map(({sequence}) => sequence), onChange: onChangeInput, label: 'Assembly inputs',
          }}
          />
        </FormControl>
        { ['GibsonAssemblySource', 'OverlapExtensionPCRLigationSource', 'InFusionSource', 'InVivoAssemblySource'].includes(assemblyType) && (
        // I don't really understand why fullWidth is required here
          <FormControl fullWidth>
            <TextField
              label="Minimal homology length"
              value={minimalHomology}
              onChange={(e) => { setMinimalHomology(e.target.value); }}
              type="number"
              defaultValue={20}
              InputProps={{
                endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                sx: { '& input': { textAlign: 'center' } },
              }}
            />
          </FormControl>
        )}
        { (assemblyType === 'RestrictionAndLigationSource') && (
          <EnzymeMultiSelect setEnzymes={setEnzymes} />
        )}
        { (assemblyType === 'RecombinaseSource') && (
          <>
            <RecombinaseList recombinases={recombinases} setRecombinases={setRecombinases} />
            <FormControl fullWidth style={{ textAlign: 'left' }}>
              <FormControlLabel
                control={<Checkbox checked={reverseRecombinase} onChange={() => setReverseRecombinase(!reverseRecombinase)} />}
                label={(
                  <LabelWithTooltip
                    label="Reverse reaction"
                    tooltip="Include the reverse reaction of each recombinase (e.g. excision in addition to integration)"
                  />
                )}
              />
            </FormControl>
            {(anyInputIsLinear && inputSequences.length > 1) && inputContainsGenome !== undefined && (
              <FormControl fullWidth style={{ textAlign: 'left' }}>
                <FormControlLabel
                  control={(
                    <Checkbox
                      data-testid="input-contains-genome-checkbox"
                      checked={inputContainsGenome}
                      onChange={() => setInputContainsGenome(prev => !prev)}
                    />
                  )}
                  label={(
                    <LabelWithTooltip
                      label="Input contains genome"
                      tooltip="Select this option if any of the linear input sequences is part of a genome. This will be used to simulate genome integration rather than treating it as a linear DNA sequence"
                    />
                  )}
                />
              </FormControl>
            )}
          </>
        )}
        { (assemblyType === 'GatewaySource') && (
          <>
            <FormControl fullWidth>
              <InputLabel id="gateway-reaction-type-label">Reaction type</InputLabel>
              <Select
                labelId="gateway-reaction-type-label"
                id="gateway-reaction-type"
                value={gatewaySettings.reactionType || ''}
                onChange={(e) => setGatewaySettings({ ...gatewaySettings, reactionType: e.target.value })}
                label="Reaction type"
              >
                <MenuItem value="BP">BP</MenuItem>
                <MenuItem value="LR">LR</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <FormControlLabel
                control={<Checkbox checked={gatewaySettings.greedy} onChange={() => setGatewaySettings({ ...gatewaySettings, greedy: !gatewaySettings.greedy })} />}
                label={(
                  <LabelWithTooltip label="Greedy attP finder" tooltip="Use a more greedy consensus site to find attP sites (might give false positives)" />
                )}
              />
            </FormControl>
            <FormControl fullWidth>
              <FormControlLabel
                control={<Checkbox checked={!gatewaySettings.onlyMultiSite} onChange={() => setGatewaySettings({ ...gatewaySettings, onlyMultiSite: !gatewaySettings.onlyMultiSite })} />}
                label={(
                  <LabelWithTooltip label="Single-site recombination" tooltip={helpSingleSite} />
                )}
              />
            </FormControl>
          </>
        )}
        { ['RestrictionAndLigationSource', 'GibsonAssemblySource', 'LigationSource', 'OverlapExtensionPCRLigationSource', 'GatewaySource', 'InFusionSource', 'InVivoAssemblySource'].includes(assemblyType) && (
          <FormControl fullWidth style={{ textAlign: 'left' }}>
            <FormControlLabel control={<Checkbox checked={circularOnly} onChange={() => setCircularOnly(!circularOnly)} />} label="Circular assemblies only" />
          </FormControl>
        )}
        { ['LigationSource'].includes(assemblyType) && (
          <FormControl fullWidth style={{ textAlign: 'left' }}>
            <FormControlLabel control={<Checkbox checked={allowPartialOverlap} onChange={flipAllowPartialOverlap} />} label="Allow partial overlaps" />
          </FormControl>
        )}
        { (assemblyType === 'LigationSource') && (
          <FormControl fullWidth style={{ textAlign: 'left' }}>
            <FormControlLabel control={<Checkbox checked={bluntLigation} onChange={flipBluntLigation} />} label="Blunt ligation" />
          </FormControl>
        )}

        {!preventSubmit && (
          <SubmitButtonBackendAPI
            requestStatus={requestStatus}
            {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": `submit-assembly-${assemblyType}` })}
          >Submit</SubmitButtonBackendAPI>
        )}
      </form>
    </div>
  );
}

export default SourceAssembly;
