import React from 'react';
import { Alert } from '@mui/material';
import SubmitButtonBackendAPI from '../form/SubmitButtonBackendAPI';
import useDatabase from '../../hooks/useDatabase';
import useLoadDatabaseFile from '../../hooks/useLoadDatabaseFile';

function SourceDatabase({ source, requestStatus, sendSourceRequest }) {
  const [file, setFile] = React.useState(null);
  const [databaseId, setDatabaseId] = React.useState(null);
  const database = useDatabase();
  const [historyFileError, setHistoryFileError] = React.useState(null);
  const { loadDatabaseFile } = useLoadDatabaseFile({ source, sendSourceRequest, setHistoryFileError });

  const onSubmit = async (e) => {
    e.preventDefault();
    loadDatabaseFile(file, databaseId);
  };

  return (
    <form onSubmit={onSubmit}>
      {database && <database.GetSequenceFileAndDatabaseIdComponent setFile={setFile} setDatabaseId={setDatabaseId} />}
      {historyFileError && <Alert severity="error">{historyFileError}</Alert>}
      {file && databaseId && <SubmitButtonBackendAPI requestStatus={requestStatus}>Submit </SubmitButtonBackendAPI>}
    </form>
  );
}

export default SourceDatabase;
