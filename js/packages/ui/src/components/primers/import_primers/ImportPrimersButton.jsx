import React, { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Button, Modal, Box } from '@mui/material';
import useCloningAlerts from '../../../hooks/useCloningAlerts';
import './styles.css';

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
        tooltip={<span style={{ fontSize: '1.4em' }}>Upload a .csv or .tsv file with headers &apos;name&apos; and &apos;sequence&apos;</span>}
      >
        Import from file
      </FileUploadButton>

      <Modal open={openModal} onClose={() => setOpenModal(false)}>
        <Box className="import-primers-modal-content">
          <h2 style={{ textAlign: 'center' }}>Import Primers Preview</h2>

          <PrimersImportTable importedPrimers={importedPrimers} />

          <Box className="import-primers-modal-buttons">
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
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default ImportPrimersButton;
