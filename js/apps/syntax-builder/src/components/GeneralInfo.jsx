import React from 'react'
import SectionWrapper from './SectionWrapper';
import DoiInput from './form/DoiInput';
import EnzymeInput from './form/EnzymeInput';
import { Box, Typography } from '@mui/material';
import OrcidInput from './form/OrcidInput';
import { useFormData } from '../context/FormDataContext';
import DebouncedTextField from './form/DebouncedTextField';

const boxStyle = { width: 400, display: 'flex', flexDirection: 'column', gap: 2 };

function updateArrayBasedOnValues(array) {
  const newArray = [...array];
  // Remove empty entries at the end (leave one at least)
  while (newArray.length > 1 && newArray[newArray.length - 1] === '') {
    newArray.pop();
  }
  // Add new empty entry if the last entry is not empty
  if (newArray[newArray.length - 1] !== '') {
    newArray.push('');
  }
  return newArray;
}

function addEntry(setFunction, index, value, type) {
  let newValue = '';
  if (type === 'doi') {
    newValue = value?.message?.DOI || '';
  } else if (type === 'orcid') {
    newValue = value?.['orcid-identifier']?.path || '';
  }

  setFunction(prev => {
    const newArray = [...prev];
    newArray[index] = newValue;
    return updateArrayBasedOnValues(newArray);
  });
}

function GeneralInfo() {
  const {
    assemblyEnzymes, setAssemblyEnzymes, domesticationEnzyme, setDomesticationEnzyme,
    relatedDois, setRelatedDois,
    submitters, setSubmitters,
    syntaxName, setSyntaxName,
  } = useFormData();

  return (
    <SectionWrapper title="General Info">
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', mb: 2 }}>
        <Box sx={boxStyle}>
          <DebouncedTextField label="Syntax name" value={syntaxName} setValue={setSyntaxName} />
        </Box>
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'row', gap: 2 }}>
        <Box sx={boxStyle}>
          <Typography variant="h6">Restriction enzymes</Typography>
          <EnzymeInput multiple label="Assembly enzymes" value={assemblyEnzymes} onChange={setAssemblyEnzymes} helperText=" " />
          <EnzymeInput label="Domestication enzyme" value={domesticationEnzyme} onChange={setDomesticationEnzyme} helperText=" " />
        </Box>
        <Box sx={boxStyle}>
          <Typography variant="h6">Related publications</Typography>
          {relatedDois.map((doi, index) => (
            <DoiInput key={index} value={doi} onChange={(doiData) => addEntry(setRelatedDois, index, doiData, 'doi')} />
          ))}
        </Box>
        <Box sx={boxStyle}>
          <Typography variant="h6">Submitters</Typography>
          {submitters.map((submitter, index) => (
            <OrcidInput key={index} value={submitter} onChange={(orcidData) => addEntry(setSubmitters, index, orcidData, 'orcid')} />
          ))}
        </Box>
      </Box>
    </SectionWrapper>
  )
}

export default GeneralInfo
