import React from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Divider, Typography } from '@mui/material';
import { isEqual } from 'lodash-es';
import { enzymesInRestrictionEnzymeDigestionSource } from '@opencloning/utils/sourceFunctions';
import PlannotateAnnotationReport from '../annotation/PlannotateAnnotationReport';
import useDatabase from '../../hooks/useDatabase';
import useLoadDatabaseFile from '../../hooks/useLoadDatabaseFile';
import { usePCRDetails } from '../primers/primer_details/usePCRDetails';
import PCRTable from '../primers/primer_details/PCRTable';
import RequestStatusWrapper from '../form/RequestStatusWrapper';
import repositoryMetadata from './repositoryMetadata';
import ExternalLink from '../common/ExternalLink';

function DatabaseMessage({ source }) {
  const [loadingHistory, setLoadingHistory] = React.useState(false);
  const database = useDatabase();
  const handleClose = React.useCallback(() => setLoadingHistory(false), [setLoadingHistory]);
  const [historyFileError, setHistoryFileError] = React.useState(null);
  const { loadDatabaseFile } = useLoadDatabaseFile({ source, setHistoryFileError });
  if (!database) {
    return <div>Imported from unknown database</div>;
  }
  const { LoadHistoryComponent } = database;
  return (
    <>
      <div>
        Imported from
        {' '}
        <ExternalLink href={database.getSequenceLink(source.database_id)}>{database.name}</ExternalLink>
      </div>
      {/* If the database interface has a LoadHistoryComponent, show a button to load the history */}
      {LoadHistoryComponent && (
        <>
          {!loadingHistory && (
            <div>
              <Button sx={{ marginTop: 2 }} variant="contained" color="primary" onClick={() => setLoadingHistory(true)}>
                Load history
              </Button>
            </div>
          )}
          {loadingHistory && (
            <>
              <div>
                <LoadHistoryComponent loadDatabaseFile={loadDatabaseFile} handleClose={handleClose} databaseId={source.database_id} />
              </div>
              {historyFileError && <Alert sx={{ marginTop: 2 }} severity="error">{historyFileError}</Alert>}
            </>
          )}

        </>
      )}
    </>
  );
}

function EuroscarfMessage({ source }) {
  const { repository_id: repositoryId } = source;
  return (
    <>
      Plasmid
      {' '}
      <strong>
        <ExternalLink href={`http://www.euroscarf.de/plasmid_details.php?accno=${repositoryId}`}>
          {repositoryId}
        </ExternalLink>
      </strong>
      {' '}
      from Euroscarf
    </>
  );
}

function WeKwikGeneMessage({ source }) {
  const { repository_id: repositoryId } = source;
  return (
    <>
      Plasmid
      {' '}
      <strong>
        <ExternalLink href={`https://wekwikgene.wllsb.edu.cn/plasmids/${repositoryId}`}>
          {repositoryId}
        </ExternalLink>
      </strong>
      {' '}
      from WeKwikGene
    </>
  );
}

function BenchlingMessage({ source }) {
  const { repository_id: repositoryId } = source;
  const editUrl = repositoryId.replace(/\.gb$/, '/edit');
  return (
    <>
      Request to Benchling (
      <strong>
        <ExternalLink href={editUrl}>
          link
        </ExternalLink>
      </strong>
      )
    </>
  );
}

function SnapGenePlasmidMessage({ source }) {
  const { repository_id: repositoryId } = source;
  const [plasmidSet, plasmidName] = repositoryId.split('/');
  return (
    <>
      Plasmid
      {' '}
      <strong>
        <ExternalLink href={`https://www.snapgene.com/plasmids/${plasmidSet}/${plasmidName}`}>
          {plasmidName}
        </ExternalLink>
      </strong>
      {' '}
      from SnapGene
    </>
  );
}

