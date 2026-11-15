import React from 'react';
import { Tooltip, Box, Typography } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import useDragAndDropFile from '../hooks/useDragAndDropFile';
import LoadCloningHistoryWrapper from './LoadCloningHistoryWrapper';

function DragAndDropCloningHistoryWrapper({ children }) {
  const { isDragging, handleDragLeave, handleDragOver, handleDrop, files: fileList, clearFiles } = useDragAndDropFile();

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragging ? 'dragging-file' : ''} cloning-history`}
      sx={isDragging ? { textAlign: 'center' } : undefined}
    >
      <LoadCloningHistoryWrapper fileList={fileList} clearFiles={clearFiles}>
        {isDragging ? (
          <Box
            className="drag-file-wrapper"
            sx={{ border: 5, borderStyle: 'dashed', borderColor: 'grey.500', borderRadius: '40px', width: '40%', height: 400, p: '10px', mx: 'auto', textAlign: 'center' }}
          >
            <Box className="drag-file-container" sx={{ p: '10px' }}>
              <Box className="drag-file-close" sx={{ textAlign: 'right', color: 'error.main', cursor: 'pointer', '&:hover': { filter: 'brightness(70%)' } }}>
                <Tooltip title="Close (back to cloning)" placement="top">
                  <CancelIcon type="button" onClick={handleDragLeave} className="cancel-icon" sx={{ fontSize: 40 }} />
                </Tooltip>
              </Box>
              <Typography variant="h5" component="h2">Drop multiple sequence files or a single history file</Typography>
              <UploadFile color="primary" sx={{ fontSize: 200 }} />
            </Box>
          </Box>
        ) : (
          children
        )}
      </LoadCloningHistoryWrapper>
    </Box>
  );
}

export default DragAndDropCloningHistoryWrapper;
