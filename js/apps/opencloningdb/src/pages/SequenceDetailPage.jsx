import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Typography, CircularProgress, Alert, Box } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { convertToTeselaJson, readSequencingFile } from '@opencloning/utils/readNwrite';
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
import { OpenCloningDBInterface } from '@opencloning/opencloningdb';
import useAppAlerts from '../hooks/useAppAlerts';
import useSequencingAlignment from '@opencloning/ui/hooks/useSequencingAlignment';
import { QueryStatusWrapper } from '@opencloning/ui';
import SequenceSamplesSection from '../components/SequenceSamplesSection';
import useUpdateAnnotationMutation from '../hooks/useUpdateAnnotationMutation';
import DetailTable from '../components/DetailTable';
import error2String from '@opencloning/utils/error2String';

const { getSequencingFiles } = OpenCloningDBInterface;

function SequenceDetailPage() {
  const { id: idString } = useParams();
  const id = parseInt(idString);
  const navigate = useNavigate();
  const { addAlert, addErrorAlert } = useAppAlerts();
  const alignmentMutation = useSequencingAlignment({ onError: (e) => addErrorAlert(e) });

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
  // Sequencing files of all the samples, to align them to the sequence
  const sequencingFilesQuery = useQuery({
    retry: false,
    queryKey: ['sequence', id, 'sequencing_files'],
    queryFn: () => getSequencingFiles(id),
    enabled: Boolean(id) && data?.isTemplateSequence === false,
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

  const { parentSequences, parentSource, sequenceModel, sequenceInDb, children, sequenceLines = [], isTemplateSequence } = React.useMemo(() => data ?? {}, [data]);
  const sequenceData = React.useMemo(() => sequenceModel ? convertToTeselaJson(sequenceModel) : null, [sequenceModel]);
  const tags = React.useMemo(() => sequenceInDb?.tags ?? [], [sequenceInDb]);

  const handleSeeAlignmentsMutation = useMutation({
    mutationFn: async () => {
      // If the files could not be retrieved, try again (and show why it failed), rather than align no files
      const sequencingFiles = sequencingFilesQuery.isSuccess
        ? sequencingFilesQuery.data
        : (await sequencingFilesQuery.refetch({ throwOnError: true })).data;
      const parsedFiles = await Promise.all(sequencingFiles.map(async (file) => {
        const { teselaJson: fileContent } = await readSequencingFile(await file.getFile());
        return { fileName: file.name, fileContent };
      }));
      return parsedFiles;
    },
    onSuccess: (parsedFiles) => {
      alignmentMutation.mutate({ sequenceModel, sequenceData, parsedFiles });
    },
    onError: (e) => addErrorAlert(e),
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
        message: error2String(mutationError),
        severity: 'error',
      });
    },
  });

  const updateAnnotationMutation = useUpdateAnnotationMutation(id, sequenceModel);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error2String(error)}</Alert>;

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
      <SequenceSamplesSection
        sequenceId={id}
        isTemplateSequence={isTemplateSequence}
        onSeeAlignments={isTemplateSequence ? null : () => handleSeeAlignmentsMutation.mutate()}
        alignmentLoading={handleSeeAlignmentsMutation.isPending || alignmentMutation.isPending || sequencingFilesQuery.isFetching}
      />
      {sequenceInDb.type !== 'template_sequence' && (
        <DetailPageSection title="Provenance" data-testid="sequence-provenance">
          <Typography color="text.secondary" sx={{ mb: 1 }}>
            {parentSource.type}
          </Typography>
          {parentSequences?.length > 0  && (
            <DetailTable>
              <SequenceTable sequences={parentSequences} />
            </DetailTable>
          )}
        </DetailPageSection>
      )}

      {children?.length > 0 && (
        <DetailPageSection title="Children" data-testid="sequence-children">
          <DetailTable>
            <SequenceTable sequences={children} />
          </DetailTable>
        </DetailPageSection>
      )}

      {sequenceLines.length > 0 && (
        <DetailPageSection title="Lines" data-testid="sequence-lines">
          <DetailTable>
            <LinesTable lines={sequenceLines} withCheckbox={false} />
          </DetailTable>
        </DetailPageSection>
      )}

      <QueryStatusWrapper queryResult={primersQuery}>
        {primersQuery.isSuccess && (primers.templates.length > 0 || primers.products.length > 0) && (
          <DetailPageSection title="Linked primers">
            <DetailTable>
              <PrimersTable primers={[...primers.templates, ...primers.products]} withCheckbox={false} />
            </DetailTable>
          </DetailPageSection>
        )}
      </QueryStatusWrapper>

      {sequenceInDb.type !== 'template_sequence' && (
        <>
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
