import { Alert } from '@mui/material';
import React from 'react';

function NoAttPSitesError({ sites }) {
  return (
    <Alert severity="error" icon={false}>
      <p>
        At least two attP sites are required.
      </p>
      {sites.length === 0 && <p>No att sites of any type were found.</p>}
      {sites.length > 0 && (
      <>
        <p style={{ marginBottom: '10px' }}>
          We found the following sites:
        </p>

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
