import React from 'react';
import { InputLabel, MenuItem, TextField, FormControl, Select, Alert, Box, FormHelperText, FormLabel } from '@mui/material';
import PostRequestSelect from '../form/PostRequestSelect';
import { getReferenceAssemblyId, taxonSuggest, geneSuggest, getInfoFromAssemblyId, getInfoFromSequenceAccession } from '@opencloning/utils/ncbiRequests';
import TextFieldValidate from '../form/TextFieldValidate';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import GetRequestMultiSelect from '../form/GetRequestMultiSelect';
import { formatSequenceLocationString } from '@opencloning/utils/other';
import { getExternalHttpClient } from '@opencloning/utils/httpClients';

// External urls (not the backend): no auth token, only whitelisted urls
const httpClient = getExternalHttpClient();

function getGeneCoordsInfo(gene) {
  const { range: geneRange, accession_version: accessionVersion } = gene.annotation.genomic_regions[0].gene_range;
  const { begin: start, end, orientation } = geneRange[0];
  const strand = orientation === 'plus' ? 1 : -1;
  return { accessionVersion, start: Number(start), end: Number(end), strand };
}

function formatGeneCoords(gene) {
  const { accessionVersion, start, end, strand } = getGeneCoordsInfo(gene);
  return `${accessionVersion} (${start}..${end}${strand === -1 ? ', complement' : ''})`;
}


export function formatBackendPayloadWithGene(assemblyId, gene, shiftUpstream, shiftDownstream) {
  const { accessionVersion, start, end, strand } = getGeneCoordsInfo(gene);
  const shiftedStart = start - (strand === 1 ? shiftUpstream : shiftDownstream);
  const shiftedEnd = end + (strand === 1 ? shiftDownstream : shiftUpstream);

  return {
    repository_id: accessionVersion,
    assembly_accession: assemblyId,
    locus_tag: gene.annotation.locus_tag ? gene.annotation.locus_tag : null,
    gene_id: gene.annotation.gene_id ? gene.annotation.gene_id : null,
    coordinates: formatSequenceLocationString(shiftedStart, shiftedEnd, strand),
  };
}

function SpeciesPicker({ setSpecies, setAssemblyId }) {
  const speciesPostRequestSettings = React.useMemo(() => ({
    setValue: (v) => {
      if (v === null) {
        setSpecies(null);
        setAssemblyId('');
        return;
      }
      getReferenceAssemblyId(v.tax_id).then((response) => {
        // Set the species
        setSpecies(v);
        // Set the assemblyId
        setAssemblyId(response === null ? '' : response);
      });
    },
    getOptions: taxonSuggest,
    getOptionLabel: (option) => (option ? `${option.sci_name} - ${option.tax_id}` : ''),
    isOptionEqualToValue: (option, value) => option.tax_id === value.tax_id,
    textLabel: 'Species / taxon ID',
  }), []);
  return (<PostRequestSelect {...speciesPostRequestSettings} fullWidth />);
}

function SequenceAccessionPicker({ assemblyAccession, setSequenceAccession }) {

  const url = `https://api.ncbi.nlm.nih.gov/datasets/v2alpha/genome/accession/${assemblyAccession}/sequence_reports`
  return (
    <FormControl fullWidth>
      <GetRequestMultiSelect
        getOptionsFromResponse={(data) => data.reports}
        httpClient={httpClient}
        url={url}
        label="Chromosome"
        messages={{ loadingMessage: 'Loading chromosomes...', errorMessage: 'Could not load chromosomes' }}
        onChange={(value, options) => { setSequenceAccession(options.find((o) => `${o.chr_name} - ${o.refseq_accession}` === value).refseq_accession)}}
        getOptionLabel={({ chr_name, refseq_accession }) => `${chr_name} - ${refseq_accession}`}
        multiple={false}
        autoComplete={false}
      />
    </FormControl>
  );
}

