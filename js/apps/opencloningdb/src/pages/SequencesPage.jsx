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
  ButtonGroup,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { openCloningDBHttpClient, endpoints, TagMultiSelect, SequenceTypeSelect } from '@opencloning/opencloningdb';
import {
  parseSequenceParams,
  applySequenceParamsToSearchParams,
  parseSequencesView,
  sampleFiltersFromSequenceParams,
} from '../utils/query_utils';
import SearchBarTextField from '../components/SearchBarTextField';
import useAppAlerts from '../hooks/useAppAlerts';
import { UrlParamsForm, filterFieldSx } from '../components/urlParamsForm';
import TagEntitiesButton from '../components/TagEntitiesButton';
import TopButtonSection from '../components/TopButtonSection';
import AddToCloningButton from '../components/AddToCloningButton';
import BulkUploadCloningStrategiesButton from '../components/bulk_upload/BulkUploadCloningStrategiesButton';
import BulkUploadSequencesButton from '../components/bulk_upload/BulkUploadSequencesButton';
import BulkUploadTemplateSequencesButton from '../components/bulk_upload/BulkUploadTemplateSequencesButton';
import PageContainer from '../components/PageContainer';
import SequenceTable from '../components/SequenceTable';
import SamplesTable from '../components/SamplesTable';
import CreateTemplateSequenceButton from '../components/CreateTemplateSequenceButton';
import CheckSequencingButton from '../components/CheckSequencingButton';
import BulkLinkSequencingFilesButton from '../components/bulk_upload/BulkLinkSequencingFilesButton';
import useRowSelection from '../hooks/useRowSelection';
import error2String from '@opencloning/utils/error2String';

function SequenceQueryFields({ pendingParams, setPendingParams, value: view }) {
  const { addErrorAlert } = useAppAlerts();
  return (
    <>
      <SearchBarTextField
        label="UID"
        placeholder="Search by UID"
        value={pendingParams.uid ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, uid: value }))}
      />
      <SearchBarTextField
        label="Name"
        placeholder="Search by name"
        value={pendingParams.name ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, name: value }))}
      />
      <SequenceTypeSelect
        multiple
        value={pendingParams.sequence_types ?? []}
        onChange={(value) => setPendingParams((p) => ({ ...p, sequence_types: value }))}
        sx={filterFieldSx}
      />
      <TagMultiSelect
        onCreateError={addErrorAlert}
        value={pendingParams.tags ?? []}
        onChange={(value) => setPendingParams((p) => ({ ...p, tags: value }))}
        sx={filterFieldSx}
      />
      <SearchBarTextField
        label="Created by"
        placeholder="Search by user name"
        value={pendingParams.created_by ?? ''}
        onChange={(value) => setPendingParams((p) => ({ ...p, created_by: value }))}
      />
      {view === 'samples' ? (
        <SearchBarTextField
          label="Location"
          placeholder="Search by location"
          value={pendingParams.location ?? ''}
          onChange={(value) => setPendingParams((p) => ({ ...p, location: value }))}
        />
      ) : (
        <FormControlLabel
          control={
            <Switch
              checked={pendingParams.has_uid ?? false}
              onChange={(_, checked) => setPendingParams((p) => ({ ...p, has_uid: checked }))}
            />
          }
          label="With UID"
          labelPlacement="top"
        />
      )}
      <Button variant="contained" color="primary" type="submit">
        Search
      </Button>
    </>
  )}


/** Unique sequences of the selected samples, in the order of the samples. */
function sequencesOfSamples(samples) {
  const seen = new Set();
  return samples.map((sample) => sample.sequence).filter((sequence) => {
    if (seen.has(sequence.id)) return false;
    seen.add(sequence.id);
    return true;
  });
}

function SequencesPage() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchParams, setSearchParams] = useSearchParams();

  const view = parseSequencesView(searchParams);
  const filters = useMemo(
    () => parseSequenceParams(searchParams),
    [searchParams],
  );

  // The samples view lists samples (one row per sample), with filters on the samples and on their sequences
  const { endpoint, queryKey, params } = view === 'samples'
    ? { endpoint: endpoints.sequenceSamples, queryKey: 'sequence_samples', params: sampleFiltersFromSequenceParams(filters) }
    : { endpoint: endpoints.sequences, queryKey: 'sequences', params: { ...filters, location: undefined } };

  const { data, isLoading, error } = useQuery({
    queryKey: [queryKey, { page: page + 1, size: rowsPerPage, ...params }],
    queryFn: async () => {
      const { data: res } = await openCloningDBHttpClient.get(endpoint, {
        params: {
          page: page + 1,
          size: rowsPerPage,
          ...params,
        },
      });
      return res;
    },
    // Keep the previous page while loading, but not the data of the other view (rows have another shape)
    placeholderData: (previousData, previousQuery) => (previousQuery?.queryKey[0] === queryKey ? keepPreviousData(previousData) : undefined),
  });

  const items = data?.items ?? [];
  const orderedIds = useMemo(() => items.map((item) => item.id), [items]);
  const { selectedIds, toggleRow, clearSelection } = useRowSelection(orderedIds);

  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const selectedSequences = view === 'samples' ? sequencesOfSamples(selectedItems) : selectedItems;

  const onViewChange = (_, newView) => {
    if (newView === null || newView === view) return;
    const next = new URLSearchParams(searchParams);
    if (newView === 'samples') {
      next.set('view', 'samples');
    } else {
      next.delete('view');
    }
    setPage(0);
    clearSelection();
    setSearchParams(next);
  };

  if (isLoading && !data) return <CircularProgress />;
  if (error) return <Alert severity="error">{error2String(error)}</Alert>;

  return (
    <PageContainer data-testid="sequences-page">
      <Typography variant="h5" sx={{ mb: 2 }}>
        Sequences
      </Typography>
      <ToggleButtonGroup value={view} exclusive onChange={onViewChange} size="small" color="primary" sx={{ mb: 2 }} data-testid="sequences-view-toggle">
        <ToggleButton value="sequences">Sequences</ToggleButton>
        <ToggleButton value="samples">Samples</ToggleButton>
      </ToggleButtonGroup>
      <UrlParamsForm
        parse={parseSequenceParams}
        applyToSearchParams={applySequenceParamsToSearchParams}
        component={SequenceQueryFields}
        value={view}
      />
      <TopButtonSection>
        <ButtonGroup
          color="primary"
        >
          <BulkUploadSequencesButton />
          <BulkUploadCloningStrategiesButton />
          <BulkUploadTemplateSequencesButton />
          <CreateTemplateSequenceButton />
          <BulkLinkSequencingFilesButton />
        </ButtonGroup>
        <CheckSequencingButton />
        <TagEntitiesButton
          selectedEntities={selectedSequences}
          entityType="input_entities"
          label="Sequences"
          onSuccess={clearSelection}
        />
        <AddToCloningButton selectedEntities={selectedSequences} entityType="sequence">
          Add to Design Tab
        </AddToCloningButton>
      </TopButtonSection>
      <TableContainer component={Paper}>
        {view === 'samples' ? (
          <SamplesTable
            samples={items}
            withCheckbox
            selectedIds={selectedIds}
            toggleRow={toggleRow}
          />
        ) : (
          <SequenceTable
            sequences={items}
            showType
            showSampleUids
            showCreatedBy
            showCreatedAt
            withCheckbox
            selectedIds={selectedIds}
            toggleRow={toggleRow}
          />
        )}
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

export default SequencesPage;
