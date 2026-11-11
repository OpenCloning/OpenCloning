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
    <Accordion className="pcr-unit" defaultExpanded>
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`${index}-content`}
        id={`${index}-header`}
        sx={{ backgroundColor: 'lightgray' }}
      >
        {(index !== 0) && (
        <Tooltip onClick={onDelete} title="Delete primer pair" arrow placement="left">
          <CancelIcon color="gray" />
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