// Extra component to be used in SourceGenomeRegion
function SourceGenomeRegionLocusOnReference({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId } = source;
  const [gene, setGene] = React.useState(null);
  const [species, setSpecies] = React.useState(null);
  const [assemblyId, setAssemblyId] = React.useState('');
  const upstreamBasesRef = React.useRef(null);
  const downstreamBasesRef = React.useRef(null);

  const onSubmit = (event) => {
    event.preventDefault();
    const requestData = formatBackendPayloadWithGene(assemblyId, gene, Number(upstreamBasesRef.current.value), Number(downstreamBasesRef.current.value));
    requestData.id = sourceId;
    sendSourceRequest({ endpoint: 'genome_coordinates', requestData, source });
  };

  // Reset gene when species changes
  React.useEffect(() => {
    setGene(null);
  }, [species]);

  return (
    <form onSubmit={onSubmit}>
      <SpeciesPicker {...{ setSpecies, setAssemblyId }} />
      {assemblyId && (
        <>
          <KnownAssemblyField assemblyId={assemblyId} />
          <SourceGenomeRegionSelectGene {...{ gene, upstreamBasesRef, downstreamBasesRef, setGene, assemblyId }} />
          {gene && (
            <SubmitButtonBackendAPI
              requestStatus={requestStatus}
              {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-genome-region-locus-reference" })}
            >Submit</SubmitButtonBackendAPI>
          )}
        </>
      )}
      { (species && assemblyId === '') && (
        <Alert sx={{ alignItems: 'center' }} severity="error">
          The selected species does not have a reference assembly.
        </Alert>
      )}
    </form>
  );
}

function KnownSpeciesField({ species }) {
  return (
    <FormControl fullWidth>
      <TextField
        label="Species"
        value={`${species.organism_name} - ${species.tax_id}`}
        disabled
      />
    </FormControl>
  );
}

function KnownAssemblyField({ assemblyId }) {
  return (
    <FormControl fullWidth>
      <TextField
        label="Assembly ID"
        value={assemblyId}
        disabled
      />
    </FormControl>
  );
}

function AssemblyIdSelector({ setAssemblyId, setHasAnnotation = () => {}, onAssemblyIdChange = () => {} }) {
  const [exactMatch, setExactMatch] = React.useState(false);
  const [newerAssembly, setNewerAssembly] = React.useState(false);
  const [species, setSpecies] = React.useState(null);
  const [pairedAccessionWithAnnotation, setPairedAccessionWithAnnotation] = React.useState('');
  const [pairedAccessionLookupFailed, setPairedAccessionLookupFailed] = React.useState(false);

  const onChange = async (userInput, resp) => {
    setPairedAccessionWithAnnotation('');
    setPairedAccessionLookupFailed(false);
    setSpecies(resp === null ? null : resp.species);
    if (resp === null) {
      setAssemblyId('');
      setExactMatch(true);
    } else if (resp.exactMatch) {
      setAssemblyId(userInput);
      setExactMatch(true);
    } else {
      setAssemblyId(resp.newerAssembly);
      setExactMatch(false);
    }

    setHasAnnotation(resp !== null && resp.hasAnnotation);
    setNewerAssembly(resp !== null && resp.newerAssembly);
    onAssemblyIdChange();
    if (resp !== null && !resp.hasAnnotation && resp.pairedAccession) {
      try {
        const pairedAccessionInfo = await getInfoFromAssemblyId(resp.pairedAccession);
        if (pairedAccessionInfo !== null && pairedAccessionInfo.hasAnnotation) {
          setPairedAccessionWithAnnotation(resp.pairedAccession);
        }
      } catch (e) {
        console.error(e);
        setPairedAccessionLookupFailed(true);
      }
    }
  };

  return (
    <>
      <TextFieldValidate onChange={onChange} getterFunction={getInfoFromAssemblyId} label="Assembly ID" defaultHelperText="Example ID: GCA_000002945.3" />
      {newerAssembly && (
        <Alert severity="warning">
          {!exactMatch ? 'Using assembly ID' : 'Newer assembly exists:'}
          {' '}
          <a href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${newerAssembly}`} target="_blank" rel="noopener noreferrer">{newerAssembly}</a>
        </Alert>
      )}
      {pairedAccessionWithAnnotation && (
        <Alert severity="warning">
          Equivalent assembly <a href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${pairedAccessionWithAnnotation}`} target="_blank" rel="noopener noreferrer">{pairedAccessionWithAnnotation}</a> has annotation.
        </Alert>
      )}
      {pairedAccessionLookupFailed && (
        <Alert severity="warning">
          Could not check whether an equivalent assembly has annotation: Try deleting and retyping the assembly ID.
        </Alert>
      )}
      {species && <KnownSpeciesField species={species} />}
    </>
  );
}

