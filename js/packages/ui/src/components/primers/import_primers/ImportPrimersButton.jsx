import React, { useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Button, Tooltip, Modal, Box } from '@mui/material';
import useCloningAlerts from '../../../hooks/useCloningAlerts';
import './styles.css';

import { primersFromTextFile } from '@opencloning/utils/fileParsers';
import PrimersImportTable from './ImportPrimersTable';

function ImportPrimersButton({ addPrimer }) {
  const { addAlert } = useCloningAlerts();
  const existingNames = useSelector((state) => state.cloning.primers.map((p) => p.name), shallowEqual);

  // Ref to the hidden file input element
  const hiddenFileInput = React.useRef(null);
  const [openModal, setOpenModal] = useState(false);
  const [importedPrimers, setImportedPrimers] = useState([]);
  const importButtonDisabled = importedPrimers.every((primer) => primer.error !== '');

  // Function to simulate click on hidden file input
  const handleUploadClick = () => {
    hiddenFileInput.current.click();
  };

  // Function to handle file selection
  const handleFileUpload = async (event) => {
    const fileUploaded = event.target.files[0];
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
    event.target.value = null;
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
      <Tooltip arrow title={<span style={{ fontSize: '1.4em' }}>Upload a .csv or .tsv file with headers &apos;name&apos; and &apos;sequence&apos;</span>}>
        <Button
          onClick={handleUploadClick}
        >
          Import from file
        </Button>
      </Tooltip>

      <input
        style={{ display: 'none' }}
        type="file"
        accept=".csv,.tsv"
        ref={hiddenFileInput}
        onChange={handleFileUpload}
      />

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
