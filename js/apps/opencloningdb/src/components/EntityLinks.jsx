import React from 'react';
import { Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { sampleUidBadgeSx } from './SampleUidBadge';

function NavigateLink({ to, children, sx }) {
  const navigate = useNavigate();

  return (
    <Link
      component="button"
      variant="body2"
      onClick={() => navigate(to)}
      sx={{ textDecoration: 'underline', textAlign: 'left', ...sx }}
    >
      {children}
    </Link>
  );
}

export function SequenceLink({ id, name, sx }) {
  return (
    <NavigateLink to={`/sequences/${id}`} sx={sx}>
      {name ?? `Sequence ${id}`}
    </NavigateLink>
  );
}

export function PrimerLink({ id, name, sx }) {
  return (
    <NavigateLink to={`/primers/${id}`} sx={sx}>
      {name ?? `Primer ${id}`}
    </NavigateLink>
  );
}

export function LineLink({ id, uid, sx }) {
  return (
    <NavigateLink
      to={`/lines/${id}`}
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


