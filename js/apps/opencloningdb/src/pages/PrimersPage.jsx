import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import {
  TableContainer,
  TablePagination,
  Paper,
  CircularProgress,
  Alert,
  Typography,
  Button,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { openCloningDBHttpClient, endpoints, TagMultiSelect } from '@opencloning/opencloningdb';
import { parsePrimersParams, applyPrimersParamsToSearchParams } from '../utils/query_utils';
import SearchBarTextField from '../components/SearchBarTextField';
import useAppAlerts from '../hooks/useAppAlerts';
import { UrlParamsForm } from '../components/urlParamsForm';
import TagEntitiesButton from '../components/TagEntitiesButton';
import TopButtonSection from '../components/TopButtonSection';
import AddToCloningButton from '../components/AddToCloningButton';
import BulkUploadPrimersButton from '../components/bulk_upload/BulkUploadPrimersButton';
import PageContainer from '../components/PageContainer';
import PrimersTable from '../components/PrimersTable';
import useRowSelection from '../hooks/useRowSelection';

const MIN_WIDTH = 200;

function PrimerQueryFields({ pendingParams, setPendingParams }) {
  const { addErrorAlert } = useAppAlerts();
  return (
    <>
      <SearchBarTextField
        label="UID"
        placeholder="Search by UID"
        value={pendingParams.uid ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, uid: value }))}
        sx={{ minWidth: MIN_WIDTH }}
      />
      <SearchBarTextField
        label="Name"
        placeholder="Search by name"
        value={pendingParams.name ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, name: value }))}
        sx={{ minWidth: MIN_WIDTH }}
      />
      <TagMultiSelect
        onCreateError={addErrorAlert}
        value={pendingParams.tags ?? []}
        onChange={(value) => setPendingParams((p) => ({ ...p, tags: value }))}
        sx={{ minWidth: MIN_WIDTH }}
      />
      <SearchBarTextField
        label="Created by"
        placeholder="Search by user name"
        value={pendingParams.created_by ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, created_by: value }))}
        sx={{ minWidth: MIN_WIDTH }}
      />
      <FormControlLabel
        control={
          <Switch
            checked={pendingParams.has_uid ?? false}
            onChange={() => setPendingParams((p) => ({ ...p, has_uid: !p.has_uid }))}
          />
        }
        label="With UID"
        labelPlacement="top"
      />
      <Button variant="contained" color="primary" type="submit">
        Search
      </Button>
    </>
  );
}

function PrimersPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchParams] = useSearchParams();


  const filters = useMemo(
    () => parsePrimersParams(searchParams),
    [searchParams],
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['primers', { page: page + 1, size: rowsPerPage, ...filters }],
    queryFn: async () => {
      const { data: res } = await openCloningDBHttpClient.get(endpoints.primers, {
        params: {
          page: page + 1,
          size: rowsPerPage,
          ...filters,
        },
      });
      return res;
    },
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const orderedIds = useMemo(() => items.map((item) => item.id), [items]);
  const { selectedIds, toggleRow, clearSelection } = useRowSelection(orderedIds);

  const selectedPrimers = items.filter((primer) => selectedIds.has(primer.id));

  if (isLoading && !data) return <CircularProgress />;
  if (error) return <Alert severity="error">{error?.response?.data?.detail || error?.message || 'Failed to load primers'}</Alert>;

  return (
    <PageContainer data-testid="primers-page">
      <Typography variant="h5" sx={{ mb: 2 }}>
        Primers
      </Typography>
      <UrlParamsForm
        parse={parsePrimersParams}
        applyToSearchParams={applyPrimersParamsToSearchParams}
        component={PrimerQueryFields}
      />
      <TopButtonSection>
        <BulkUploadPrimersButton />
        <TagEntitiesButton
          selectedEntities={selectedPrimers}
          entityType="input_entities"
          label="Primers"
          onSuccess={clearSelection}
        />
        <AddToCloningButton selectedEntities={selectedPrimers} entityType="primer">
          Add to Design Tab
        </AddToCloningButton>
      </TopButtonSection>
      <TableContainer component={Paper}>
        <PrimersTable
          primers={items}
          showCreatedBy
          showCreatedAt
          withCheckbox={true}
          selectedIds={selectedIds}
          toggleRow={toggleRow}
        />
        <TablePagination
          component="div"
          count={data?.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      </TableContainer>
    </PageContainer>
  );
}

export default PrimersPage;
