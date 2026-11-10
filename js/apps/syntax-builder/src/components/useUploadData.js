import React from 'react'
import { useFormData, defaultFields } from '../context/FormDataContext';
import { readSubmittedTextFile } from '@opencloning/utils/readNwrite';
import { delimitedFileToJson } from '@opencloning/utils/fileParsers';
import { normalizeSyntaxEnzymes } from '@opencloning/utils/normalizeSyntax';

function validateSubmittedData(data) {
  if (!Array.isArray(data)) {
    throw new Error('Data should be an array');
  }
  data.forEach(part => {
    defaultFields.forEach(field => {
      if (part[field] === undefined) {
        throw new Error(`Part is missing ${field} field`);
      }
    });
  });
  return data;
}

function useUploadData() {
  const {setParts, setOverhangNames, setRelatedDois, setSubmitters, setAssemblyEnzymes, setDomesticationEnzyme, setSyntaxName} = useFormData();

  const uploadData = React.useCallback(async (file) => {
    if (file.name.endsWith('.tsv') || file.name.endsWith('.csv')) {
      const parts = await delimitedFileToJson(file, defaultFields);
      parts.forEach((part, index) => {
        part.left_codon_start = parseInt(part.left_codon_start) || 0;
        part.right_codon_start = parseInt(part.right_codon_start) || 0;
        part.id = index + 1;
      });
      validateSubmittedData(parts);
      setParts(parts);
    } else if (file.name.endsWith('.json')) {
      const data = normalizeSyntaxEnzymes(JSON.parse(await readSubmittedTextFile(file)));
      setSyntaxName(data.syntaxName || '');
      setParts(data.parts || []);
      setOverhangNames(data.overhangNames || {});
      setRelatedDois(data.relatedDois ? [...data.relatedDois, ''] : ['']);
      setSubmitters(data.submitters ? [...data.submitters, ''] : ['']);
      setAssemblyEnzymes(data.assemblyEnzymes);
      setDomesticationEnzyme(data.domesticationEnzyme || '');
    } else {
      throw new Error('Invalid file type');
    }
  }, [setParts, setOverhangNames, setRelatedDois, setSubmitters, setAssemblyEnzymes, setDomesticationEnzyme, setSyntaxName]);

  return { uploadData };
}

export default useUploadData
