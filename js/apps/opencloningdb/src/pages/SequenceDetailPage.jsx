import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Typography, CircularProgress, Alert, Box, IconButton, TableContainer, Paper, Tooltip } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { convertToTeselaJson, downloadBlob, file2base64, getTeselaJsonFromBase64 } from '@opencloning/utils/readNwrite';
import SequenceViewer from '@opencloning/ui/components/SequenceViewer';
import ResourceDetailHeader from '../components/ResourceDetailHeader';
import SequenceTypeChip from '../components/SequenceTypeChip';
import EditSequenceNameAndType from '../components/EditSequenceNameAndType';
import DetailPageSection from '../components/DetailPageSection';
import SequenceTable from '../components/SequenceTable';
import PrimersTable from '../components/PrimersTable';
import LinesTable from '../components/LinesTable';
import PageContainer from '../components/PageContainer';
import TopButtonSection from '../components/TopButtonSection';
import AddToCloningButton from '../components/AddToCloningButton';
import ChangeSequenceCircularityButton from '../components/ChangeSequenceCircularityButton';
import DeleteResourceButton from '../components/DeleteResourceButton';
import { List, ListItem, ListItemIcon } from '@mui/material';
import { OpenCloningDBInterface } from '@opencloning/opencloningdb';
import { Download as DownloadIcon, Visibility as VisibilityIcon, AddCircle as AddCircleIcon, Delete as DeleteIcon, InsertDriveFile as InsertDriveFileIcon } from '@mui/icons-material';
import DetailPageSectionAction from '../components/DetailPageSectionAction';
import { ImportSequencingFilesInput } from '@opencloning/ui/components/verification';
import useAppAlerts from '../hooks/useAppAlerts';
import useSequencingAlignment from '@opencloning/ui/hooks/useSequencingAlignment';
import { QueryStatusWrapper } from '@opencloning/ui';
import SequenceSamplesSection from '../components/SequenceSamplesSection';
import useUpdateAnnotationMutation from '../hooks/useUpdateAnnotationMutation';

const { getSequencingFiles, submitSequencingFileToDatabase } = OpenCloningDBInterface;

function SequencingFileRow({ file, sequenceId, onGetFile }) {
  return (
    <ListItem disableGutters dense sx={{ pl: 1, mb: 0.5, borderLeft: '3px solid', borderColor: 'primary.light', display: 'flex', alignItems: 'center', '&:hover .file-actions': { opacity: 1 }, '& .file-actions': { opacity: 0, transition: 'opacity 0.15s' } }} data-testid="sequencing-file-row">
      <ListItemIcon sx={{ minWidth: 32, flexShrink: 0 }}>
        <InsertDriveFileIcon fontSize="small" color="action" />
      </ListItemIcon>
      <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', flexShrink: 0 }}>{file.name}</Box>
      <Box className="file-actions" sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
        <Tooltip title="Download" placement="top" arrow>
          <IconButton size="small" onClick={() => onGetFile(file.getFile)}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete" placement="top" arrow>
          <span>
            <DeleteSequencingFileButton sequenceId={sequenceId} fileId={file.id} />
          </span>
        </Tooltip>
      </Box>
    </ListItem>
  );
}

function DeleteSequencingFileButton({ sequenceId, fileId }) {
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();

  const deleteSequencingFileMutation = useMutation({
    mutationFn: () => openCloningDBHttpClient.delete(endpoints.sequenceSequencingFileDelete(sequenceId, fileId)),
    onSuccess: () => {
      addAlert({ message: 'Sequencing file deleted successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'cloning_strategy'] });
      queryClient.invalidateQueries({ queryKey: ['sequence', sequenceId, 'sequencing_files'] });
    },
    onError: (error) => {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Error deleting sequencing file',
        severity: 'error',
      });
    },
  });

  return (
    <IconButton
      size="small"
      onClick={() => deleteSequencingFileMutation.mutate()}
      disabled={deleteSequencingFileMutation.isLoading}
    >
      <DeleteIcon fontSize="small" />
    </IconButton>
  );
}

