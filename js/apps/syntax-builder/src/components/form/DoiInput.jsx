import React from 'react'
import axios from 'axios';
import TextFieldApiValidated from './TextFieldApiValidated';

async function validateDoi(doi, setError, setSuccessMessage) {
  try {
    const response = await axios.get(`https://api.crossref.org/works/${doi}`);
    setSuccessMessage(response?.data?.message?.title?.[0]?.slice(0, 30) + '...' || 'Found, but no title available');
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      setError('DOI not found');
    } else {
      setError('Error validating DOI - ' + (error.message || 'Unknown error'));
    }
  }
}

function DoiInput({ label = 'DOI', value, onChange, ...rest }) {
  return (
    <TextFieldApiValidated
      label={label}
      value={value}
      placeholder="10.1234/example.doi"
      validateFunction={validateDoi}
      onChange={onChange}
      {...rest}
    />
  )
}

export default DoiInput
