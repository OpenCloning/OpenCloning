import { Accordion, AccordionDetails, AccordionSummary, FormControl, InputLabel, ListItemText, MenuItem, Select, Tooltip } from '@mui/material';
import React from 'react';
import { useDispatch } from 'react-redux';
import { ExpandMore as ExpandMoreIcon, Cancel as CancelIcon } from '@mui/icons-material';
import { cloningActions } from '@opencloning/store/cloning';
import SingleInputSelector from './SingleInputSelector';
import SelectPrimerForm from '../primers/SelectPrimerForm';

function PCRUnitWrapper({ index, children, onDelete }) {
  if (index === null) {
    return (
      <div className="pcr-unit">
        {children}
      </div>
    );
  }

  return (
    // Rounded, and more compact than MUI's default (which also adds margins when expanded)
    <Accordion
      className="pcr-unit"
      defaultExpanded
      sx={{
        borderRadius: '1.2em',
        overflow: 'clip',
        mb: '.5em',
        '&:first-of-type, &:last-of-type': { borderRadius: '1.2em' },
        '&.Mui-expanded': { mb: '.5em' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${index}-content`}
        id={`${index}-header`}
        sx={{ backgroundColor: 'grey.300', minHeight: 0, '&.Mui-expanded': { minHeight: 0 } }}
        slotProps={{ content: { sx: { my: '.35em', '&.Mui-expanded': { my: '.35em' } } } }}
      >
        {(index !== 0) && (
        <Tooltip onClick={onDelete} title="Delete primer pair" placement="left">
          <CancelIcon color="action" />
        </Tooltip>
        )}
        <ListItemText sx={{ my: 0 }}>
          Primer pair
          {' '}
          {index + 1}
        </ListItemText>
      </AccordionSummary>
      <AccordionDetails sx={{ py: 0, my: 1 }}>
        {children}
      </AccordionDetails>
    </Accordion>
  );
}

function PCRUnitForm({ primers, forwardPrimerId, reversePrimerId, onChangeForward, onChangeReverse, sourceId, sourceInput = [], index = null, deletePrimerPair = null }) {
  const { setCurrentTab, updateSource } = cloningActions;
  const dispatch = useDispatch();
  const goToPrimerTab = () => {
    dispatch(setCurrentTab(1));
  };

  const updateInput = (value) => {
    if (index !== null) {
      const newInput = [...sourceInput];
      newInput[index] = value;
      dispatch(updateSource({ id: sourceId, input: newInput }));
    }
  };

  const onDelete = () => {
    if (index !== null) {
      const newInput = [...sourceInput];
      newInput.splice(index, 1);
      deletePrimerPair();
      dispatch(updateSource({ id: sourceId, input: newInput }));
    }
  };

  return (
    <PCRUnitWrapper index={index} key={index && `pcr-unit-${index}`} onDelete={onDelete}>
      {(index !== null) ? (
        <FormControl fullWidth>
          <SingleInputSelector
            label="Target sequence"
            selectedId={sourceInput[index]?.sequence || ''}
            onChange={(e) => updateInput({ sequence: e.target.value })}
            inputSequenceIds={sourceInput.map(({sequence}) => sequence)}
            disabled={index === 0}
          />
        </FormControl>
      ) : null}

      <SelectPrimerForm
        primers={primers}
        selected={forwardPrimerId}
        onChange={onChangeForward}
        goToPrimerTab={goToPrimerTab}
        label="Forward primer"
      />
      <SelectPrimerForm
        primers={primers}
        selected={reversePrimerId}
        onChange={onChangeReverse}
        goToPrimerTab={goToPrimerTab}
        label="Reverse primer"
      />
    </PCRUnitWrapper>
  );
}

export default PCRUnitForm;
