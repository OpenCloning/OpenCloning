import React from 'react';
import { Checkbox, FormControl, FormControlLabel } from '@mui/material';

/**
 * A checkbox with its label, on its own line and left-aligned (the tab panels centre their text)
 *
 * `label` can be text or an element (e.g. LabelWithTooltip). The other props go to MUI's Checkbox.
 */
function CheckboxField({ label, ...checkboxProps }) {
  return (
    <FormControl fullWidth sx={{ textAlign: 'left' }}>
      <FormControlLabel control={<Checkbox {...checkboxProps} />} label={label} />
    </FormControl>
  );
}

export default CheckboxField;
