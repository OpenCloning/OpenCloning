import React, { useCallback } from 'react';
import { useFormData } from '../context/FormDataContext';
import { downloadTextFile, jsonToDelimitedFile } from '@opencloning/utils/readNwrite';

export function useDownloadData() {
  const { syntaxName, assemblyEnzymes, domesticationEnzyme, relatedDois, submitters, overhangNames, parts } = useFormData();

  const downloadSyntaxTable = useCallback(() => {
    // Download as tsv file
    const tsv = jsonToDelimitedFile(parts, '\t');
    downloadTextFile(tsv, 'syntax.tsv');
  }, [parts]);

  const downloadData = useCallback(() => {
    // Download as json file
    const json = JSON.stringify({
      syntaxName,
      assemblyEnzymes,
      domesticationEnzyme,
      relatedDois: relatedDois.filter(doi => doi !== ''),
      submitters: submitters.filter(submitter => submitter !== ''),
      overhangNames,
      parts
    },
    null, 2);
    downloadTextFile(json, 'syntax.json');
  }, [syntaxName, assemblyEnzymes, domesticationEnzyme, relatedDois, submitters, overhangNames, parts]);

  return { downloadSyntaxTable, downloadData };
}
