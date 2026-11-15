import React, { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Button, Modal, Box, Stack, Typography } from '@mui/material';
import useCloningAlerts from '../../../hooks/useCloningAlerts';

import { primersFromTextFile } from '@opencloning/utils/fileParsers';
import PrimersImportTable from './ImportPrimersTable';
import FileUploadButton from '../../common/FileUploadButton';

function ImportPrimersButton({ addPrimer }) {
  const { addAlert } = useCloningAlerts();
  const existingNames = useSelector((state) => state.cloning.primers.map((p) => p.name), shallowEqual);

  const [openModal, setOpenModal] = useState(false);
  const [importedPrimers, setImportedPrimers] = useState([]);
  const importButtonDisabled = importedPrimers.every((primer) => primer.error !== '');

  const handleFileUpload = async ([fileUploaded]) => {
    try {
      const uploadedPrimers = await primersFromTextFile(fileUploaded, existingNames);
      setImportedPrimers(uploadedPrimers);
      setOpenModal(true);
    } catch (error) {
      addAlert({
        message: error.message,
        severity: 'error',
      });
    }
  };

  const handleImportClick = () => {
    importedPrimers.forEach((primer) => {
      if (primer.error === '') {
        addPrimer({ name: primer.name, sequence: primer.sequence });
      }
    });
    setOpenModal(false);
  };

  return (
    <>
      <FileUploadButton
        onFiles={handleFileUpload}
        accept=".csv,.tsv"
        tooltip={<Box component="span" sx={{ fontSize: '1.4em' }}>Upload a .csv or .tsv file with headers &apos;name&apos; and &apos;sequence&apos;</Box>}
      >
        Import from file
      </FileUploadButton>

      <Modal open={openModal} onClose={() => setOpenModal(false)}>
        <Box
          className="import-primers-modal-content"
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '80%',
            maxWidth: 800,
            maxHeight: '80vh',
            overflow: 'auto',
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 4,
          }}
        >
          <Typography variant="h5" component="h2" sx={{ textAlign: 'center', mb: 2 }}>Import Primers Preview</Typography>

          <PrimersImportTable importedPrimers={importedPrimers} />

          <Stack direction="row" spacing={2} className="import-primers-modal-buttons" sx={{ justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              color="error"
              onClick={() => setOpenModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="primary"
              disabled={importButtonDisabled}
              onClick={handleImportClick}
            >
              Import Valid Primers
            </Button>
          </Stack>
        </Box>
      </Modal>
    </>
  );
}

export default ImportPrimersButton;
