import React from 'react';
import { Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel } from '@mui/material';
import useDatabase from '../../hooks/useDatabase';
import { sequencingFileExtensions } from '@opencloning/utils/sequencingFileExtensions';

function LoadFromDatabaseButton({ databaseId, onFileChange, setError, existingFileNames }) {
  const database = useDatabase();
  const [open, setOpen] = React.useState(false);
  const [files, setFiles] = React.useState([]);
  const [selectedFiles, setSelectedFiles] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setSelectedFiles([]);
  }, [open]);

  const handleSubmit = async () => {
    setOpen(false);
    try {
      const filesToLoad = await Promise.all(selectedFiles.map((file) => files.find((f) => f.name === file).getFile()));
      onFileChange(filesToLoad);
    } catch (error) {
      setError(error.message);
    }
  };

  React.useEffect(() => {
    async function getFiles() {
      setLoading(true);
      const allFiles = await database.getSequencingFiles(databaseId);
      if (database.autoloadSequencingFiles) {
        const filesToLoad = await Promise.all(allFiles.map((file) => file.getFile()));
        onFileChange(filesToLoad);
        setOpen(false);
      } else {
        setFiles(allFiles.filter((file) => sequencingFileExtensions.includes(file.name.toLowerCase().split('.').pop())));
      }
      setLoading(false);
    }
    if (open) {
      getFiles();
    }
  }, [open]);


  return (
    <>
      <Button
        variant="contained"
        onClick={() => setOpen(true)}
      >
        {`Load from ${database.name}`}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Select sequencing files to load</DialogTitle>
        <DialogContent>
          {loading && <CircularProgress />}
          {!loading && files.length > 0 && (
            <div>
              {files.map((file, index) => (
                <div key={file.name}>
                  <FormControlLabel
                    control={(
                      <Checkbox
                        disabled={existingFileNames.includes(file.name)}
                        checked={selectedFiles.includes(file.name) || existingFileNames.includes(file.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFiles([...selectedFiles, file.name]);
                          } else {
                            setSelectedFiles(selectedFiles.filter((f) => f !== file.name));
                          }
                        }}
                      />
                    )}
                    label={file.name}
                  />
                </div>
              ))}
            </div>
          )}
          {!loading && files.length === 0 && (
            <DialogContentText>
              No sequencing files found in the database.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="error" onClick={() => setOpen(false)}>Cancel</Button>
          <Button color="primary" onClick={handleSubmit}>Load</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default LoadFromDatabaseButton;