function OpenDNACollectionsMessage({ source }) {
  const { repository_id: repositoryId, sequence_file_url: sequenceFileUrl } = source;
  return (
    <>
      Plasmid
      {' '}

      <ExternalLink href={sequenceFileUrl.replace('https://assets.opencloning.org/open-dna-collections', 'https://github.com/Reclone-org/open-dna-collections/tree/main')}>
        {repositoryId.split('/')[1]}
      </ExternalLink>
      {' '} from collection {' '}
      <ExternalLink href={`https://github.com/Reclone-org/open-dna-collections/tree/main/${repositoryId.split('/')[0]}`}>
        {repositoryId.split('/')[0]}
      </ExternalLink>

      {' '}
      from <ExternalLink href="https://github.com/Reclone-org/open-dna-collections">Open DNA Collections</ExternalLink>
    </>
  );
}

function RepositoryIdMessage({ source }) {
  const repositorySlug = repositoryMetadata[source.type].slug;
  let url = '';
  if (repositorySlug === 'genbank') {
    url = `https://www.ncbi.nlm.nih.gov/nuccore/${source.repository_id}`;
  } else if (repositorySlug === 'addgene') {
    url = `https://www.addgene.org/${source.repository_id}/sequences/`;
  }
  return (
    <>
      {`Request to ${repositorySlug || source.type} with ID `}
      <strong>
        <ExternalLink href={url}>
          {source.repository_id}
        </ExternalLink>
      </strong>
    </>
  );
}

function GatewayMessage({ source }) {
  return `Gateway ${source.reaction_type} reaction`;
}

