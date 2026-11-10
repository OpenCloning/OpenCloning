import { Button, Checkbox, FormControl, FormControlLabel } from '@mui/material';
import React from 'react';
import { useDispatch } from 'react-redux';
import SingleInputSelector from '../../../sources/SingleInputSelector';
import { cloningActions } from '@opencloning/store/cloning';
import LabelWithTooltip from '../../../form/LabelWithTooltip';
import useGatewaySites from '../../../../hooks/useGatewaySites';
import NoAttPSitesError from '../common/NoAttPSitesError';
import RetryAlert from '../../../form/RetryAlert';
import { getPcrTemplateSequenceId } from '@opencloning/store/cloning_utils';
import useNavigateAfterPrimerDesign from './useNavigateAfterPrimerDesign';

const { addTemplateChildAndSubsequentSource } = cloningActions;

function PrimerDesignGatewayBP({ source }) {
  const [target, setTarget] = React.useState('');
  const [greedy, setGreedy] = React.useState(false);
  const dispatch = useDispatch();
  const inputSequenceId = getPcrTemplateSequenceId(source);
  const navigateAfterDesign = useNavigateAfterPrimerDesign();

  const { requestStatus, sites: sitesInTarget, attemptAgain } = useGatewaySites({ target, greedy });
  const nbOfAttPSites = sitesInTarget.filter((site) => site.siteName.startsWith('attP')).length;

  const onSubmit = (event) => {
    event.preventDefault();
    const newSource = {
      input: [{ sequence: Number(target) }],
      type: 'GatewaySource',
      reaction_type: 'BP',
      greedy,
    };
    const newSequence = {
      type: 'TemplateSequence',
      primer_design: 'gateway_bp',
      circular: false,
    };

    navigateAfterDesign(
      () => dispatch(addTemplateChildAndSubsequentSource({ newSource, newSequence, sourceId: source.id })),
      inputSequenceId,
    );
  };

  return (
    <form onSubmit={onSubmit}>
      <FormControl fullWidth>
        <SingleInputSelector
          label="Donor vector"
          selectedId={target}
          onChange={(e) => setTarget(e.target.value)}
          inputSequenceIds={[]}
          helperText={requestStatus.status === 'loading' ? 'Validating...' : ''}
        />
      </FormControl>
      <FormControl fullWidth>
        <FormControlLabel
          control={<Checkbox checked={greedy} onChange={() => setGreedy(!greedy)} />}
          label={(
            <LabelWithTooltip label="Greedy attP finder" tooltip="Use a more greedy consensus site to find attP sites (might give false positives)" />
                )}
        />
      </FormControl>

      {requestStatus.status === 'success' && target && nbOfAttPSites < 2 && (
        <NoAttPSitesError sites={sitesInTarget} />
      )}
      {requestStatus.status === 'error' && (
        <RetryAlert onRetry={attemptAgain}>
          {requestStatus.message}
        </RetryAlert>
      )}
      {target && requestStatus.status === 'success' && nbOfAttPSites > 1 && (
        <Button type="submit" variant="contained" color="success">
          Design primers
        </Button>
      )}
    </form>
  );
}

export default React.memo(PrimerDesignGatewayBP);
