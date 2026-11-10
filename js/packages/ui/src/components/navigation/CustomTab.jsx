import { Tab } from '@mui/material';
import React from 'react';

const CustomTab = React.forwardRef(({ label, index, ...other }, ref) => (
  <Tab
    label={label}
    id={`tab-${index}`}
    aria-controls={`tab-panel-${index}`}
    ref={ref}
    {...other}
  />
));

export default CustomTab;
