import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { SequencingCheckModal } from '@opencloning/opencloningdb';
import { SequenceLink } from './EntityLinks';

const renderSequenceName = (sequence) => <SequenceLink id={sequence.databaseId} name={sequence.name} newTab />;

export default function CheckSequencingButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Tooltip arrow title={<span style={{ fontSize: '1.2em' }}>Compare sequences in bulk to their sequencing files</span>}>
        <Button variant="outlined" onClick={() => setOpen(true)} data-testid="check-sequencing-button">
          Check sequencing
        </Button>
      </Tooltip>
      <SequencingCheckModal open={open} onClose={() => setOpen(false)} renderSequenceName={renderSequenceName} />
    </>
  );
}
