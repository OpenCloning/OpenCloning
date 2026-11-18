import { Box, Dialog, DialogContent, DialogTitle, Link, Typography } from '@mui/material';
import React from 'react';
import ExternalLink from '../common/ExternalLink';

function FeedbackDialog({ open, setOpen }) {
  return (
    <Dialog open={open} onClose={() => setOpen(false)} className="load-example-dialog">
      <DialogTitle sx={{ textAlign: 'center', fontSize: 'x-large' }}> 😊 Give feedback 😭 </DialogTitle>
      <DialogContent sx={{ fontSize: 'large' }}>
        <Typography variant="inherit" sx={{ mb: 2 }}>
          🙏 Thanks for using OpenCloning!
        </Typography>
        <Typography variant="inherit">
          Your feedback is really appreciated:
        </Typography>
        <ul>
          <Box component="li" sx={{ mb: 1 }}>
            If you use GitHub,
            {' '}
            <ExternalLink href="https://github.com/OpenCloning/OpenCloning/issues/new">create an issue</ExternalLink>
          </Box>
          <li>
            Otherwise, send an email to
            {' '}
            <Link href="mailto:manuel.lera-ramirez@ucl.ac.uk">manuel.lera-ramirez@ucl.ac.uk</Link>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(FeedbackDialog);
