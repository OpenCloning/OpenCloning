import { Box, Button, Tooltip } from '@mui/material';
import React from 'react';
import { usePrimerDesign } from './PrimerDesignContext';

function ToolTipWrapper({ title, children, enabled = false }) {
  if (enabled) {
    return (
      <Tooltip title={title} placement="top" arrow>
        <span>
          {children}
        </span>
      </Tooltip>
    );
  }
  return children;
}

function StepNavigation({ onStepCompletion, allowStepCompletion, stepCompletionText, isFirstStep = false, nextDisabled = false, nextToolTip = '', stepCompletionToolTip = '' }) {
  const { handleBack, handleNext } = usePrimerDesign();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
      <Button
        color="inherit"
        disabled={isFirstStep}
        onClick={handleBack}
        sx={{ mr: 1 }}
      >
        Back
      </Button>
      <Box sx={{ flex: '1 1 auto' }} />

      <ToolTipWrapper title={stepCompletionToolTip} enabled={!allowStepCompletion}>
        <Button onClick={onStepCompletion} disabled={!allowStepCompletion} sx={{ mr: 1 }}>
          {stepCompletionText}
        </Button>
      </ToolTipWrapper>

      <ToolTipWrapper title={nextToolTip} enabled={nextDisabled}>
        <Button color="inherit" disabled={nextDisabled} onClick={handleNext} sx={{ mr: 1 }}>
          Next
        </Button>
      </ToolTipWrapper>

    </Box>
  );
}

export default StepNavigation;
