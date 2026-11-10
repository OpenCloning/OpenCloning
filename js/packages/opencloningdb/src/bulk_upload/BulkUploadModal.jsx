import React from 'react';
import { Box, Modal, Typography } from '@mui/material';

/** Modal used by the bulk upload previews. Pass onClose undefined to prevent closing it (e.g. while submitting). */
export default function BulkUploadModal({
  open,
  onClose,
  title,
  dataTestId,
  children,
}) {
  const titleId = React.useId();
  return (
    <Modal open={open} onClose={onClose} aria-labelledby={titleId}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={dataTestId}
        sx={{
          bgcolor: 'background.paper',
          p: 3,
          width: 'min(1280px, 98vw)',
          maxHeight: '90vh',
          overflow: 'hidden',
          mx: 'auto',
          my: '5vh',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography id={titleId} variant="h6" sx={{ mb: 1, textAlign: 'center' }}>
          {title}
        </Typography>
        {children}
      </Box>
    </Modal>
  );
}
