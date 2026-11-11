import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { PersonRemove as PersonRemoveIcon } from '@mui/icons-material';
import { downloadTextFile, prettyPrintJson } from '@opencloning/utils/readNwrite';
import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';
import { setWorkspace } from '../store/authSlice';
import useChangeWorkspace from '../hooks/useChangeWorkspace';
import useAppAlerts from '../hooks/useAppAlerts';
import PageContainer from '../components/PageContainer';
import ConfirmMutationDialog from '../components/ConfirmMutationDialog';
import { error2String } from '@opencloning/utils';

const WORKSPACE_ROLES = ['viewer', 'editor', 'owner'];

function formatRole(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function SectionBox({ title, children }) {
  return (
    <Paper variant="outlined" sx={{ p: 3, mb: 3, maxWidth: 500 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Paper>
  );
}

function CreateWorkspaceSection() {
  const { changeWorkspace } = useChangeWorkspace();
  const { addAlert } = useAppAlerts();
  const [name, setName] = useState('');

  const createMutation = useMutation({
    mutationFn: async (workspaceName) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.postWorkspace, { name: workspaceName });
      return data;
    },
    onSuccess: (data) => {
      changeWorkspace({ id: data.id, name: data.name, role: data.role ?? null });
      setName('');
      addAlert({ message: `Workspace "${data.name}" created and activated`, severity: 'success' });
    },
    onError: () => {
      addAlert({ message: 'Failed to create workspace', severity: 'error' });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(name.trim());
  }

  return (
    <SectionBox title="Create workspace">
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!name.trim() || createMutation.isPending}
        >
          Create
        </Button>
      </Box>
    </SectionBox>
  );
}

function RenameWorkspaceSection() {
  const dispatch = useDispatch();
  const workspace = useSelector((state) => state.auth.workspace);
  const workspaceId = workspace?.id;
  const workspaceName = workspace?.name;
  const { addAlert } = useAppAlerts();
  const [name, setName] = useState(workspaceName ?? '');

  const renameMutation = useMutation({
    mutationFn: async (newName) => {
      const { data } = await openCloningDBHttpClient.patch(endpoints.workspace(workspaceId), { name: newName });
      return data;
    },
    onSuccess: (data) => {
      if (!workspace) return;
      dispatch(setWorkspace({ ...workspace, name: data.name }));
      addAlert({ message: 'Workspace renamed successfully', severity: 'success' });
    },
    onError: () => {
      addAlert({ message: 'Failed to rename workspace', severity: 'error' });
    },
  });

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === workspaceName) return;
    renameMutation.mutate(trimmed);
  }

  return (
    <SectionBox title="Rename current workspace">
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
        <TextField
          label="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={!name.trim() || name.trim() === workspaceName || renameMutation.isPending}
        >
          Rename
        </Button>
      </Box>
    </SectionBox>
  );
}

