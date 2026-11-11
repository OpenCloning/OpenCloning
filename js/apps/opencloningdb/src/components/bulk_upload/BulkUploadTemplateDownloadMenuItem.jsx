import React from 'react';
import { ListItemIcon, MenuItem } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

function templateBasename(templatePath) {
  const segments = templatePath.split('/');
  return segments[segments.length - 1] || templatePath;
}

export default function BulkUploadTemplateDownloadMenuItem({
  templatePath,
  downloadFilename,
  label = 'Download template',
  onClose,
}) {
  const filename = downloadFilename ?? templateBasename(templatePath);

  return (
    <MenuItem
      component="a"
      href={templatePath}
      download={filename}
      data-testid="bulk-upload-download-template"
      onClick={onClose}
    >
      <ListItemIcon>
        <DownloadIcon fontSize="small" />
      </ListItemIcon>
      {label}
    </MenuItem>
  );
}
