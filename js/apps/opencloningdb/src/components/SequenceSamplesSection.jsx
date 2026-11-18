import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Box, CircularProgress, IconButton, List, ListItem, ListItemIcon, Paper, Tooltip, Typography } from '@mui/material';
import {
  AddCircle as AddCircleIcon,
  SwapHoriz as SwapHorizIcon,
  Visibility as VisibilityIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  DriveFileMove as DriveFileMoveIcon,
  InsertDriveFile as InsertDriveFileIcon,
  UploadFile as UploadFileIcon,
  CallMade as CallMadeIcon,
} from '@mui/icons-material';
import { openCloningDBHttpClient, endpoints, OpenCloningDBInterface, sequencingFileFromRef, SampleUidLabel } from '@opencloning/opencloningdb';
import { ImportSequencingFilesInput } from '@opencloning/ui/components/verification';
import { QueryStatusWrapper } from '@opencloning/ui';
import { downloadBlob } from '@opencloning/utils/readNwrite';
import DetailPageSection from './DetailPageSection';
import DetailPageSectionAction from './DetailPageSectionAction';
import CreateSampleDialog from './CreateSampleDialog';
import TransferSampleDialog from './TransferSampleDialog';
import EditSampleDialog from './EditSampleDialog';
import MoveSequencingFileDialog from './MoveSequencingFileDialog';
import ConfirmMutationDialog from './ConfirmMutationDialog';
import useSampleMutation from '../hooks/useSampleMutation';
import useDeleteSequenceUIDMutation from '../hooks/useDeleteSequenceUIDMutation';
import useAppAlerts from '../hooks/useAppAlerts';

const { submitSequencingFileToDatabase } = OpenCloningDBInterface;

// Samples of a sequence are expected to be few, they are all shown
const MAX_SAMPLES = 100;

