import React from 'react';
import { Typography, Box } from '@mui/material';
import { AddCircle as AddCircleIcon, SwapHoriz as SwapHorizIcon } from '@mui/icons-material';
import DetailPageSection from './DetailPageSection';
import DetailPageSectionAction from './DetailPageSectionAction';
import CreateSampleDialog from './CreateSampleDialog';
import TransferSampleDialog from './TransferSampleDialog';
import SampleUidBadge from './SampleUidBadge';

function SequenceSamplesSection({ sequenceId, sampleUids }) {
  const [createOpen, setCreateOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);

  return (
    <>
      <DetailPageSection
        title="Sequence sample UIDs"
        data-testid="sequence-samples-section"
        actions={
          <>
            <DetailPageSectionAction icon={<AddCircleIcon />} onClick={() => setCreateOpen(true)} title="Add new UIDs" />
            <DetailPageSectionAction icon={<SwapHorizIcon />} onClick={() => setTransferOpen(true)} title="Transfer UID from another sequence" />
          </>
        }
      >
        {sampleUids.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {sampleUids.map((uid) => (
              <SampleUidBadge key={uid} uid={uid} canDelete />
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">
            No UIDs linked
          </Typography>
        )}
      </DetailPageSection>
      <CreateSampleDialog sequenceId={sequenceId} open={createOpen} onClose={() => setCreateOpen(false)} />
      <TransferSampleDialog sequenceId={sequenceId} open={transferOpen} onClose={() => setTransferOpen(false)} />
    </>
  );
}

export default SequenceSamplesSection;
