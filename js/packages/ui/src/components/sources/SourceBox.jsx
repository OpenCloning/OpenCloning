import React, { useState } from 'react';
import { useDispatch, useStore } from 'react-redux';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { cloningActions } from '@opencloning/store/cloning';
import VerifyDeleteDialog from './VerifyDeleteDialog';
import useStoreEditor from '../../hooks/useStoreEditor';
import { isSequenceInputOfAnySource } from '@opencloning/store/cloning_utils';

const { deleteSourceAndItsChildren, setMainSequenceId } = cloningActions;

function SourceBox({ children, sourceId }) {
  const dispatch = useDispatch();
  const [dialogOpen, setDialogOpen] = useState(false);
  const store = useStore();
  const { updateStoreEditor } = useStoreEditor();

  const tooltipText = <div className="tooltip-text">Delete source and children</div>;

  const deleteSource = () => {
    const { mainSequenceId, sources } = store.getState().cloning;
    const source = sources.find((s) => s.id === sourceId);
    dispatch(deleteSourceAndItsChildren(sourceId));
    if (mainSequenceId && mainSequenceId === sourceId) {
      updateStoreEditor('mainEditor', null);
      dispatch(setMainSequenceId(null));
    }
  };
  const onClickDeleteSource = () => {
    const state = store.getState().cloning;
    if (isSequenceInputOfAnySource(sourceId, state.sources)) {
      setDialogOpen(true);
    } else {
      deleteSource();
    }
  };
  return (
    <Box className="select-source" sx={{ width: 275, '& .MuiFormControl-root': { my: '5px' } }}>
      <Box className="icon-corner" sx={{ position: 'absolute', top: 0, right: 0 }}>
        <Tooltip title={tooltipText} placement="top">
          <IconButton
            aria-label="Delete source and children"
            color="error"
            onClick={onClickDeleteSource}
            sx={{ p: 0, '&:hover': { bgcolor: 'transparent', filter: 'brightness(70%)' } }}
          >
            <DeleteIcon fontSize="medium" />
          </IconButton>
        </Tooltip>
      </Box>
      <VerifyDeleteDialog
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        onClickDelete={() => {
          deleteSource();
          setDialogOpen(false);
        }}
      />
      {children}
    </Box>
  );
}

export default React.memo(SourceBox);
