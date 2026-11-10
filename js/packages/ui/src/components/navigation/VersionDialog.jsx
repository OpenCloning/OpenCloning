import { Dialog, DialogContent, DialogTitle, List, ListItem, ListItemText } from '@mui/material';
import React from 'react';
import { useSelector } from 'react-redux';
import { isEqual } from 'lodash-es';

function VersionDialog({ open, setOpen }) {
  const { backendVersion, schemaVersion, frontendVersion } = useSelector(({ cloning }) => cloning.appInfo, isEqual);

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      className="version-dialog"
    >
      <DialogTitle sx={{ textAlign: 'center' }}> App version </DialogTitle>
      <DialogContent>
        <List>
          <ListItem fullWidth>
            <ListItemText primary="Frontend" secondary={frontendVersion || 'N.A.'} />
          </ListItem>
          <ListItem fullWidth>
            <ListItemText primary="Backend" secondary={backendVersion || 'N.A.'} />
          </ListItem>
          <ListItem fullWidth>
            <ListItemText primary="Schema" secondary={schemaVersion || 'N.A.'} />
          </ListItem>
        </List>
      </DialogContent>
    </Dialog>
  );
}

export default VersionDialog;
