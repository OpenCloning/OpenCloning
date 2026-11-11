import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import React from 'react';

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
              <a href="https://github.com/OpenCloning/OpenCloning/issues/new" target="_blank" rel="noopener noreferrer">create an issue</a>
            </li>
            <li>
              Otherwise, send an email to
              {' '}
              <a href="mailto:manuel.lera-ramirez@ucl.ac.uk">manuel.lera-ramirez@ucl.ac.uk</a>
            </li>
          </ul>

        </p>
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(FeedbackDialog);