// The tooltip labels the span (aria-label), which also works when the button is disabled
function SmallAction({ title, onClick, icon, disabled = false, ...rest }) {
  return (
    <Tooltip title={title} placement="top">
      <span>
        <IconButton size="small" onClick={onClick} disabled={disabled} {...rest}>
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

function SequencingFileRow({ file }) {
  const [moveOpen, setMoveOpen] = React.useState(false);
  const deleteMutation = useSampleMutation({
    mutationFn: () => openCloningDBHttpClient.delete(endpoints.sequencingFile(file.id)),
    successMessage: 'Sequencing file deleted successfully',
  });
  const onDownload = async () => {
    const downloaded = await file.getFile();
    downloadBlob(downloaded, downloaded.name);
  };
  return (
    <ListItem disableGutters dense sx={{ pl: 1, mb: 0.5, borderLeft: '3px solid', borderColor: 'primary.light', display: 'flex', alignItems: 'center', '&:hover .file-actions': { opacity: 1 }, '& .file-actions': { opacity: 0, transition: 'opacity 0.15s' } }} data-testid="sequencing-file-row">
      <ListItemIcon sx={{ minWidth: 32, flexShrink: 0 }}>
        <InsertDriveFileIcon fontSize="small" color="action" />
      </ListItemIcon>
      <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.875rem', flexShrink: 0 }}>{file.name}</Box>
      <Box className="file-actions" sx={{ display: 'flex', alignItems: 'center', ml: 0.5 }}>
        <SmallAction title="Download" onClick={onDownload} icon={<DownloadIcon fontSize="small" />} />
        <SmallAction title="Move to another sample" onClick={() => setMoveOpen(true)} icon={<DriveFileMoveIcon fontSize="small" />} />
        <SmallAction title="Delete" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} icon={<DeleteIcon fontSize="small" />} />
      </Box>
      <MoveSequencingFileDialog file={file} open={moveOpen} onClose={() => setMoveOpen(false)} />
    </ListItem>
  );
}

function SampleBlock({ sample, sequenceId, canHaveFiles }) {
  const fileInputRef = React.useRef(null);
  const [dialog, setDialog] = React.useState(null);
  const closeDialog = () => setDialog(null);
  const files = React.useMemo(() => sample.sequencing_files.map((ref) => sequencingFileFromRef(ref)), [sample]);

  const uploadMutation = useSampleMutation({
    mutationFn: (sequencingFiles) => submitSequencingFileToDatabase({ sampleUid: sample.uid, sequencingFiles }),
    successMessage: 'Sequencing files submitted successfully',
  });
  const deleteMutation = useDeleteSequenceUIDMutation();

  const { addAlert } = useAppAlerts();
  const onFileChange = (newFiles) => {
    const repeated = newFiles.find((file) => files.some(({ name }) => name === file.name));
    if (repeated) {
      addAlert({ message: `Sample ${sample.uid} already has a file called ${repeated.name}`, severity: 'error' });
      return;
    }
    uploadMutation.mutate(newFiles);
  };

  return (
    <Paper variant="outlined" sx={{ p: 1, mb: 1, maxWidth: 800 }} data-testid="sample-block">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <SampleUidLabel uid={sample.uid} data-testid="sample-block-uid" />
        <Typography variant="body2" color="text.secondary" data-testid="sample-block-location">
          {sample.location ? `Location: ${sample.location}` : 'No location'}
        </Typography>
        <Box sx={{ ml: 'auto', display: 'flex' }}>
          {canHaveFiles && (
            <>
              <ImportSequencingFilesInput onFileChange={onFileChange} fileInputRef={fileInputRef} />
              <SmallAction
                title="Add sequencing files"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                icon={uploadMutation.isPending ? <CircularProgress size={18} /> : <UploadFileIcon fontSize="small" />}
              />
            </>
          )}
          <SmallAction title="Edit UID and location" onClick={() => setDialog('edit')} icon={<EditIcon fontSize="small" />} />
          <SmallAction title="Move to another sequence" onClick={() => setDialog('move')} icon={<CallMadeIcon fontSize="small" />} />
          <SmallAction title="Delete sample" onClick={() => setDialog('delete')} icon={<DeleteIcon fontSize="small" />} />
        </Box>
      </Box>
      {files.length > 0 && (
        <List disablePadding sx={{ mt: 1 }}>
          {files.map((file) => <SequencingFileRow key={file.id} file={file} />)}
        </List>
      )}
      <EditSampleDialog sample={sample} open={dialog === 'edit'} onClose={closeDialog} />
      <TransferSampleDialog sequenceId={sequenceId} sample={sample} open={dialog === 'move'} onClose={closeDialog} />
      <ConfirmMutationDialog
        open={dialog === 'delete'}
        onClose={closeDialog}
        mutation={{ ...deleteMutation, mutate: () => deleteMutation.mutate(sample.uid, { onSuccess: closeDialog }) }}
        title="Delete sample"
        content={<>Delete sample <strong>{sample.uid}</strong>{files.length > 0 && ` and its ${files.length} sequencing file(s)`}?</>}
        confirmButtonText="Delete"
      />
    </Paper>
  );
}

/**
 * The samples of a sequence (physical instances with a UID), each with its location and sequencing files.
 * onSeeAlignments aligns the sequencing files of all the samples to the sequence.
 */
function SequenceSamplesSection({ sequenceId, isTemplateSequence = false, onSeeAlignments, alignmentLoading = false }) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);

  const samplesQuery = useQuery({
    queryKey: ['sequence', sequenceId, 'samples'],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.sequenceSamples, {
        params: { sequence_id: sequenceId, size: MAX_SAMPLES },
      });
      return data.items;
    },
  });
  const samples = samplesQuery.data ?? [];
  const hasFiles = samples.some((sample) => sample.sequencing_files.length > 0);

  return (
    <>
      <DetailPageSection
        title="Samples"
        data-testid="sequence-samples-section"
        actions={
          <>
            <DetailPageSectionAction icon={<AddCircleIcon />} onClick={() => setCreateOpen(true)} title="Add new UIDs" />
            <DetailPageSectionAction icon={<SwapHorizIcon />} onClick={() => setTransferOpen(true)} title="Transfer UID from another sequence" />
            {hasFiles && onSeeAlignments && (
              <DetailPageSectionAction
                icon={alignmentLoading ? <CircularProgress size={24} /> : <VisibilityIcon />}
                onClick={onSeeAlignments}
                title="See alignments"
              />
            )}
          </>
        }
      >
        <QueryStatusWrapper queryResult={samplesQuery}>
          {samples.map((sample) => (
            <SampleBlock key={sample.id} sample={sample} sequenceId={sequenceId} canHaveFiles={!isTemplateSequence} />
          ))}
          {samples.length === 0 && (
            <Typography color="text.secondary">
              No samples. Add a sample UID for each isolate (e.g. each colony) of this sequence, and link its sequencing files to it.
            </Typography>
          )}
        </QueryStatusWrapper>
      </DetailPageSection>
      <CreateSampleDialog sequenceId={sequenceId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <TransferSampleDialog sequenceId={sequenceId} open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}

export default SequenceSamplesSection;
