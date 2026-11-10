import React, { useState } from 'react';
import { Button, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import { UploadFile as UploadFileIcon } from '@mui/icons-material';
import BulkUploadTemplateDownloadMenuItem from './BulkUploadTemplateDownloadMenuItem';

const menuId = 'bulk-upload-menu';

export default function BulkUploadMenuButton({
  label,
  tooltip,
  dataTestId,
  onUploadClick,
  templatePath,
  uploadLabel = 'Upload file',
  downloadLabel = 'Download template',
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  function handleOpen(event) {
    setAnchorEl(event.currentTarget);
  }

  function handleClose() {
    setAnchorEl(null);
  }

  function handleUpload() {
    handleClose();
    onUploadClick();
  }

  return (
    <>
      <Tooltip arrow title={tooltip}>
        <Button
          onClick={handleOpen}
          data-testid={dataTestId}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          aria-controls={open ? menuId : undefined}
          variant="outlined"
        >
          {label}
        </Button>
      </Tooltip>

      <Menu
        id={menuId}
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
      >
        <MenuItem onClick={handleUpload} data-testid="bulk-upload-upload-file">
          <ListItemIcon>
            <UploadFileIcon fontSize="small" />
          </ListItemIcon>
          {uploadLabel}
        </MenuItem>
        <BulkUploadTemplateDownloadMenuItem
          templatePath={templatePath}
          label={downloadLabel}
          onClose={handleClose}
        />
      </Menu>
    </>
  );
}
