import React from 'react';
import { useSelector } from 'react-redux';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControl } from '@mui/material';
import { QuerySelect } from '@opencloning/ui';
import { endpoints, openCloningDBHttpClient } from '@opencloning/opencloningdb';
import useChangeWorkspace from '../hooks/useChangeWorkspace';

export default function SwitchWorkspaceDialog({ open, onClose }) {
  const { changeWorkspace } = useChangeWorkspace();
  const currentWorkspaceId = useSelector((state) => state.auth.workspace?.id);
  const [selectedWorkspace, setSelectedWorkspace] = React.useState(null);

  const workspaceQuery = React.useMemo(() => ({
    queryKey: ['workspaces'],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.workspaces);
      return data;
    },
    enabled: open,
  }), [open]);

  function handleSwitchWorkspace() {
    if (!selectedWorkspace) return;

    changeWorkspace(selectedWorkspace);
    onClose();
  }

  function handleClose() {
    setSelectedWorkspace(null);
    onClose();
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>Switch workspace</DialogTitle>
      <DialogContent>
        <FormControl fullWidth sx={{ mt: 1 }}>
          <QuerySelect
            query={workspaceQuery}
            label="Workspace"
            multiple={false}
            autoComplete={false}
            getOptionLabel={(workspace) => workspace.name}
            getOptionKey={(workspace) => workspace.id}
            value={selectedWorkspace}
            onChange={setSelectedWorkspace}
            autocompleteProps={{
              noOptionsText: 'No workspaces available',
            }}
            inputProps={{
              id: 'switch-workspace-select',
            }}
          />
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!selectedWorkspace || selectedWorkspace.id === currentWorkspaceId}
          onClick={handleSwitchWorkspace}
        >
          Switch
        </Button>
      </DialogActions>
    </Dialog>
  );
}
