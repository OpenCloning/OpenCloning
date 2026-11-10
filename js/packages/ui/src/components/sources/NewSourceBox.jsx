import React from 'react';
import { AddCircle as AddCircleIcon } from '@mui/icons-material';
import { Tooltip, IconButton } from '@mui/material';
import { useDispatch } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';

// A component that is rendered on the side of the tree to add a new source
function NewSourceBox({ inputSequencesIds = [] }) {
  const dispatch = useDispatch();
  const { addEmptySource } = cloningActions;
  const onClick = () => {
    dispatch(addEmptySource(inputSequencesIds));
    // Scroll to the right to see new source
    if (inputSequencesIds.length === 0) {
      setTimeout(() => {
        const tabPanelsContainer = document.querySelector('.tab-panels-container');
        if (tabPanelsContainer) {
          tabPanelsContainer.scrollTo({
            left: tabPanelsContainer.scrollWidth,
            behavior: 'instant',
          });
        }
      }, 100);
    }
  };
  const tooltipText = <div className="tooltip-text">Add source</div>;
  return (
    <IconButton type="submit" sx={{ height: 'fit-content' }} onClick={onClick}>
      <Tooltip title={tooltipText} arrow placement="bottom">
        <AddCircleIcon sx={{ fontSize: '1.8em' }} className="node-corner-icon" color="success" />
      </Tooltip>
    </IconButton>
  );
}

export default NewSourceBox;
