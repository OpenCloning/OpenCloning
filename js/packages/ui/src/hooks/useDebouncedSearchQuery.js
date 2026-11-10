import React, { useState, useEffect } from 'react';

export default function useDebouncedSearchQuery(getQuery, { minChars = 3, debounceMs = 500 } = {}) {
  const [input, setInput] = useState('');
  const [debouncedInput, setDebouncedInput] = useState('');

  const syncing = input !== debouncedInput;

  let noOptionsText = 'No results found';
  if (input.length < minChars) {
    noOptionsText = `Type at least ${minChars} characters to search`;
  } else if (syncing) {
    noOptionsText = 'Loading...';
  }

  useEffect(() => {
    const id = setTimeout(() => setDebouncedInput(input), debounceMs);
    return () => clearTimeout(id);
  }, [input, debounceMs]);

  const query = React.useMemo(() => {
    return {
      ...getQuery(debouncedInput),
      enabled: debouncedInput.length >= minChars
    };
  }, [getQuery, debouncedInput, minChars]);

  const autocompleteProps = {
    inputValue: input,
    onInputChange: (_event, value, reason) => {
      if (reason === 'input' || reason === 'reset') setInput(value);
    },
    filterOptions: (x) => syncing ? [] : x,
    noOptionsText,
  };

  const clearInput = () => {
    setInput('');
  };

  return { query, autocompleteProps, clearInput };
}
