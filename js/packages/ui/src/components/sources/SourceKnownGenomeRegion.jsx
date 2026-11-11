import React from 'react'
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import { geneSuggest } from '@opencloning/utils/ncbiRequests';
import { formatBackendPayloadWithGene } from './SourceGenomeRegion';
import { Box, CircularProgress } from '@mui/material';

function SourceKnownGenomeRegion({ source, requestStatus, sendSourceRequest }) {
  // A source where we pass a complete GenomeCoordinatesSource, so we just have to make the request
  const [error, setError] = React.useState('');
  const [connectAttempt, setConnectAttempt] = React.useState(0);
  React.useEffect(() => {
    async function makeRequest() {
      setError(false);
      if (source.locus_tag && source.assembly_accession) {
        let resp;
        try {
          resp = await geneSuggest(source.assembly_accession, source.locus_tag)
        } catch (e) {
          setError(true);
          return;
        }
        if (resp.length === 0) {
          setError(true);
          return;
        }
        const requestData = formatBackendPayloadWithGene(source.assembly_accession, resp[0], source.padding, source.padding);
        requestData.id = source.id;
        sendSourceRequest({ endpoint: 'genome_coordinates', requestData, source });
      }
      else {
        const requestData = {
          ...source,
          type: 'GenomeCoordinatesSource',
        };
        sendSourceRequest({ endpoint: 'genome_coordinates', requestData, source });
      }
    }
  makeRequest();
  }, [connectAttempt]);

  if (requestStatus.status === 'error' || error) {

    return (
      <div>
      <div style={{ marginBottom: '1em', marginTop: '2em' }}>Could not retrieve genome sequence.</div>
      <SubmitButtonBackendAPI requestStatus={requestStatus} onClick={() => setConnectAttempt(connectAttempt + 1)}>Retry</SubmitButtonBackendAPI>
      </div>
  )
  }
  return (
    <div style={{ marginBottom: '1em', marginTop: '2em', textAlign: 'center' }}>
      <div>Loading genome sequence...</div>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <CircularProgress />
      </Box>
    </div>
  )
}

export default SourceKnownGenomeRegion;
