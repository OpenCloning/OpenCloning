import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Alert, Button, TextField } from '@mui/material';

import useDatabase from '../../../hooks/useDatabase';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import { isEqual } from 'lodash-es';

function PrimerDatabaseImportForm({ submitPrimer, cancelForm }) {
  const existingNames = useSelector((state) => state.cloning.primers.map((p) => p.name), isEqual);
  const existingDatabaseIds = useSelector((state) => state.cloning.primers.map((p) => p.database_id).filter(Boolean), isEqual);
  const [primer, setPrimer] = useState(null);
  const [error, setError] = useState('');
  const database = useDatabase();

  React.useEffect(() => {
    if (!primer) {
      return;
    }
    if (!primer.name) {
      setError('Primer does not have a name');
    } else if (!primer.sequence) {
      setError('Primer does not have a sequence');
    } else if (stringIsNotDNA(primer.sequence)) {
      setError('Sequence contains invalid characters');
    } else if (existingNames.includes(primer.name)) {
      setError(`A primer with name "${primer.name}" already exists`);
    } else {
      setError('');
    }
  }, [primer]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (primer) {
      submitPrimer(primer);
      setPrimer(null);
    }
  };

  return (
    <form className="primer-row" onSubmit={onSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1em', width: '80%', margin: 'auto' }}>
        <div style={{ display: 'flex', gap: '2em', alignItems: 'center', justifyContent: 'center' }}>
          <database.GetPrimerComponent
            primer={primer}
            setPrimer={setPrimer}
            setError={setError}
            existingDatabaseIds={existingDatabaseIds}
          />
        </div>
        {primer && (
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <TextField
              label="Name"
              value={primer.name}
              className="name"
              disabled
              sx={{ width: '30%' }}
            />
            <TextField
              label="Sequence"
              value={primer.sequence}
              className="sequence"
              disabled
              fullWidth
              InputProps={{
                sx: {
                  fontFamily: 'monospace',
                },
              }}
            />
          </div>
        )}
        {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
        )}

        <div style={{ display: 'flex', gap: '1em', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            color="error"
            onClick={cancelForm}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="primary"
            type="submit"
            disabled={!primer || Boolean(error)}
          >
            Import Primer
          </Button>
        </div>

      </div>

      {primer && (
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '1em' }} />
      )}

    </form>
  );
}

export default PrimerDatabaseImportForm;
