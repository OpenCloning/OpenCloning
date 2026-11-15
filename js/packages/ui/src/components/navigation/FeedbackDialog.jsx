import { Dialog, DialogContent, DialogTitle, Link } from '@mui/material';
import React from 'react';
import ExternalLink from '../common/ExternalLink';

function FeedbackDialog({ open, setOpen }) {
  return (
    <Dialog open={open} onClose={() => setOpen(false)} className="load-example-dialog">
      <DialogTitle sx={{ textAlign: 'center', fontSize: 'x-large' }}> 😊 Give feedback 😭 </DialogTitle>
      <DialogContent sx={{ fontSize: 'large' }}>
        <p>
          🙏 Thanks for using OpenCloning!
        </p>
        <p>
          {' '}
          Your feedback is really appreciated:
          <ul>
            <li style={{ marginBottom: 10 }}>
              If you use GitHub,
              {' '}
              <ExternalLink href="https://github.com/OpenCloning/OpenCloning/issues/new">create an issue</ExternalLink>
            </li>
            <li>
              Otherwise, send an email to
              {' '}
              <Link href="mailto:manuel.lera-ramirez@ucl.ac.uk">manuel.lera-ramirez@ucl.ac.uk</Link>
            </li>
          </ul>

        </p>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(FeedbackDialog);
