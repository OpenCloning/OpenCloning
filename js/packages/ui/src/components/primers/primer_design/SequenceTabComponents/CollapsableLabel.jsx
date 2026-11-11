import React from 'react';
import { Box, FormLabel, IconButton, Collapse } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';

function CollapsableLabel({ label, className, children, open = false }) {
  const [show, setShow] = React.useState(open);

  React.useEffect(() => {
    setShow(open);
  }, [open]);

  return (
    <Box className={className}>
      <Box sx={{ mt: 1 }}>
        <FormLabel>{label}</FormLabel>
        <IconButton
          onClick={() => setShow(!show)}
          aria-expanded={show}
          aria-label="show more"
        >
          <ExpandMoreIcon />
        </IconButton>
      </Box>
      <Collapse in={show}>
        {children}
      </Collapse>
    </Box>
  );
}

export default CollapsableLabel;
