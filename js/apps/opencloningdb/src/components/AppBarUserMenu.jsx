import React, { useState } from 'react';
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import { Logout as LogoutIcon, Person as PersonIcon, SwapHoriz as SwapHorizIcon, ManageAccounts as ManageAccountsIcon } from '@mui/icons-material';

export default function AppBarUserMenu({ userName, workspaceName, onLogout, onSwitchWorkspaceClick, onManageWorkspacesClick }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function handleOpen(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  return (
    <>
      <Tooltip title="Account">
        <IconButton color="inherit" data-testid="opencloningdb-appbar-account" onClick={handleOpen} sx={{ borderRadius: 2, px: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 30, height: 30 }}>
              <PersonIcon fontSize="small" />
            </Avatar>
            <Box sx={{ textAlign: 'left', lineHeight: 1.1 }}>
              <Typography variant="body2" sx={{ color: 'white' }}>
                {userName}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                {workspaceName}
              </Typography>
            </Box>
          </Box>
        </IconButton>
      </Tooltip>

      <Menu anchorEl={anchorEl} open={open} onClose={handleClose} onClick={handleClose}>
        <MenuItem
          onClick={() => {
            handleClose();
            onManageWorkspacesClick();
          }}
        >
          <ListItemIcon>
            <ManageAccountsIcon fontSize="small" />
          </ListItemIcon>
          Manage workspaces
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onSwitchWorkspaceClick();
          }}
        >
          <ListItemIcon>
            <SwapHorizIcon fontSize="small" />
          </ListItemIcon>
          Switch workspaces
        </MenuItem>
        <MenuItem
          onClick={() => {
            handleClose();
            onLogout();
          }}
        >
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Sign out
        </MenuItem>
      </Menu>
    </>
  );
}
