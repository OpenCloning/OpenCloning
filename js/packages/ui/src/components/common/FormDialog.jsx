import React from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

/**
 * A dialog with a title, its content, and a Cancel (red) and a submit button. The dialog is a form,
 * so pressing Enter in a field submits it.
 *
 * @param {Function} onSubmit - called with the submit event (its default and propagation are already stopped)
 * @param {Function} onClose - called by the Cancel button, Escape and clicks outside the dialog
 * @param {React.ReactNode} submitLabel - text of the submit button
 * @param {boolean} [submitDisabled] - disables the submit button
 * @param {boolean} [hideSubmit] - hides the submit button
 * @param {Object} [submitButtonProps] - extra props of the submit button, e.g. `{ variant: 'contained' }`
 * @param {Object} [cancelButtonProps] - extra props of the Cancel button, e.g. `{ color: 'primary' }`
 * @param {React.ReactNode} [actions] - replaces the two buttons (include a `type="submit"` button)
 * @param {Object} [contentSx] - sx of the DialogContent
 * @param {Object} [paperSx] - sx of the dialog's paper (the form)
 * Other props (className, maxWidth, fullWidth, data-testid...) go to the Dialog.
 */
export default function FormDialog({
  open,
  onClose,
  title,
  onSubmit,
  submitLabel,
  submitDisabled = false,
  hideSubmit = false,
  submitButtonProps,
  cancelButtonProps,
  actions,
  contentSx,
  paperSx,
  children,
  ...dialogProps
}) {
  const handleSubmit = (event) => {
    event.preventDefault();
    // React bubbles events through portals: without this, a dialog opened inside another form
    // would also submit that form
    event.stopPropagation();
    onSubmit(event);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      slotProps={{ paper: { component: 'form', onSubmit: handleSubmit, sx: paperSx } }}
      {...dialogProps}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={contentSx}>
        {children}
      </DialogContent>
      <DialogActions>
        {actions ?? (
          <>
            <Button color="error" onClick={onClose} {...cancelButtonProps}>Cancel</Button>
            {!hideSubmit && <Button type="submit" disabled={submitDisabled} {...submitButtonProps}>{submitLabel}</Button>}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
