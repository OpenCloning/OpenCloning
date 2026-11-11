import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Typography, CircularProgress, Alert, TableContainer, Paper } from '@mui/material';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import ResourceDetailHeader from '../components/ResourceDetailHeader';
import SequenceTable from '../components/SequenceTable';
import DetailPageSection from '../components/DetailPageSection';
import PageContainer from '../components/PageContainer';
import TopButtonSection from '../components/TopButtonSection';
import AddToCloningButton from '../components/AddToCloningButton';
import SampleUidBadge from '../components/SampleUidBadge';
import EditPrimerNameAndUid from '../components/EditPrimerNameAndUid';
import DeleteResourceButton from '../components/DeleteResourceButton';
import useAppAlerts from '../hooks/useAppAlerts';

function PrimerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addAlert } = useAppAlerts();

  const { data, isLoading, error } = useQuery({
    queryKey: ['primer', id],
    queryFn: async () => {
      const { data: primer } = await openCloningDBHttpClient.get(endpoints.primer(id));
      const { data: linkedSequences } = await openCloningDBHttpClient.get(endpoints.primerTemplateSequences(id));
      const {templates, products} = linkedSequences;
      return { primer, templates, products };
    },
  });
  const { primer, templates, products } = data ?? {};
  const inUse = (templates?.length ?? 0) > 0 || (products?.length ?? 0) > 0;
  const deleteDisabledReason = inUse ? 'Cannot delete primer in use' : null;

  const deletePrimerMutation = useMutation({
    mutationFn: () => openCloningDBHttpClient.delete(endpoints.primer(id)),
    onSuccess: () => {
      addAlert({ message: 'Primer deleted successfully', severity: 'success' });
      queryClient.invalidateQueries({ queryKey: ['primers'] });
      navigate('/primers');
    },
    onError: (mutationError) => {
      addAlert({
        message: mutationError?.response?.data?.detail || mutationError?.message || 'Error deleting primer',
        severity: 'error',
      });
    },
  });

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">{error?.response?.data?.detail || error?.message || 'Failed to load primer'}</Alert>;

  return (
    <PageContainer>
      <ResourceDetailHeader
        title={primer.name}
        afterTitle={primer.uid ? <SampleUidBadge uid={primer.uid} /> : <span><i>No UID</i></span>}
        tags={primer.tags}
        onBack={() => navigate('/primers')}
        backTitle="Back to Primers"
        entityId={id}
        entityType="input_entities"
        editorComponent={EditPrimerNameAndUid}
        editorComponentProps={{ primer }}
        editorIconToolTipText="Edit name and UID"
      />
      <TopButtonSection>
        <AddToCloningButton selectedEntities={[primer]} entityType="primer">
          Add to Design Tab
        </AddToCloningButton>
        <DeleteResourceButton
          mutation={deletePrimerMutation}
          disabledReason={deleteDisabledReason}
          buttonLabel="Delete primer"
          confirmTitle="Delete primer"
          confirmContent={<Typography>Are you sure you want to delete primer <strong>{primer.name}</strong>?</Typography>}
          confirmButtonText="Confirm delete"
          dataTestId="delete-primer-button"
        />
      </TopButtonSection>
      <DetailPageSection title="Sequence" data-testid="sequence">
        <Typography sx={{ mt: 1, fontFamily: 'monospace' }}>{primer.sequence}</Typography>
      </DetailPageSection>
      <DetailPageSection title="Linked templates" data-testid="linked-templates">
        <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
          <SequenceTable sequences={templates} />
        </TableContainer>
      </DetailPageSection>
      <DetailPageSection title="Linked products" data-testid="linked-products">
        <TableContainer component={Paper} sx={{ maxWidth: 800 }}>
          <SequenceTable sequences={products} />
        </TableContainer>
      </DetailPageSection>
    </PageContainer>
  );
}

export default PrimerDetailPage;
