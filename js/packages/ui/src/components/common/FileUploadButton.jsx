import React from 'react';
import { Button, Tooltip } from '@mui/material';

/**
 * A button that opens the file picker, and calls onFiles with the chosen files (an array, never empty).
 *
 * The hidden file input is rendered right after the button (tests use selectFile on it), and takes
 * `inputProps` (e.g. a data-testid). The other props go to MUI's Button. It is reset after each
 * choice, so choosing the same file again works.
 *
 * For a file picker opened from a menu, use a plain `<input type="file" hidden>` with a ref instead.
 */
function FileUploadButton({ onFiles, accept, multiple = false, tooltip, inputProps, children, ...buttonProps }) {
  const inputRef = React.useRef(null);

  const handleChange = (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length > 0) {
      onFiles(files);
    }
  };

  const button = <Button {...buttonProps} onClick={() => inputRef.current?.click()}>{children}</Button>;
  return (
    <>
      {tooltip ? <Tooltip title={tooltip}>{button}</Tooltip> : button}
      <input type="file" hidden ref={inputRef} accept={accept} multiple={multiple} onChange={handleChange} {...inputProps} />
    </>
  );
}

export default FileUploadButton;
