import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import { useDispatch } from 'react-redux';
import PrimerDesignHomologousRecombination from './PrimerDesignHomologousRecombination';
import PrimerDesignGibsonAssembly from './PrimerDesignGibsonAssembly';
import { cloningActions } from '@opencloning/store/cloning';
import PrimerDesignGatewayBP from './PrimerDesignGatewayBP';
import { getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';
import useNavigateAfterPrimerDesign from './useNavigateAfterPrimerDesign';

const { addPCRsAndSubsequentSourcesForAssembly } = cloningActions;

function PrimerDesignSourceForm({ source }) {
  const [primerDesignType, setPrimerDesignType] = React.useState('');
  const dispatch = useDispatch();
  const inputSequenceId = getPcrTemplateSequenceId(source);
  const navigateAfterDesign = useNavigateAfterPrimerDesign();

  React.useEffect(() => {
    if (primerDesignType === 'restriction_ligation' || primerDesignType === 'simple_pair') {
      const newSequence = {
        type: 'TemplateSequence',
        primer_design: primerDesignType,
        circular: false,
      };

      navigateAfterDesign(
        () => dispatch(addPCRsAndSubsequentSourcesForAssembly({ sourceId: source.id, newSequence, templateIds: [inputSequenceId], sourceType: null })),
        inputSequenceId,
      );
    }
  }, [primerDesignType]);

  return (
    <>
      <FormControl fullWidth>
        <InputLabel id="select-primer-design-type-label">Purpose of primers</InputLabel>
        <Select
          id="select-primer-design-type"
          value={primerDesignType}
          onChange={(event) => setPrimerDesignType(event.target.value)}
          label="Purpose of primers"
        >
          <MenuItem value="simple_pair">Normal PCR</MenuItem>
          <MenuItem value="homologous_recombination">Homologous Recombination</MenuItem>
          <MenuItem value="crispr">CRISPR</MenuItem>
          <MenuItem value="GibsonAssemblySource">Gibson Assembly</MenuItem>
          <MenuItem value="InFusionSource">In-Fusion</MenuItem>
          <MenuItem value="InVivoAssemblySource">In vivo Assembly</MenuItem>
          <MenuItem value="restriction_ligation">Restriction and Ligation</MenuItem>
          <MenuItem value="gateway_bp">Gateway BP reaction</MenuItem>
        </Select>
      </FormControl>
      {['homologous_recombination', 'crispr'].includes(primerDesignType)
      && (
        <PrimerDesignHomologousRecombination source={source} primerDesignType={primerDesignType} />
      )}
      {['GibsonAssemblySource', 'InFusionSource', 'InVivoAssemblySource'].includes(primerDesignType) && (
        <PrimerDesignGibsonAssembly source={source} assemblyType={primerDesignType} />
      )}
      {primerDesignType === 'gateway_bp' && (
        <PrimerDesignGatewayBP source={source} />
      )}
    </>
  );
}

export default PrimerDesignSourceForm;
