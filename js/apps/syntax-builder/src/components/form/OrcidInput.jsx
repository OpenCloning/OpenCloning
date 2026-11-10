import React from 'react'
import axios from 'axios';
import TextFieldApiValidated from './TextFieldApiValidated';


function nameFromOrcidData({ person}) {
  const givenNames = person?.name?.['given-names']?.value || '';
  const familyNames = person?.name?.['family-name']?.value || '';
  return `${givenNames} ${familyNames}`;
}

async function validateOrcid(orcid, setError, setSuccessMessage) {
  // Remove any spaces and format the ORCID
  const cleanedOrcid = orcid.replace(/\s/g, '');

  // Basic format validation: should be 16 digits with hyphens
  const orcidPattern = /^(\d{4}-){3}\d{3}[\dX]$/;
  if (!orcidPattern.test(cleanedOrcid)) {
    setError('Invalid ORCID format. Expected format: 0000-0000-0000-0000');
    return;
  }

  try {
    const response = await axios.get(`https://pub.orcid.org/v3.0/${cleanedOrcid}`, {
      headers: {
        'Accept': 'application/json'
      }
    });

    setSuccessMessage(nameFromOrcidData(response.data));
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      setError('ORCID not found');
    } else {
      setError('Error validating ORCID - ' + (error.message || 'Unknown error'));
    }
  }
}

function OrcidInput({ label = 'ORCID', onChange, value, ...rest }) {
  return (
    <TextFieldApiValidated
      label={label}
      value={value}
      placeholder="0000-0000-0000-0000"
      validateFunction={validateOrcid}
      onChange={onChange}
      {...rest}
    />
  )
}

export default OrcidInput
