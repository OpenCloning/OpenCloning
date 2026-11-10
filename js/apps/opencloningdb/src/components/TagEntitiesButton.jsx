import React from 'react';
import { Button } from '@mui/material';
import TagEntitiesDialog from './TagEntitiesDialog';


export default function TagEntitiesButton({ selectedEntities, entityType, label, onSuccess }) {
  const [openDialog, setOpenDialog] = React.useState(false);

  if (selectedEntities.length < 1) {
    return null;
  }

  const handleClose = () => {
    setOpenDialog(false);
  };

  return (
    <>
      <Button
        variant="contained"
        disabled={selectedEntities.length === 0}
        onClick={() => {
          setOpenDialog(true);
        }}
      >
        Tag {label}
      </Button>
      <TagEntitiesDialog selectedEntities={selectedEntities} entityType={entityType} label={label} open={openDialog} onClose={handleClose} onSuccess={onSuccess} />
    </>
  );
}

