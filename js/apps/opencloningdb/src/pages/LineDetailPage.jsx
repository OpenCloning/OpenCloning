import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Typography,
  Button,
  CircularProgress,
  Alert,
  Box,
  TableContainer,
  Paper,
} from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import NewLineUID from '../components/NewLineUID';
import CreateLineDialog from '../components/CreateLineDialog';
import ResourceDetailHeader from '../components/ResourceDetailHeader';
import SequenceTable from '../components/SequenceTable';
import LinesTable from '../components/LinesTable';
import DetailPageSection from '../components/DetailPageSection';
import PageContainer from '../components/PageContainer';
import TopButtonSection from '../components/TopButtonSection';
import useAppAlerts from '../hooks/useAppAlerts';
import DeleteResourceButton from '../components/DeleteResourceButton';
import { getPlasmidSequencesInLine, getAlleleSequencesInLine } from '../utils/models_utils';

function TransformButton({ line }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
        Transformation
      </Button>
      <CreateLineDialog fixedParents={[line]} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function EditLineUID({ line, onSave }) {
  const queryClient = useQueryClient();
  const { addAlert } = useAppAlerts();
  const [nextUid, setNextUid] = React.useState(line.uid ?? '');
  const [uidChecking, setUidChecking] = React.useState(false);
  const sanitizedUid = nextUid.trim();
  const canSubmit = sanitizedUid.length > 0 && sanitizedUid !== line.uid && !uidChecking;

  const patchMutation = useMutation({
    mutationFn: async () => openCloningDBHttpClient.patch(endpoints.line(line.id), { uid: sanitizedUid }),
    onSuccess: () => {
      addAlert({ message: 'Line UID updated successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['line', line.id] });
      queryClient.invalidateQueries({ queryKey: ['lineChildren', line.id] });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      onSave();
    },
    onError: (mutationError) => {
      addAlert({
        message: mutationError?.response?.data?.detail || mutationError?.message || 'Error updating line UID',
        severity: 'error',
      });
    },
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    patchMutation.mutate();
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <NewLineUID
        onChange={setNextUid}
        onValidationStateChange={({ isChecking }) => setUidChecking(isChecking)}
        label="Line UID"
        placeholder="Edit line UID"
        excludeUid={line.uid}
        defaultValue={line.uid ?? ''}
        sx={{ minWidth: 240 }}
        size="small"
      />
      <Button
        type="submit"
        variant="contained"
        sx={{ mb: 3 }}
        disabled={!canSubmit || patchMutation.isPending}
      >
        {patchMutation.isPending ? 'Saving...' : 'Save'}
      </Button>
      <Button
        variant="text"
        color="error"
        sx={{ mb: 3 }}
        onClick={() => onSave()}
      >
        Cancel
      </Button>
    </Box>
  );
}

function LineDetailPage() {
  const { id: stringId } = useParams();
  // This is necessary because of query keys
  const id = parseInt(stringId);
  const navigate = useNavigate();
  const { addAlert } = useAppAlerts();
  const queryClient = useQueryClient();

  const { data: line, isLoading, error } = useQuery({
    queryKey: ['line', id],
    queryFn: async () => {
      const { data: res } = await openCloningDBHttpClient.get(endpoints.line(id));
      const parentLinesData = await Promise.all(res.parent_ids.map((parentId) => openCloningDBHttpClient.get(endpoints.line(parentId))));
      const parentLines = parentLinesData?.map((r) => r.data) ?? [];
      return { ...res, parentLines };
    }
  });

  const { data: children = [], isLoading: isChildrenLoading, error: childrenError} = useQuery({
    queryKey: ['lineChildren', id],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.lineChildren(id));
      return data ?? [];
    }
  });

  const deleteLineMutation = useMutation({
    mutationFn: async () => openCloningDBHttpClient.delete(endpoints.line(id)),
    onSuccess: () => {
      addAlert({ message: 'Line deleted successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['lines'] });
      navigate('/lines');
    },
    onError: (mutationError) => {
      addAlert({
        message: mutationError?.response?.data?.detail || mutationError?.message || 'Error deleting line',
        severity: 'error',
      });
    },
  });

  if (isLoading || isChildrenLoading) return <CircularProgress />;
  if (error || childrenError) return <Alert severity="error">{error?.response?.data?.detail || error?.message || childrenError?.response?.data?.detail || childrenError?.message || 'Failed to load line or children'}</Alert>;

  const alleles = getAlleleSequencesInLine(line);
  const plasmids = getPlasmidSequencesInLine(line);
  const { parentLines } = line;
  const hasChildren = children.length > 0;
  const deleteTooltip = hasChildren ? 'Cannot delete: line has children' : null;

  return (
    <PageContainer>
      <ResourceDetailHeader
        title={line.uid}
        tags={line.tags}
        onBack={() => navigate('/lines')}
        backTitle="Back to Lines"
        entityId={id}
        entityType="lines"
        editorComponent={EditLineUID}
        editorComponentProps={{ line }}
        editorIconToolTipText="Edit line UID"
      />

      <TopButtonSection>
        <TransformButton line={line} />
        <DeleteResourceButton
          mutation={deleteLineMutation}
          disabledReason={deleteTooltip}
          buttonLabel="Delete line"
          confirmTitle="Delete line"
          confirmContent={<Typography>Are you sure you want to delete line <strong>{line.uid}</strong>?</Typography>}
          confirmButtonText="Confirm delete"
          dataTestId="delete-line-button"
        />
      </TopButtonSection>

      {alleles.length > 0 && (
        <DetailPageSection title="Genotype" data-testid="line-genotype">
          <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
            <SequenceTable sequences={alleles} showType={false} />
          </TableContainer>
        </DetailPageSection>
      )}

      {plasmids.length > 0 && (
        <DetailPageSection title="Plasmids" data-testid="line-plasmids">
          <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
            <SequenceTable sequences={plasmids} showType={false} />
          </TableContainer>
        </DetailPageSection>
      )}

      {alleles.length === 0 && plasmids.length === 0 && (
        <Typography sx={{ mb: 1 }} color="text.secondary">No genotype or plasmids in this line.</Typography>
      )}

      {parentLines.length > 0 && (
        <DetailPageSection title="Parent lines" data-testid="line-parent-lines">
          <TableContainer component={Paper} sx={{ maxWidth: 1000 }}>
            <LinesTable lines={parentLines} withCheckbox={false} />
          </TableContainer>
        </DetailPageSection>
      )}

      {children.length > 0 && (
        <DetailPageSection title="Children" data-testid="line-children">
          <TableContainer component={Paper} sx={{ maxWidth: 1000 }}>
            <LinesTable lines={children} withCheckbox={false} />
          </TableContainer>
        </DetailPageSection>
      )}

    </PageContainer>
  );
}

export default LineDetailPage;
