import React from 'react';

// Inactive panels are hidden instead of unmounted, so their content keeps its state when switching tabs
function TabPanel({ children, value, index, ...other }) {
  const style = value === index ? {
    visibility: 'visible',

  } : {
    visibility: 'hidden',
    position: 'absolute',
    width: '1px',
    height: '0px',
    overflow: 'hidden',
  };

  return (
    <div
      role="tabpanel"
      style={style}
      id={`tab-panel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {children}
    </div>
  );
}

export default TabPanel;