function SequencingFileSectionActions({ sequencingFiles, databaseId, onSeeAlignments, alignmentLoading }) {
  const fileInputRef = React.useRef(null);
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();
  const sequencingFileNames = React.useMemo(() => sequencingFiles.map((file) => file.name), [sequencingFiles]);

  const mutation = useMutation({
    mutationFn: (files) => submitSequencingFileToDatabase({ databaseId, sequencingFiles: files }),
    onSuccess: () => {
      addAlert({ message: 'Sequencing files submitted successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequence', databaseId, 'cloning_strategy'] });
      queryClient.invalidateQueries({ queryKey: ['sequence', databaseId, 'sequencing_files'] });
    },
    onError: (error) => {
      addAlert({
        message: error?.response?.data?.detail || error?.message || 'Error submitting sequencing files',
        severity: 'error',
      });
    },
  });

  const handleFileChange = (files) => {
    for (const file of files) {
      if (sequencingFileNames.includes(file.name)) {
        addAlert({ message: `File ${file.name} already exists`, severity: 'error' });
        return;
      }
    }
    mutation.mutate(files);
  };
  return (
    <>
      <ImportSequencingFilesInput onFileChange={handleFileChange} fileInputRef={fileInputRef} />
      <DetailPageSectionAction icon={<AddCircleIcon />} onClick={ () => fileInputRef.current?.click()} title="Add sequencing files" />
      {sequencingFiles?.length > 0 && (
        <DetailPageSectionAction
          icon={alignmentLoading ? <CircularProgress size={24} /> : <VisibilityIcon />}
          onClick={onSeeAlignments}
          title="See alignments"
          disabled={alignmentLoading}
        />
      )}
    </>
  )
}

