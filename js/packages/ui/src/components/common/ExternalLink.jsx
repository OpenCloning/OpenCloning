import React from 'react';
import { Link } from '@mui/material';

/**
 * A link that opens in a new tab, without giving the new page access to this one
 *
 * Takes the props of MUI's Link (e.g. `color="inherit" underline="none"` inside a button or a menu item).
 */
function ExternalLink({ href, children, ...props }) {
  return (
    <Link href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </Link>
  );
}

export default ExternalLink;
