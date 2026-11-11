import React from 'react';
import { Tooltip } from '@mui/material';
import { UploadFile } from '@mui/icons-material';
import { Cancel as CancelIcon } from '@mui/icons-material';
import useDragAndDropFile from '../hooks/useDragAndDropFile';
import LoadCloningHistoryWrapper from './LoadCloningHistoryWrapper';

function DragAndDropCloningHistoryWrapper({ children }) {
  const { isDragging, handleDragLeave, handleDragOver, handleDrop, files: fileList, clearFiles } = useDragAndDropFile();

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`${isDragging ? 'dragging-file' : ''} cloning-history`}
    >
      <LoadCloningHistoryWrapper fileList={fileList} clearFiles={clearFiles}>
        {isDragging ? (
          <div className="drag-file-wrapper">
            <div className="drag-file-container">
              <div className="drag-file-close">
                <Tooltip arrow title="Close (back to cloning)" placement="top">
                  <CancelIcon type="button" onClick={handleDragLeave} className="cancel-icon" />
                </Tooltip>
              </div>
              <h2>Drop multiple sequence files or a single history file</h2>
              <UploadFile color="primary" sx={{ fontSize: 200 }} />
            </div>
          </div>
        ) : (
          children
        )}
      </LoadCloningHistoryWrapper>
    </div>
  );
}

export default DragAndDropCloningHistoryWrapper;