function SequenceDetailPage() {
  const { id: idString } = useParams();
  const id = parseInt(idString);
  const navigate = useNavigate();
  const { addAlert } = useAppAlerts();
  const alignmentMutation = useSequencingAlignment({ onError: (e) => addAlert({ message: e?.message || 'Alignment failed', severity: 'error' }) });
  const onGetFile = async (fileGetter) => {
    const file = await fileGetter();
    downloadBlob(file, file.name);
  }

  const { data: data, isLoading: isLoading, error: error} = useQuery({
    retry: false,
    queryKey: ['sequence', id, 'cloning_strategy'],
    queryFn: async () => {
      const [{ data: sequenceInDb}, { data: sequenceLines }] = await Promise.all([
        openCloningDBHttpClient.get(endpoints.sequence(id)),
        openCloningDBHttpClient.get(endpoints.sequenceLines(id)),
      ]);
      let cloningStrategy = null;
      let children = [];
      const isTemplateSequence = sequenceInDb.type === 'template_sequence';
      if (!isTemplateSequence) {
        const [{ data: cloningStrategyData }, { data: childrenData }] = await Promise.all([
          openCloningDBHttpClient.get(endpoints.sequenceCloningStrategy(id)),
          openCloningDBHttpClient.get(endpoints.sequenceChildren(id)),
        ]);
        cloningStrategy = cloningStrategyData;
        children = childrenData;
      }
      const parentSource = cloningStrategy?.sources.find((source) => source.database_id === id);

      const sequenceModel = cloningStrategy?.sequences.find((sequence) => sequence.id === parentSource.id);
      const parentSequenceIds = cloningStrategy?.sources.map((source) => source.database_id).filter((dbId) => dbId !== id);
      let parentSequencesData = [];
      if (!isTemplateSequence) {
        parentSequencesData = await Promise.all(parentSequenceIds.map((sequenceId) => openCloningDBHttpClient.get(endpoints.sequence(sequenceId))));
      }
      return { parentSequences : parentSequencesData.map((r) => r.data), parentSource, sequenceModel, sequenceInDb, children, sequenceLines, isTemplateSequence };
    },
    enabled: Boolean(id),
  });
  const sequencingFilesQuery = useQuery({
    retry: false,
    queryKey: ['sequence', id, 'sequencing_files'],
    queryFn: () => getSequencingFiles(id),
    enabled: Boolean(id),
  });
  const primersQuery = useQuery({
    retry: false,
    queryKey: ['sequence', id, 'primers'],
    queryFn: async () => {
      const { data: primers } = await openCloningDBHttpClient.get(endpoints.sequencePrimers(id));
      return { templates: primers.templates, products: primers.products };
    },
    enabled: Boolean(id),
  });
  const { data: primers } = primersQuery;

  const { data: sequencingFiles = [] } = sequencingFilesQuery;
  const { parentSequences, parentSource, sequenceModel, sequenceInDb, children, sequenceLines = [], isTemplateSequence } = React.useMemo(() => data ?? {}, [data]);
  const sequenceData = React.useMemo(() => sequenceModel ? convertToTeselaJson(sequenceModel) : null, [sequenceModel]);
  const tags = React.useMemo(() => sequenceInDb?.tags ?? [], [sequenceInDb]);

  const handleSeeAlignmentsMutation = useMutation({
    mutationFn: async () => {
      const parsedFiles = await Promise.all(sequencingFiles.map(async (file) => {
        const fileBlob = await file.getFile();
        const base64str = await file2base64(fileBlob);
        const fileContent = await getTeselaJsonFromBase64(base64str, file.name);
        return { fileName: file.name, fileContent };
      }));
      return parsedFiles;
    },
    onSuccess: (parsedFiles) => {
      alignmentMutation.mutate({ sequenceModel, sequenceData, parsedFiles });
    },
    onError: (e) => {
      addAlert({ message: e?.message || 'Failed to load sequencing files', severity: 'error' });
    },
  });

  const queryClient = useQueryClient();
  const hasParents = (parentSequences?.length ?? 0) > 0;
  const hasChildren = (children?.length ?? 0) > 0;
  const presentInLine = sequenceLines.length > 0;
  const deleteDisabledReason = hasChildren
    ? 'Cannot delete: sequence has children'
    : presentInLine
      ? 'Cannot delete: sequence is present in a line'
      : null;

  const deleteSequenceMutation = useMutation({
    mutationFn: () => openCloningDBHttpClient.delete(endpoints.sequence(id)),
    onSuccess: () => {
      addAlert({ message: 'Sequence deleted successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      navigate('/sequences');
    },
    onError: (mutationError) => {
      addAlert({
        message: mutationError?.response?.data?.detail || mutationError?.message || 'Error deleting sequence',
        severity: 'error',
      });
    },
  });

  const updateAnnotationMutation = useUpdateAnnotationMutation(id, sequenceModel);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error?.response?.data?.detail || error?.message || 'Failed to load sequence'}</Alert>;

  return (
    <PageContainer>
      <Box sx={{ position: 'relative'}}>
        <Box sx={{ position: 'absolute', top: 0, right: 0, fontFamily: 'monospace' }} data-testid="sequence-seguid">
          {sequenceInDb?.seguid}
        </Box>
      </Box>
      <ResourceDetailHeader
        data-testid="sequence-header"
        title={sequenceInDb?.name}
        afterTitle={<SequenceTypeChip sequenceType={sequenceInDb?.sequence_type} sx={{ fontSize: '1.2rem' }} />}
        tags={tags}
        entityId={id}
        entityType="input_entities"
        onBack={() => navigate('/sequences')}
        backTitle="Back to Sequences"
        editorComponent={EditSequenceNameAndType}
        editorComponentProps={{ sequenceData, sequenceInDb, presentInLine }}
        editorIconToolTipText="Edit name and type"
      />

      <TopButtonSection>
        {!isTemplateSequence && (
          <>
            <AddToCloningButton selectedEntities={[sequenceModel]} entityType="sequence" size="small">
          Add to Design Tab
            </AddToCloningButton>
            <ChangeSequenceCircularityButton
              sequenceId={id}
              hasParents={hasParents}
              hasChildren={hasChildren}
              hasOverhangs={
                (sequenceInDb?.overhang_crick_3prime ?? 0) !== 0
            || (sequenceInDb?.overhang_watson_3prime ?? 0) !== 0
              }
              isCircular={sequenceData?.circular}
            />
          </>)}
        <DeleteResourceButton
          mutation={deleteSequenceMutation}
          disabledReason={deleteDisabledReason}
          buttonLabel="Delete sequence"
          confirmTitle="Delete sequence"
          confirmContent={<Typography>Are you sure you want to delete sequence <strong>{sequenceInDb?.name}</strong>?</Typography>}
          confirmButtonText="Confirm delete"
          dataTestId="delete-sequence-button"
        />
      </TopButtonSection>
      {isTemplateSequence && (
        <Alert severity="info" sx={{ maxWidth: 500 }}>This is a sequence template.</Alert>
      )}
      <SequenceSamplesSection sequenceId={id} sampleUids={sequenceInDb?.sample_uids ?? []} />
      {sequenceInDb.type !== 'template_sequence' && (
        <DetailPageSection title="Provenance" data-testid="sequence-provenance">
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {parentSource.type}
          </Typography>
          {parentSequences?.length > 0  && (
            <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
              <SequenceTable sequences={parentSequences} />
            </TableContainer>
          )}
        </DetailPageSection>
      )}

      {children?.length > 0 && (
        <DetailPageSection title="Children" data-testid="sequence-children">
          <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
            <SequenceTable sequences={children} />
          </TableContainer>
        </DetailPageSection>
      )}

      {sequenceLines.length > 0 && (
        <DetailPageSection title="Lines" data-testid="sequence-lines">
          <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
            <LinesTable lines={sequenceLines} withCheckbox={false} />
          </TableContainer>
        </DetailPageSection>
      )}

      <QueryStatusWrapper queryResult={primersQuery}>
        {primersQuery.isSuccess && (primers.templates.length > 0 || primers.products.length > 0) && (
          <DetailPageSection title="Linked primers">
            <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
              <PrimersTable primers={[...primers.templates, ...primers.products]} withCheckbox={false} />
            </TableContainer>
          </DetailPageSection>
        )}
      </QueryStatusWrapper>

      {sequenceInDb.type !== 'template_sequence' && (
        <>
          <DetailPageSection title="Sequencing files" actions={
            <SequencingFileSectionActions
              sequencingFiles={sequencingFiles}
              databaseId={id}
              onSeeAlignments={() => handleSeeAlignmentsMutation.mutate()}
              alignmentLoading={handleSeeAlignmentsMutation.isPending || alignmentMutation.isPending}
            />
          }>
            <QueryStatusWrapper queryResult={sequencingFilesQuery}>
              <List disablePadding>
                {sequencingFiles.map((file) => (
                  <SequencingFileRow key={file.name} file={file} sequenceId={id} onGetFile={onGetFile} />
                ))}
              </List>
              {sequencingFiles.length === 0 && (
                <Typography color="text.secondary">No sequencing files linked</Typography>
              )}
            </QueryStatusWrapper>
          </DetailPageSection>

          <Box sx={{ mt: 2 }}>
            {sequenceData ? (
              <SequenceViewer sequenceData={sequenceData} alignmentData={alignmentMutation.data ?? null} onUpdateAnnotation={updateAnnotationMutation.mutateAsync} />
            ) : (
              <Alert severity="warning">Could not parse sequence for display.</Alert>
            )}
          </Box>
        </>
      )}
    </PageContainer>
  );
}

export default SequenceDetailPage;
