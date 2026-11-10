import { TextField } from '@mui/material'
import React, { useRef, useState } from 'react'

/**
 * Generic text field component with API validation
 * @param {string} label - Label for the TextField
 * @param {string} placeholder - Placeholder text
 * @param {Function} validateFunction - Async function that validates the value
 *   Should accept (value, setError) and return a promise with validation result
 * @param {Function} onChange - Callback when validation succeeds, receives validation data
 * @param {number} debounceDelay - Delay in milliseconds before validation (default: 500)
 */
function TextFieldApiValidated({ 
  label, 
  placeholder, 
  validateFunction, 
  onChange,
  value = '',
  debounceDelay = 500, 
  ...rest
}) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const timeoutIdRef = useRef(null);
  React.useEffect(() => {
    if (value) {
      setLocalValue(value);
      validateFunction(value, setError, setSuccessMessage);
    }
  }, [value, validateFunction]);
  const handleChange = (e) => {
    setLocalValue(e.target.value);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    setError('');
    setSuccessMessage('');
    setIsValidating(false);
    if (e.target.value.length !== 0) {
      const timeoutId = setTimeout(() => {
        setIsValidating(true);
        validateFunction(e.target.value, setError, setSuccessMessage).then((data) => {
          if (onChange) {
            onChange(data);
          }
          setIsValidating(false);
        }).catch(() => {
          onChange('');
          setIsValidating(false);
        });
      }, debounceDelay);
      timeoutIdRef.current = timeoutId;
    } else {
      onChange('');
    }
  } 
  
  return (
    <TextField
      label={label}
      value={localValue}
      onChange={handleChange}
      placeholder={placeholder}
      error={error !== ''}
      helperText={isValidating ? 'Validating...' : error || successMessage || ' '}
      {...rest}
    />
  )
}

export default TextFieldApiValidated
