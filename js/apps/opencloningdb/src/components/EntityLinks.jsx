import React from 'react';
import { Link } from '@mui/material';
import { useHref, useNavigate } from 'react-router-dom';
import { sampleUidBadgeSx } from './SampleUidBadge';

/** Link to a page of the app, if newTab is true it opens in a new tab (e.g. from a modal, to keep its state). */
function NavigateLink({ to, children, sx, newTab = false }) {
  const navigate = useNavigate();
  const href = useHref(to);
  const linkSx = { textDecoration: 'underline', textAlign: 'left', ...sx };

  if (newTab) {
    return (
      <Link href={href} target="_blank" rel="noopener noreferrer" variant="body2" sx={linkSx}>
        {children}
      </Link>
    );
  }

  return (
    <Link
      component="button"
      variant="body2"
      onClick={() => navigate(to)}
      sx={linkSx}
    >
      {children}
    </Link>
  );
}

export function SequenceLink({ id, name, sx, newTab }) {
  return (
    <NavigateLink to={`/sequences/${id}`} sx={sx} newTab={newTab}>
      {name ?? `Sequence ${id}`}
    </NavigateLink>
  );
}

export function PrimerLink({ id, name, sx, newTab }) {
  return (
    <NavigateLink to={`/primers/${id}`} sx={sx} newTab={newTab}>
      {name ?? `Primer ${id}`}
    </NavigateLink>
  );
}

export function LineLink({ id, uid, sx, newTab }) {
  return (
    <NavigateLink
      to={`/lines/${id}`}
      newTab={newTab}
      sx={{
        ...sampleUidBadgeSx,
        textDecoration: 'none',
        '&:hover': { bgcolor: 'action.selected' },
        ...sx,
      }}
    >
      {uid ?? `Line ${id}`}
    </NavigateLink>
  );
}

export function CommaSeparatorWrapper({ children }) {
  return (
    <React.Fragment>
      {children.map((child, index) => (
        <React.Fragment key={index}>
          {index > 0 && ', '}
          {child}
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}