// Extra component to be used in SourceGenomeRegion
function SourceGenomeRegionLocusOnOther({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId } = source;
  const [gene, setGene] = React.useState(null);
  const [assemblyId, setAssemblyId] = React.useState('');
  const [hasAnnotation, setHasAnnotation] = React.useState(false);
  const upstreamBasesRef = React.useRef(null);
  const downstreamBasesRef = React.useRef(null);

  const onSubmit = (event) => {
    event.preventDefault();
    const requestData = formatBackendPayloadWithGene(assemblyId, gene, Number(upstreamBasesRef.current.value), Number(downstreamBasesRef.current.value));
    requestData.id = sourceId;
    sendSourceRequest({ endpoint: 'genome_coordinates', requestData, source });
  };

  return (
    <form onSubmit={onSubmit}>
      <AssemblyIdSelector {...{ setAssemblyId, setHasAnnotation, onAssemblyIdChange: () => setGene(null) }} />
      {assemblyId && hasAnnotation && (
        <>
          <SourceGenomeRegionSelectGene {...{ gene, upstreamBasesRef, downstreamBasesRef, setGene, assemblyId }} />
          {gene && (
            <SubmitButtonBackendAPI
              requestStatus={requestStatus}
              {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-genome-region-locus-other" })}
            >Submit</SubmitButtonBackendAPI>
          )}
        </>
      )}
      {assemblyId && !hasAnnotation && (<Alert severity="error">The selected assembly has no gene annotations</Alert>)}
    </form>
  );
}

// Extra component to be used in SourceGenomeRegion
function SourceGenomeRegionCustomCoordinates({ source, requestStatus, sendSourceRequest, selectionMode }) {
  // https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=nuccore&db=assembly&id=CM041205.1&idtype=acc
  const { id: sourceId } = source;
  const [species, setSpecies] = React.useState(null);
  const [sequenceAccession, setSequenceAccession] = React.useState('');
  const [assemblyId, setAssemblyId] = React.useState('');
  const noError = { start: null, end: null, strand: null };
  const [formError, setFormError] = React.useState({ ...noError });
  // I don't manage to use refs for the Select component
  const [coords, setCoords] = React.useState({ start: '', end: '', strand: '' });

  React.useEffect(() => {
    // Clear the form when the selection mode changes
    setSpecies(null);
    setSequenceAccession('');
    setAssemblyId('');
    setCoords({ start: '', end: '', strand: '' });
  }, [selectionMode]);

  const onSubmit = (event) => {
    event.preventDefault();
    if (coords.start === '') {
      setFormError({ ...noError, start: 'Field required' });
      return;
    }
    if (coords.end === '') {
      setFormError({ ...noError, end: 'Field required' });
      return;
    }
    if (coords.strand === '') {
      setFormError({ ...noError, strand: 'Field required' });
      return;
    }
    // Start must be greater than zero
    if (Number(coords.start) < 1) {
      setFormError({ ...noError, start: 'Start must be greater than zero' });
      return;
    }
    if (Number(coords.start) >= Number(coords.end)) {
      setFormError({ ...noError, end: 'End must be greater than start' });
      return;
    }

    setFormError({ ...noError });
    const requestData = {
      id: sourceId,
      repository_id: sequenceAccession,
      assembly_accession: assemblyId || null,
      coordinates: formatSequenceLocationString(coords.start, coords.end, coords.strand === 'plus' ? 1 : -1),
    };
    sendSourceRequest({ endpoint: 'genome_coordinates', requestData, source });
  };

  const onSequenceAccessionChange = async (userInput, resp) => {
    setFormError({ ...noError });
    setCoords({ start: '', end: '', strand: '' });
    if (resp === null) {
      setSpecies(null);
      setSequenceAccession('');
      return;
    }
    setSpecies(resp.species || null);
    setSequenceAccession(resp.sequenceAccessionStandard);
  };

  return (
    <form onSubmit={onSubmit}>
      {(selectionMode === 'custom_sequence_accession') && (
        (
          <>
            <TextFieldValidate onChange={onSequenceAccessionChange} getterFunction={getInfoFromSequenceAccession} label="Sequence accession" defaultHelperText="Example ID: NC_003424.3" />
            {species && <KnownSpeciesField species={species} />}
          </>
        )
      )}
      {(selectionMode === 'custom_reference') && (
        <>
          {assemblyId && <KnownAssemblyField assemblyId={assemblyId} />}
          <SpeciesPicker {...{ setSpecies, setAssemblyId }} />
        </>
      )}
      {(selectionMode === 'custom_other') && (
        <AssemblyIdSelector {...{ setAssemblyId, onAssemblyIdChange: () => { setFormError({ ...noError }); setSequenceAccession(''); } }} />
      )}
      {assemblyId && ['custom_reference', 'custom_other'].includes(selectionMode) && (
        <SequenceAccessionPicker {...{ assemblyAccession: assemblyId, setSequenceAccession }} />
      )}
      {sequenceAccession && (
        <>
          <Box component="fieldset" sx={{ p: 1, mb: 1 }} style={{ borderRadius: '.5em', boxShadow: null }}>
            <legend><FormLabel>Sequence coordinates</FormLabel></legend>
            <FormControl fullWidth>
              <TextField
                fullWidth
                label="Start"
                value={coords.start}
                onChange={(event) => setCoords((prev) => ({ ...prev, start: event.target.value }))}
                type="number"
                error={formError.start !== null}
                helperText={formError.start}
              />
            </FormControl>
            <FormControl fullWidth>
              <TextField
                fullWidth
                label="End"
                value={coords.end}
                onChange={(event) => setCoords((prev) => ({ ...prev, end: event.target.value }))}
                type="number"
                error={formError.end !== null}
                helperText={formError.end}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel error={formError.strand !== null} id={`selection-mode-${sourceId}-strand-label`}>Strand</InputLabel>
              <Select
                labelId={`selection-mode-${sourceId}-strand-label`}
                label="Strand"
                value={coords.strand}
                onChange={(event) => setCoords((prev) => ({ ...prev, strand: event.target.value }))}
                error={formError.strand !== null}
              >
                <MenuItem value="plus">plus</MenuItem>
                <MenuItem value="minus">minus</MenuItem>
              </Select>
              <FormHelperText error={formError.strand !== null}>{formError.strand}</FormHelperText>
            </FormControl>
          </Box>
          <SubmitButtonBackendAPI
            requestStatus={requestStatus}
            {...(import.meta.env.VITE_UMAMI_WEBSITE_ID && { "data-umami-event": "submit-genome-region-custom-coordinates" })}
          >Submit</SubmitButtonBackendAPI>
        </>
      )}
    </form>
  );
}

function SourceGenomeRegionSelectGene({ gene, upstreamBasesRef, downstreamBasesRef, setGene, assemblyId }) {
  const [error, setError] = React.useState('');
  const genePostRequestSettings = React.useMemo(() => ({
    setValue: setGene,
    getOptions: async (userInput) => {
      try {
        // We await the response to catch the error
        setError('');
        return await geneSuggest(assemblyId, userInput);
      } catch (e) {
        // Connection error
        if (e.code === 'ERR_NETWORK' || e.response === undefined) {
          setError('Connection error');
          return [];
        }
        // Bad request
        if (e.response?.status >= 400 && e.response?.status < 500) {
          setError(e.response.data.message);
          return [];
        }
        // Server error
        if (e.response?.status >= 500) {
          setError('NCBI server error');
          return [];
        }
        // Here we are assuming that the assemblyId has been validated
        setError('The assembly has no gene annotations');
        return [];
      }
    },
    getOptionLabel: ({ annotation }) => (annotation ? `${annotation.symbol} ${annotation.locus_tag === undefined ? '' : annotation.locus_tag} ${annotation.name}` : ''),
    isOptionEqualToValue: (option, value) => option.locus_tag === value.locus_tag,
    textLabel: 'Gene',
    disableFiltering: true,
  }), [setGene, assemblyId]);

  return (
    <>
      <PostRequestSelect {...genePostRequestSettings} fullWidth />
      {error && (<Alert severity="error">{error}</Alert>)}
      {gene && (
        <>
          <FormControl fullWidth>
            <TextField
              label="Gene coordinates"
              value={formatGeneCoords(gene)}
              disabled
            />
          </FormControl>
          <FormControl fullWidth>
            <TextField
              fullWidth
              label="Upstream bases"
              inputRef={upstreamBasesRef}
              type="number"
              defaultValue={1000}
            />
          </FormControl>
          <FormControl fullWidth>
            <TextField
              fullWidth
              label="Downstream bases"
              inputRef={downstreamBasesRef}
              type="number"
              defaultValue={1000}
            />
          </FormControl>
        </>
      )}
    </>
  );
}

function SourceGenomeRegion({ source, requestStatus, sendSourceRequest }) {
  const { id: sourceId } = source;
  const [selectionMode, setSelectionMode] = React.useState('');
  const changeSelectionMode = (event) => { setSelectionMode(event.target.value); };

  return (
    <>
      <form>
        <FormControl fullWidth>
          <InputLabel id={`selection-mode-${sourceId}-label`}>Type of region</InputLabel>
          <Select
            value={selectionMode}
            onChange={changeSelectionMode}
            labelId={`selection-mode-${sourceId}-label`}
            label="Type of region"
          >
            <MenuItem value="reference_genome">Locus in reference genome</MenuItem>
            <MenuItem value="other_assembly">Locus in other assembly</MenuItem>
            <MenuItem value="custom_reference">Custom coordinates in reference genome</MenuItem>
            <MenuItem value="custom_other">Custom coordinates in other assembly</MenuItem>
            <MenuItem value="custom_sequence_accession">Custom coordinates in sequence accession</MenuItem>
          </Select>
        </FormControl>
      </form>
      {selectionMode === 'reference_genome' && (<SourceGenomeRegionLocusOnReference {...{ source, requestStatus, sendSourceRequest }} />)}
      {selectionMode === 'other_assembly' && (<SourceGenomeRegionLocusOnOther {...{ source, requestStatus, sendSourceRequest }} />)}
      {selectionMode.startsWith('custom') && (<SourceGenomeRegionCustomCoordinates {...{ source, requestStatus, sendSourceRequest, selectionMode }} />)}

    </>
  );
}

export { SourceGenomeRegion, AssemblyIdSelector, SpeciesPicker, SequenceAccessionPicker };