function WorkspaceMembersSection({ workspaceId }) {
  const queryClient = useQueryClient();
  const currentUserId = useSelector((state) => state.auth.user?.id);
  const { addAlert } = useAppAlerts();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [userToRemove, setUserToRemove] = useState(null);

  const { data: members, isLoading, error } = useQuery({
    queryKey: ['workspaceUsers', workspaceId],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.workspaceUsers(workspaceId));
      return data;
    },
    enabled: Boolean(workspaceId),
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ memberEmail, memberRole }) => {
      const response = await openCloningDBHttpClient.post(endpoints.workspaceUsers(workspaceId), {
        email: memberEmail,
        role: memberRole,
      });
      return response;
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['workspaceUsers', workspaceId] });
      setEmail('');
      const message = response.status === 201 ? 'Member added' : 'Member updated';
      addAlert({ message, severity: 'success' });
    },
    onError: (mutationError) => {
      addAlert({
        message: error2String(mutationError),
        severity: 'error',
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async () => {
      await openCloningDBHttpClient.delete(endpoints.workspaceUser(workspaceId, userToRemove.id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaceUsers', workspaceId] });
      addAlert({ message: `${userToRemove.display_name} removed from workspace`, severity: 'success' });
      setUserToRemove(null);
    },
    onError: (mutationError) => {
      addAlert({
        message: error2String(mutationError),
        severity: 'error',
      });
    },
  });

  function handleAddMember(e) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    addMemberMutation.mutate({ memberEmail: trimmedEmail, memberRole: role });
  }

  return (
    <SectionBox title="Workspace members">
      {isLoading && <CircularProgress size={24} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error2String(error)}
        </Alert>
      )}
      {!isLoading && !error && members?.length > 0 && (
        <List dense disablePadding sx={{ mb: 2 }} data-testid="workspace-members-list">
          {members.map((member) => {
            const isSelf = member.id === currentUserId;
            return (
              <ListItem
                key={member.id}
                disableGutters
                secondaryAction={(
                  <Tooltip title={isSelf ? 'Cannot remove yourself' : 'Remove member'} arrow>
                    <span>
                      <IconButton
                        edge="end"
                        aria-label={`Remove ${member.display_name}`}
                        disabled={isSelf}
                        onClick={() => setUserToRemove(member)}
                        data-testid={`remove-member-${member.id}`}
                      >
                        <PersonRemoveIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              >
                <ListItemText
                  primary={member.display_name}
                  secondary={formatRole(member.role)}
                />
              </ListItem>
            );
          })}
        </List>
      )}
      <Box component="form" onSubmit={handleAddMember} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          size="small"
          sx={{ flex: 1, minWidth: 180 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel id="member-role-label">Role</InputLabel>
          <Select
            labelId="member-role-label"
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {WORKSPACE_ROLES.map((workspaceRole) => (
              <MenuItem key={workspaceRole} value={workspaceRole}>
                {formatRole(workspaceRole)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Alert severity="info" sx={{ my: 2 }}>
          To update a member role (e.g. change from viewer to editor), just add them again with the new role, and it will be updated.
        </Alert>
        <Button
          type="submit"
          variant="contained"
          disabled={!email.trim() || addMemberMutation.isPending}
        >
          Add
        </Button>
      </Box>
      <ConfirmMutationDialog
        open={Boolean(userToRemove)}
        onClose={() => setUserToRemove(null)}
        mutation={removeMemberMutation}
        title="Remove member"
        content={`Remove ${userToRemove?.display_name} from this workspace?`}
        confirmButtonText="Remove"
      />
    </SectionBox>
  );
}

function InviteSection() {
  return (
    <SectionBox title="Invite to workspace">
      <Typography variant="body2" color="text.secondary">
        Invite links are coming soon. Members will be able to join your workspace via a shareable link.
      </Typography>
    </SectionBox>
  );
}

function formatDumpTimestamp(date) {
  return date.toISOString().slice(0, 19);
}

function exportDumpFileName(workspaceName) {
  const safeName = workspaceName.replaceAll('/', '_').replaceAll(' ', '_');
  return `opencloning_db_${safeName}_dump_${formatDumpTimestamp(new Date())}.json`;
}

function ExportWorkspaceSection({workspaceName}) {
  const { addAlert } = useAppAlerts();

  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.export);
      return data;
    },
    onSuccess: (data) => {
      downloadTextFile(prettyPrintJson(data), exportDumpFileName(workspaceName ?? 'workspace'), 'application/json');
      addAlert({ message: 'Workspace exported successfully', severity: 'success' });
    },
    onError: () => {
      addAlert({ message: 'Failed to export workspace', severity: 'error' });
    },
  });

  return (
    <SectionBox title="Export workspace">
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Download a JSON dump of all lines, primers, sequences, tags, and workspace members.
      </Typography>
      <Button
        variant="outlined"
        onClick={() => exportMutation.mutate()}
        disabled={exportMutation.isPending}
      >
        {exportMutation.isPending ? 'Exporting…' : 'Export workspace'}
      </Button>
    </SectionBox>
  );
}

export default function WorkspacePage() {
  const workspace = useSelector((state) => state.auth.workspace);
  const workspaceId = workspace?.id;
  const workspaceRole = workspace?.role;
  const isOwner = workspaceRole === 'owner';

  return (
    <PageContainer>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
        Manage workspaces
      </Typography>
      <CreateWorkspaceSection />
      {isOwner && <RenameWorkspaceSection key={workspaceId ?? 'none'} />}
      {isOwner && workspaceId && (
        <WorkspaceMembersSection key={`members-${workspaceId}`} workspaceId={workspaceId} />
      )}
      {workspaceId && <ExportWorkspaceSection key={`export-${workspaceId}`} workspaceName={workspace?.name} />}
      {isOwner && <InviteSection />}
    </PageContainer>
  );
}
