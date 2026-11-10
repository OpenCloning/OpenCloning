import { Box, FormControl, FormLabel, InputAdornment, TextField } from '@mui/material';
import React from 'react';

import primerDesignMinimalValues from './primerDesignMinimalValues.json';

function PrimerSettingsForm({
  homology_length, minimal_hybridization_length, target_tm, updateSettings,
}) {
  return (
    <Box sx={{ pt: 1 }}>
      <FormLabel>Primer settings</FormLabel>
      <Box sx={{ pt: 1.5 }}>
        {homology_length !== null && (
        <Box>
          <FormControl>
            <TextField
              label="Homology length"
              value={homology_length}
              onChange={(e) => { updateSettings({ homology_length: Number(e.target.value) }); }}
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                sx: { width: '10em' },
              }}
              error={homology_length < primerDesignMinimalValues.homology_length}
              helperText={homology_length < primerDesignMinimalValues.homology_length ? `Min. ${primerDesignMinimalValues.homology_length} bp` : ''}
            />
          </FormControl>
        </Box>
        )}
        <Box sx={{ pt: 2 }}>
          <FormControl sx={{ mr: 2 }}>
            <TextField
              label="Target hybridization Tm"
              value={target_tm}
              onChange={(e) => { updateSettings({ target_tm: Number(e.target.value) }); }}
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">°C</InputAdornment>,
                sx: { width: '10em' },
              }}
              error={target_tm < primerDesignMinimalValues.target_tm}
              helperText={target_tm < primerDesignMinimalValues.target_tm ? `Min. ${primerDesignMinimalValues.target_tm} °C` : ''}
            />
          </FormControl>

          <FormControl>
            <TextField
              sx={{ minWidth: 'max-content' }}
              label="Min. hybridization length"
              value={minimal_hybridization_length}
              onChange={(e) => { updateSettings({ minimal_hybridization_length: Number(e.target.value) }); }}
              type="number"
              InputProps={{
                endAdornment: <InputAdornment position="end">bp</InputAdornment>,
                sx: { width: '10em' },
              }}
              error={minimal_hybridization_length < primerDesignMinimalValues.hybridization_length}
              helperText={minimal_hybridization_length < primerDesignMinimalValues.hybridization_length ? `Min. ${primerDesignMinimalValues.hybridization_length} bp` : ''}
            />
          </FormControl>
        </Box>
      </Box>
    </Box>
  );
}

export default PrimerSettingsForm;
