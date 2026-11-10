import { Alert, Box, FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import React from 'react';
import { isEqual } from 'lodash-es';
import { parseFeatureLocation } from '@teselagen/bio-parsers';
import { useDispatch, useSelector } from 'react-redux';
import useGatewaySites from '../../../../hooks/useGatewaySites';
import useStoreEditor from '../../../../hooks/useStoreEditor';
import { cloningActions } from '@opencloning/store/cloning';
import { usePrimerDesign } from './PrimerDesignContext';
import RequestStatusWrapper from '../../../form/RequestStatusWrapper';
import knownGatewayCombinations from './utils/knownGatewayCombinations';

const { setMainSequenceSelection } = cloningActions;

function SiteSelect({ donorSites, site, setSite, label }) {
  return (
    <FormControl sx={{ minWidth: '10em' }}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={site ? `${site.siteName}-${site.location}` : ''}
        onChange={(e) => setSite(
          donorSites.find(({ siteName, location }) => `${siteName}-${location}` === e.target.value),
        )}
        label={label}
      >
        {donorSites.map(({ siteName, location }) => (
          <MenuItem key={`${siteName}-${location}`} value={`${siteName}-${location}`}>
            {siteName}
            {' '}
            {location}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function GatewayRoiSelect({ id, greedy = false }) {
  const [leftSite, setLeftSite] = React.useState(null);
  const [rightSite, setRightSite] = React.useState(null);
  const [donorSites, setDonorSites] = React.useState([]);
  const { requestStatus, attemptAgain, sites } = useGatewaySites({ target: id, greedy });
  const { updateStoreEditor } = useStoreEditor();
  const donorVectorSequenceLength = useSelector((state) => state.cloning.teselaJsonCache[id].sequence.length);
  const dispatch = useDispatch();
  const { primerDesignSettings, setSpacers } = usePrimerDesign();
  const [gatewaySelection, setGatewaySelection] = React.useState(null);
  const editorSelection = useSelector((state) => state.cloning.mainSequenceSelection, isEqual);

  const { knownCombination, setKnownCombination } = primerDesignSettings;

  const handleKnownCombinationChange = (newKnownCombination, selection) => {
    setGatewaySelection(selection);
    if (newKnownCombination) {
      setKnownCombination(newKnownCombination);
      setSpacers(newKnownCombination.spacers);
    } else {
      setKnownCombination(null);
      setSpacers(['', '']);
    }
  };
  React.useEffect(() => {
    if (requestStatus.status === 'success') {
      setDonorSites(sites.filter(({ siteName }) => siteName.startsWith('attP')));
    }
  }, [sites]);

  React.useEffect(() => {
    if (gatewaySelection && !isEqual(editorSelection, gatewaySelection)) {
      updateStoreEditor('mainEditor', null, gatewaySelection.selectionLayer);
      dispatch(setMainSequenceSelection(gatewaySelection));
    }
  }, [editorSelection, gatewaySelection]);

  const checkKnownCombination = React.useCallback((newLeftSite, newRightSite) => {
    if (newLeftSite && newRightSite) {
      const leftSiteLocation = parseFeatureLocation(newLeftSite.location, 0, 0, 0, 1, donorVectorSequenceLength)[0];
      const rightSiteLocation = parseFeatureLocation(newRightSite.location, 0, 0, 0, 1, donorVectorSequenceLength)[0];
      const selectionLayer = { start: leftSiteLocation.start, end: rightSiteLocation.end };
      const selection = { selectionLayer, caretPosition: -1 };
      const siteNames = [newLeftSite.siteName, newRightSite.siteName];
      const orientation = [newLeftSite.location.includes('(+)'), newRightSite.location.includes('(+)')];
      const knownCombinationForward = knownGatewayCombinations.find(({ siteNames: knownSites, orientation: knownOrientation }) => isEqual(knownSites, siteNames) && isEqual(knownOrientation, orientation));
      if (knownCombinationForward) {
        handleKnownCombinationChange(knownCombinationForward, selection);
        return;
      }
      const siteNamesReverse = [newRightSite.siteName, newLeftSite.siteName];
      const orientationReverse = [!newRightSite.location.includes('(+)'), !newLeftSite.location.includes('(+)')];
      const knownCombinationReverse = knownGatewayCombinations.find(({ siteNames: knownSites, orientation: knownOrientation }) => isEqual(knownSites, siteNamesReverse) && isEqual(knownOrientation, orientationReverse));
      if (knownCombinationReverse) {
        handleKnownCombinationChange(knownCombinationReverse, selection);
        return;
      }
      handleKnownCombinationChange(null, selection);
    }
  }, []);

  const onSiteSelectLeft = React.useCallback((site) => {
    setLeftSite(site);
    if (rightSite === null || isEqual(rightSite, site)) {
      const differentSite = donorSites.find(({ location }) => location !== site.location);
      setRightSite(differentSite);
      checkKnownCombination(site, differentSite);
      return;
    }
    checkKnownCombination(site, rightSite);
  }, [rightSite, donorSites]);

  const onSiteSelectRight = React.useCallback((site) => {
    setRightSite(site);
    if (leftSite === null || isEqual(leftSite, site)) {
      const differentSite = donorSites.find(({ location }) => location !== site.location);
      setLeftSite(differentSite);
      checkKnownCombination(differentSite, site);
      return;
    }

    checkKnownCombination(leftSite, site);
  }, [leftSite, donorSites]);
  return (
    <RequestStatusWrapper requestStatus={requestStatus} retry={attemptAgain}>
      {donorSites.length < 2 && (<Alert severity="error">The sequence must have at least two AttP sites</Alert>)}
      {donorSites.length >= 2 && (
        <>
          <Box sx={{ my: 2, '& > div': { mx: 1 } }}>
            <SiteSelect donorSites={donorSites} site={leftSite} setSite={onSiteSelectLeft} label="Left attP site" />
            <SiteSelect donorSites={donorSites} site={rightSite} setSite={onSiteSelectRight} label="Right attP site" />
          </Box>
          {knownCombination && (<Alert sx={{ width: '80%', margin: 'auto', mb: 2 }} severity="info">{knownCombination.message}</Alert>)}
          {knownCombination === null && (leftSite && rightSite) && (<Alert sx={{ width: '80%', margin: 'auto', mb: 2 }} severity="error">No recommended primer tails found</Alert>)}
        </>
      )}
    </RequestStatusWrapper>
  );
}

export default GatewayRoiSelect;
