import React from 'react';
import { useSelector } from 'react-redux';
import { Alert, Box, Typography } from '@mui/material';
import { getSubState } from '@opencloning/utils/network';

function PrimersNotInDatabaseComponent({ id, submissionData, setSubmissionData }) {
  const primers = useSelector((state) => {
    const subState = getSubState(state, id, true);
    return subState.primers.filter((p) => !p.database_id);
  });

  if (primers.length === 0) return null;

  return (
    <Alert
      severity="info"
      sx={{
        marginTop: 2,
        paddingY: 1,
        width: '100%',
        '& .MuiAlert-message': {
          width: '100%',
        },
      }}
      icon={false}
    >
      <Box>
        <Typography>The below primers will be saved to the database, consider changing their name in the primer tab</Typography>
        <ul>
          {primers.map((primer) => (
            <li key={primer.id}>{primer.name}</li>
          ))}
        </ul>
      </Box>

    </Alert>
  );
}

export default PrimersNotInDatabaseComponent;
