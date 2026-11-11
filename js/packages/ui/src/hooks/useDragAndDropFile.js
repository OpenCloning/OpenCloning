import React from 'react';

export default function useDragAndDropFile() {
  const [isDragging, setIsDragging] = React.useState(false);
  const [files, setFiles] = React.useState([]);

  const handleDragOver = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = React.useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = React.useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setFiles(e.dataTransfer.files);
  }, []);

  const clearFiles = React.useCallback(() => {
    setFiles([]);
  }, []);

  return { handleDragLeave, handleDragOver, handleDrop, isDragging, files, clearFiles };
}
