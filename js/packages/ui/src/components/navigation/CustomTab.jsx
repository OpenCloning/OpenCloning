import { Tab } from '@mui/material';
import React from 'react';

// Tab linked to its TabPanel (same index) for accessibility. Extra props must be passed on to Tab,
// since Tabs controls its tabs through props (selected, value, onChange...).
function CustomTab({ label, index, ...other }) {
  return (
    <Tab
      label={label}
      id={`tab-${index}`}
      aria-controls={`tab-panel-${index}`}
      {...other}
    />
  );
}

export default CustomTab;
