import React from 'react'
import { TextField } from '@mui/material';

function DebouncedTextField({ value, setValue, debounceDelay = 500, ...props }) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef(null);

  // Sync local value when external value changes (e.g., from reset)
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the setValue call when localValue changes
  React.useEffect(() => {
    // Only call setValue if localValue differs from external value
    // This prevents echoing external changes back to parent
    if (localValue === value) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set up new timeout to call setValue after debounce delay
    timeoutRef.current = setTimeout(() => {
      setValue(localValue);
    }, debounceDelay);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [localValue, value, debounceDelay, setValue]);

  return (
    <TextField 
      value={localValue} 
      onChange={(e) => setLocalValue(e.target.value)} 
      {...props} 
    />
  );
}

export default DebouncedTextField;