function RecombinaseMessage({ source }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const recombinases = source.recombinases || [];
  return (
    <>
      <Box>
        Recombinase reaction
      </Box>
      <Button onClick={() => setDialogOpen(true)}>
        See info
      </Button>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Recombinase details</DialogTitle>
        <DialogContent dividers>
          {recombinases.map((r, i) => (
            <Box key={`${r.site1}-${r.site2}-${i}`}>
              {i > 0 && <Divider sx={{ my: 2 }} />}
              <Box sx={{ py: 1 }}>
                {r.name && (
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    {r.name}
                  </Typography>
                )}
                <Typography variant="body2" component="div" sx={{ typography: 'sequence', fontSize: '0.9em' }}>
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {r.site1_name || 'site1'}:
                  </Box>
                  {' '}{r.site1}
                </Typography>
                <Typography variant="body2" component="div" sx={{ typography: 'sequence', fontSize: '0.9em', mt: 0.5 }}>
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                    {r.site2_name || 'site2'}:
                  </Box>
                  {' '}{r.site2}
                </Typography>
              </Box>
            </Box>
          ))}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PlannotateAnnotationMessage({ source }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  return (
    <>
      <div>
        {'Annotation from '}
        <ExternalLink href="https://github.com/mmcguffi/pLannotate">pLannotate</ExternalLink>
      </div>
      <Button onClick={() => setDialogOpen(true)}>
        See report
      </Button>
      <PlannotateAnnotationReport dialogOpen={dialogOpen} setDialogOpen={setDialogOpen} report={source.annotation_report} />
    </>
  );
}

function IGEMMessage({ source }) {
  // Split repository_id by the first -, the first part is the part name, the rest is the backbone,
  // but there may be more than one -
  const indexOfDash = source.repository_id.indexOf('-');
  if (indexOfDash === -1) {
    return (
      <>
        {`iGEM plasmid ${source.repository_id} from `}
        <ExternalLink href="https://airtable.com/appgWgf6EPX5gpnNU/shrb0c8oYTgpZDRgH/tblNqHsHbNNQP2HCX">2024 iGEM Distribution</ExternalLink>
      </>
    );
  }
  const partName = source.repository_id.substring(0, indexOfDash);
  const backbone = source.repository_id.substring(indexOfDash + 1);
  const indexInCollection = source.sequence_file_url.match(/(\d+)\.gb$/)[1];
  return (
    <>
      <div>
        {'iGEM '}
        <ExternalLink href={source.sequence_file_url}>
          plasmid
        </ExternalLink>
        {' containing part '}
        <ExternalLink href={`https://parts.igem.org/Part:${partName}`}>{partName}</ExternalLink>
        {` in backbone ${backbone} from `}
        <ExternalLink href="https://airtable.com/appgWgf6EPX5gpnNU/shrb0c8oYTgpZDRgH/tblNqHsHbNNQP2HCX">2024 iGEM Distribution</ExternalLink>
      </div>
      <Box sx={{ mt: 1 }}>
        {'Annotated with '}
        <ExternalLink href="https://github.com/mmcguffi/pLannotate">
          pLannotate
        </ExternalLink>
        {', see report '}
        <ExternalLink href={`https://github.com/manulera/annotated-igem-distribution/blob/master/results/reports/${indexInCollection}.csv`}>here</ExternalLink>
      </Box>
    </>
  );
}

function SEVAPlasmidMessage({ source }) {
  return (
    <div>
      {'SEVA plasmid '}
      <ExternalLink href={source.sequence_file_url}>
        {source.repository_id}
      </ExternalLink>
    </div>
  );
}

function PCRMessage({ source }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const primers = useSelector((state) => state.cloning.primers, isEqual);
  const { pcrDetails, retryGetPCRDetails, requestStatus } = usePCRDetails([source.id]);
  const [fwdPrimer, rvsPrimer] = [source.input[0].sequence, source.input[2].sequence];
  return (
    <div>
      <div>{`PCR with primers ${primers.find((p) => fwdPrimer === p.id).name} and ${primers.find((p) => rvsPrimer === p.id).name}`}</div>
      <RequestStatusWrapper requestStatus={requestStatus} retry={retryGetPCRDetails}>
        <Button onClick={() => setDialogOpen(true)}>
          See PCR details
        </Button>
      </RequestStatusWrapper>
      {pcrDetails.length > 0 && dialogOpen && (
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogContent>
            <PCRTable pcrDetail={pcrDetails[0]} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FileMessage({ source }) {
  const common = `Read from file ${source.file_name}`;
  if (source.coordinates) {
    const coordinates = `then extracted subsequence ${source.coordinates}`;
    return (
      <>
        <div>
          {`${common},`}
        </div>
        <Box sx={{ mt: 0.5 }}>
          {coordinates}
        </Box>
      </>
    );
  }
  return common;
}

function HomologousRecombinationMessage({ source }) {
  if (source.input.length === 1) {
    return (
      <>
        Excission by homologous recombination.
      </>
    );
  }
  return (
    <>
      Homologous recombination with {source.input[0].sequence} as template and {source.input[1].sequence} as insert.
    </>
  );
}

function GenomeCoordinatesMessage({ source }) {
  const strand = source.coordinates.includes('complement') ? -1 : 1;
  const coordinateString = source.coordinates.replace('complement(','').replace(')','');
  return (
    <>
      <Typography component="h4" sx={{ fontSize: '1.125rem', fontWeight: 'fontWeightLight', mb: 0.5 }}>Genome region</Typography>
      {source.assembly_accession && (
        <div>
          <strong>Assembly:</strong>
          {' '}
          <ExternalLink href={`https://www.ncbi.nlm.nih.gov/datasets/genome/${source.assembly_accession}`}>{source.assembly_accession}</ExternalLink>
        </div>
      )}
      <div>
        <strong>Coords:</strong>
        {' '}
        <ExternalLink href={`https://www.ncbi.nlm.nih.gov/nuccore/${source.repository_id}`}>{source.repository_id}</ExternalLink>
        {` (${coordinateString}, ${strand})`}
      </div>
      {source.locus_tag && (
        <div>
          <strong>Locus tag:</strong>
          {' '}
          {source.locus_tag}
        </div>
      )}
      {source.gene_id && (
        <div>
          <strong>Gene ID:</strong>
          {' '}
          <ExternalLink href={`https://www.ncbi.nlm.nih.gov/gene/${source.gene_id}`}>
            {source.gene_id}
          </ExternalLink>
        </div>
      )}

    </>
  );
}

function FinishedSource({ sourceId }) {
  const source = useSelector((state) => state.cloning.sources.find((s) => s.id === sourceId), isEqual);
  const primers = useSelector((state) => state.cloning.primers, isEqual);
  let message = '';
  switch (source.type) {
    case 'UploadedFileSource': message = <FileMessage source={source} />; break;
    case 'ManuallyTypedSource': message = 'Manually typed sequence'; break;
    case 'LigationSource': message = (source.input.length === 1) ? 'Circularization of fragment' : 'Ligation of fragments'; break;
    case 'GibsonAssemblySource': message = 'Gibson assembly of fragments'; break;
    case 'OverlapExtensionPCRLigationSource': message = 'Overlap extension PCR ligation'; break;
    case 'InFusionSource': message = 'In-Fusion assembly of fragments'; break;
    case 'CreLoxRecombinationSource': message = 'Cre/Lox recombination'; break;
    case 'RecombinaseSource': message = <RecombinaseMessage source={source} />; break;
    case 'InVivoAssemblySource': message = 'In vivo assembly of fragments'; break;
    case 'RestrictionEnzymeDigestionSource': {
      const uniqueEnzymes = enzymesInRestrictionEnzymeDigestionSource(source);
      message = `Restriction with ${uniqueEnzymes.join(' and ')}`;
    }
      break;
    case 'RestrictionAndLigationSource': {
      const uniqueEnzymes = [...new Set(source.restriction_enzymes)];
      uniqueEnzymes.sort();
      message = `Restriction with ${uniqueEnzymes.join(' and ')}, then ligation`;
    }
      break;
    case 'PCRSource': message = <PCRMessage source={source} />; break;
    case 'OligoHybridizationSource':
      message = `Hybridization of primers ${primers.find((p) => source.input[0].sequence === p.id).name} and ${primers.find((p) => source.input[1].sequence === p.id).name}`;
      break;
    case 'HomologousRecombinationSource': message = <HomologousRecombinationMessage source={source} />; break;
    case 'CRISPRSource': {
      const guidesString = source.input.filter(({ type }) => type === 'SourceInput').map(({ sequence }) => primers.find((p) => sequence === p.id).name).join(', ');
      message = `CRISPR HDR with ${source.input[0].sequence} as template, ${source.input[1].sequence} as insert and ${guidesString} as a guide${source.input.length > 3 ? 's' : ''}`;
    }
      break;
    case 'NCBISequenceSource': message = <RepositoryIdMessage source={source} />;
      break;
    case 'AddgeneIdSource': message = <RepositoryIdMessage source={source} />;
      break;
    case 'BenchlingUrlSource': message = <BenchlingMessage source={source} />;
      break;
    case 'EuroscarfSource': message = <EuroscarfMessage source={source} />;
      break;
    case 'SnapGenePlasmidSource': message = <SnapGenePlasmidMessage source={source} />;
      break;
    case 'WekWikGeneIdSource': message = <WeKwikGeneMessage source={source} />;
      break;
    case 'GatewaySource': message = <GatewayMessage source={source} />;
      break;
    case 'OpenDNACollectionsSource': message = <OpenDNACollectionsMessage source={source} />;
      break;
    case 'GenomeCoordinatesSource': message = <GenomeCoordinatesMessage source={source} />;
      break;
    case 'PolymeraseExtensionSource': message = 'Polymerase extension'; break;
    case 'AnnotationSource': message = <PlannotateAnnotationMessage source={source} />; break;
    case 'IGEMSource': message = <IGEMMessage source={source} />; break;
    case 'ReverseComplementSource': message = 'Reverse complement'; break;
    case 'SEVASource': message = <SEVAPlasmidMessage source={source} />; break;
    case 'DatabaseSource': message = <DatabaseMessage source={source} />; break;
    default: message = '';
  }
  return (
    // Long names break only where necessary
    <Box className="finished-source" sx={{ wordBreak: 'break-word' }}>
      <div />
      {message}
    </Box>
  );
}

export default React.memo(FinishedSource);
