import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { SequencingCheckModal } from '@opencloning/opencloningdb';
import { SequenceLink } from './EntityLinks';
import ButtonTooltipText from './ButtonTooltipText';

const renderSequenceName = (sequence) => <SequenceLink id={sequence.databaseId} name={sequence.name} newTab />;

export default function CheckSequencingButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Tooltip title={<ButtonTooltipText>Compare sequences in bulk to their sequencing files</ButtonTooltipText>}>
        <Button variant="outlined" onClick={() => setOpen(true)} data-testid="check-sequencing-button">
          Check sequencing
        </Button>
      </Tooltip>
      <SequencingCheckModal open={open} onClose={() => setOpen(false)} renderSequenceName={renderSequenceName} />
    </>
  );
}
