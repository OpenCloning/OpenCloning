import React, { useCallback, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  CircularProgress,
  Alert,
} from '@mui/material';
import { batch, shallowEqual, useDispatch, useSelector, useStore } from 'react-redux';
import { isEqual } from 'lodash-es';
import { getTeselaJsonFromBase64, file2base64 } from '@opencloning/utils/readNwrite';
import SequencingFileRow from './SequencingFileRow';
import { cloningActions } from '@opencloning/store/cloning';
import useStoreEditor from '../../hooks/useStoreEditor';
import LoadFromDatabaseButton from './LoadFromDatabaseButton';
import { sequencingFileExtensions } from '@opencloning/utils/sequencingFileExtensions';
import useBackendHttpClient from '../../hooks/useBackendHttpClient';
import { getVerificationFileName } from '@opencloning/utils/readNwrite';
import {
  getVerificationFileContent,
  setVerificationFileContent,
} from '@opencloning/utils/verificationFileStore';
import ImportSequencingFilesInput from './ImportSequencingFilesInput';

const { addFile, removeFile: removeFileAction, removeFilesAssociatedToSequence, setMainSequenceId, setCurrentTab } = cloningActions;

export default function VerificationFileDialog({ id, dialogOpen, setDialogOpen }) {
  const fileNames = useSelector((state) => state.cloning.files.filter((f) => (f.sequence_id === id)).map((f) => f.file_name), shallowEqual);
  const fileTypes = useSelector((state) => state.cloning.files.filter((f) => (f.sequence_id === id)).map((f) => f.file_type), shallowEqual);
  const hasSequencingFile = fileTypes.includes('Sequencing file');
  const databaseId = useSelector((state) => state.cloning.sources.find((s) => s.id === id)?.database_id, isEqual);

  const sequence = useSelector((state) => state.cloning.sequences.find((e) => e.id === id), shallowEqual);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const dispatch = useDispatch();
  const fileInputRef = useRef(null);
  const { updateStoreEditor } = useStoreEditor();
  const store = useStore();
  const httpClient = useBackendHttpClient();

  const toggleMain = React.useCallback(() => {
    dispatch(setMainSequenceId(id));
    dispatch(setCurrentTab(3));
    updateStoreEditor('mainEditor', id);
    // TODO: ideally this should be done with a ref
    document.getElementById('opencloning-app-tabs')?.scrollIntoView();
  }, [id, dispatch, updateStoreEditor]);

  const handleFileUpload = useCallback(async (newFiles) => {
    // Clear the input
    fileInputRef.current.value = '';
    if (newFiles.some((file) => !sequencingFileExtensions.includes(file.name.toLowerCase().split('.').pop()))) {
      throw new Error(`Only ${sequencingFileExtensions.join(', ')} files are accepted`);
    }

    // Read the new sequencing files
    const parsedSequencingFiles = await Promise.all(newFiles.map(async (newFile) => {
      const base64str = await file2base64(newFile);
      return {
        sequence_id: id,
        trace: (await getTeselaJsonFromBase64(base64str, newFile.name)).sequence,
        base64str,
        file_name: newFile.name,
        file_type: 'Sequencing file',
      };
    }));

    // Read the existing sequencing files
    const existingSequencingFilesInState = await Promise.all(store.getState().cloning.files
      .filter((f) => f.sequence_id === id && f.file_type === 'Sequencing file')
      .map(async (f) => {
        const base64str = getVerificationFileContent(getVerificationFileName(f));
        const trace = (await getTeselaJsonFromBase64(base64str, f.file_name)).sequence;
        return { ...f, base64str, trace };
      }));

    // Throw an error if repeated files are found
    const existingSequencingFilesInStateNames = existingSequencingFilesInState.map((f) => f.file_name);
    const repeatedFile = parsedSequencingFiles.find((f) => existingSequencingFilesInStateNames.includes(f.file_name));
    if (repeatedFile) {
      throw new Error(`A file named ${repeatedFile.file_name} is already associated to this sequence`);
    }

    // We have to align all again to have a common reference
    const allSequencingFiles = [...existingSequencingFilesInState, ...parsedSequencingFiles];
    const alignments = [];
    const traces = allSequencingFiles.map((f) => f.trace);
    const resp = await httpClient.post('align_sanger', { sequence, traces });

    for (let i = 0; i < allSequencingFiles.length; i++) {
      alignments.push({ ...allSequencingFiles[i], alignment: [resp.data[0], resp.data[i + 1]] });
    }

    // Add the files to the store
    batch(() => {
      dispatch(removeFilesAssociatedToSequence(id));
      alignments.forEach((alignment) => {
        const { trace, base64str, ...rest } = alignment;
        dispatch(addFile(rest));
      });
      alignments.forEach(({ base64str, file_name }) => { setVerificationFileContent(`verification-${id}-${file_name}`, base64str); });
    });
    setLoadingMessage('');
  }, [id, dispatch, httpClient, store, sequence]);

  const onFileChange = useCallback(async (files) => {
    setLoadingMessage('Aligning...');
    setError('');
    try {
      await handleFileUpload(files);
      setLoadingMessage('');
    } catch (e) {
      setError(e.message);
      setLoadingMessage('');
    }
  }, [handleFileUpload]);

  const removeFile = useCallback((fileName) => {
    dispatch(removeFileAction({ fileName, sequenceId: id }));
  }, [id, dispatch]);

  const handleClickUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const downloadFile = useCallback((fileName) => {
    const base64Content = getVerificationFileContent(`verification-${id}-${fileName}`);
    if (!base64Content) {
      setError(`File ${fileName} not found in the verification file store`);
      return;
    }
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const file = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [id]);

  return (
    <Dialog
      open={dialogOpen}
      onClose={() => setDialogOpen(false)}
      className="verification-file-dialog"
      maxWidth="md"
      fullWidth
      sx={{ textAlign: 'center' }}
    >
      <DialogTitle>Verification files</DialogTitle>
      <DialogContent>
        <ImportSequencingFilesInput onFileChange={onFileChange} fileInputRef={fileInputRef} />

        {loadingMessage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', my: 2 }}>
            <CircularProgress />
            <Box sx={{ ml: 2, fontSize: '1.2rem' }}>{loadingMessage}</Box>
          </Box>
        )}

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>File Name</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fileNames.map((fileName) => (
                <SequencingFileRow
                  key={fileName}
                  id={id}
                  fileName={fileName}
                  removeFile={removeFile}
                  downloadFile={downloadFile}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {error && (
          <Box sx={{ mt: 2 }}>
            <Alert severity="error">
              {error}
            </Alert>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
          <Button
            variant="contained"
            onClick={handleClickUpload}
          >
            Submit files
          </Button>

          {databaseId && (
            <LoadFromDatabaseButton
              existingFileNames={fileNames}
              databaseId={databaseId}
              onFileChange={onFileChange}
            />
          )}

          {hasSequencingFile && (
            <Button
              variant="contained"
              onClick={() => { setDialogOpen(false); toggleMain(); }}
              color="success"
            >
            See alignments in editor
            </Button>
          )}
        </Box>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
