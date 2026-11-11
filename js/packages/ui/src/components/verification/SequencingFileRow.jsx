import React from 'react';
import { Delete as DeleteIcon, Download as DownloadIcon } from '@mui/icons-material';
import {
  TableCell,
  TableRow,
  IconButton,
} from '@mui/material';
import { useSelector } from 'react-redux';

function SequencingFileRow({ id, fileName, removeFile, downloadFile }) {
  const fileType = useSelector((state) => state.cloning.files.find((f) => f.file_name === fileName && f.sequence_id === id).file_type);

  return (
    <TableRow>
      <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={() => removeFile(fileName)}>
          <DeleteIcon />
        </IconButton>
        <IconButton onClick={() => downloadFile(fileName)} color="primary">
          <DownloadIcon />
        </IconButton>
      </TableCell>
      <TableCell>
        {fileName}
      </TableCell>
      <TableCell>
        {fileType}
      </TableCell>
    </TableRow>
  );
}

export default SequencingFileRow;
