import { Alert, Typography } from '@mui/material';
import React from 'react';

function NoAttPSitesError({ sites }) {
  return (
    <Alert severity="error" icon={false}>
      <Typography variant="inherit">
        At least two attP sites are required.
      </Typography>
      {sites.length === 0 && <Typography variant="inherit">No att sites of any type were found.</Typography>}
      {sites.length > 0 && (
      <>
        <Typography variant="inherit" sx={{ mb: 1 }}>
          We found the following sites:
        </Typography>

        {sites.map((site) => (
          <div key={site.siteName}>
            {site.siteName}
            {' '}
            {site.location}
          </div>
        ))}

      </>
      )}
    </Alert>
  );
}

export default NoAttPSitesError;
