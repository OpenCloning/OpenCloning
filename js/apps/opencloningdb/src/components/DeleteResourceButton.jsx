import React from 'react';
import { Button, Tooltip } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';

import ConfirmMutationDialog from './ConfirmMutationDialog';

function DeleteResourceButton({
  mutation,
  disabledReason,
  buttonLabel,
  confirmTitle,
  confirmContent,
  confirmButtonText = 'Confirm delete',
  dataTestId,
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const isDisabled = Boolean(disabledReason);

  return (
    <>
      <Tooltip title={disabledReason ?? ''} arrow placement="right">
        <span>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setIsOpen(true)}
            disabled={isDisabled}
            data-testid={dataTestId}
          >
            {buttonLabel}
          </Button>
        </span>
      </Tooltip>
      <ConfirmMutationDialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        mutation={mutation}
        title={confirmTitle}
        content={confirmContent}
        confirmButtonText={confirmButtonText}
      />
    </>
  );
}

export default DeleteResourceButton;
