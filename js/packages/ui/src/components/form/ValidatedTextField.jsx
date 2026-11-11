import { TextField } from '@mui/material';
import React from 'react';
import CustomFormHelperText from './CustomFormHelperText';

function ValidatedTextField({ id, value, onInputChange, errorChecker, updateValidationStatus, required, submissionAttempted, floatingHelperText, initialHelperText = '', ...rest }) {
  const defaultPars = { inputProps: { style: { fontSize: 14 } }, FormHelperTextProps: { component: 'div' } };
  const [error, setError] = React.useState(false);
  const [helperText, setHelperText] = React.useState(initialHelperText);
  const [touched, setTouched] = React.useState(false);

  const handleChange = (event) => {
    onInputChange(event);
    setTouched(true);
  };

  React.useEffect(() => {
    if (!submissionAttempted && !touched) return;
    if (required && value.length === 0) {
      setError(true);
      setHelperText('Field required');
      updateValidationStatus(id, true);
      return;
    }
    const { error: newError, helperText: newHelperText } = errorChecker(value);
    setError(newError);
    setHelperText(newHelperText);
    updateValidationStatus(id, newError);
  }, [value, touched, submissionAttempted]);
  const renderedHelperText = floatingHelperText ? (<CustomFormHelperText>{helperText}</CustomFormHelperText>) : helperText;
  return (<TextField id={id} value={value} {...defaultPars} {...rest} onChange={handleChange} error={error} helperText={renderedHelperText} />);
}

export default ValidatedTextField;
