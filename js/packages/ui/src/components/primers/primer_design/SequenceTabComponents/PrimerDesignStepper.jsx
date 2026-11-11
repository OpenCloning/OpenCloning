import { Step, StepButton, Stepper } from '@mui/material';
import React from 'react';
import { usePrimerDesign } from './PrimerDesignContext';

function PrimerDesignStepper() {
  const { steps, selectedTab, onTabChange, rois, primers, submissionPreventedMessage } = usePrimerDesign();

  const allSteps = [
    ...steps,
    { label: 'Other settings' },
    { label: 'Results' },
  ];
  const completedSteps = [
    ...rois.map((roi) => roi !== null),
    // We check submissionPreventedMessage, because you could design primers and then come back
    // and have bad settings
    primers.length > 0 && submissionPreventedMessage === '',
    false,
  ];
  const disabledSteps = [
    ...rois.map(() => false),
    rois.some((roi) => roi === null),
    primers.length === 0,
  ];

  return (
    <Stepper
      nonLinear
      activeStep={selectedTab}
      sx={{
        pt: 1,
        pb: 1,
        '& .Mui-active.MuiStepLabel-label': {
          fontWeight: 'bold',
          color: 'primary.main',
        },

      }}
    >
      {allSteps.map(({ label }, index) => (

        <Step key={label} completed={!disabledSteps[index] && completedSteps[index]}>
          <StepButton disabled={disabledSteps[index]} onClick={() => onTabChange(null, index)}>
            {label}
          </StepButton>
        </Step>
      ))}

    </Stepper>
  );
}

export default PrimerDesignStepper;
