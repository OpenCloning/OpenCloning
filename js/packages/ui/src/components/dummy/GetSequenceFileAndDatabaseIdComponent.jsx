import { MenuItem, TextField } from '@mui/material';
import React from 'react';

function GetSequenceFileAndDatabaseIdComponent({ setFile, setDatabaseId }) {
  // This component is rendered inside of SourceDatabase.jsx, and must contain
  // a form that lets the user select an entry from the database. Once setFile
  // and setDatabaseId are set within this form, the submit button will be shown in
  // SourceDatabase.jsx. The file can be a sequence file or a json file with the history.
  const [selectedEntry, setSelectedEntry] = React.useState(null);
  // Somehow get the entries from the database, could also be gb files, etc.
  const entries = [
    {
      id: 1,
      name: 'seq1.fasta', // File extension is important, will determine how it's parsed
      fileContent: '>seq1\nATCG\n',
    },
    {
      id: 2,
      name: 'seq2.fasta',
      fileContent: '>seq2\nATCG\n',
    },
    {
      id: 3,
      name: 'seq3.fasta',
      fileContent: '>seq3\nATCG\n',
    },
  ];

  const handleFileSelect = (e) => {
    const selectedId = e.target.value;
    const entry = entries.find((e) => e.id === selectedId);
    setSelectedEntry(entry);
    // When you set databaseId and file, the submit button will be shown (see SourceDatabase.jsx)
    setFile(new File([entry.fileContent], entry.name, { type: 'text/plain' }));
    setDatabaseId(entry.id);
  };

  return (
    <div>
      {/* You probably need more than one form field */}
      <TextField
        select
        label="Select Sequence"
        value={selectedEntry?.id || ''}
        onChange={(e) => handleFileSelect(e)}
        fullWidth
        variant="outlined"
      >
        {entries.map((entry) => (
          <MenuItem key={entry.id} value={entry.id}>
            {entry.name}
          </MenuItem>
        ))}
      </TextField>
    </div>
  );
}

export default GetSequenceFileAndDatabaseIdComponent;
