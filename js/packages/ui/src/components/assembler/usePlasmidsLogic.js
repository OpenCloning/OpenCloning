import React from 'react';
import { anyToJson } from '@teselagen/bio-parsers';
import { partsToEdgesGraph } from '@opencloning/ui/components/assembler';
import { assignSequenceToSyntaxPart } from './assembler_utils';
import { aliasedEnzymesByName } from '@teselagen/sequence-utils';

/**
 * Custom hook that manages plasmids state and logic
 * @param {Object} params - Dependencies from FormDataContext
 * @param {Array} params.parts - Array of parts
 * @param {string[]} params.assemblyEnzymes - Assembly enzyme names
 * @param {Object} params.overhangNames - Mapping of overhangs to names
 * @returns {Object} - { linkedPlasmids, setLinkedPlasmids, uploadPlasmids, loadPlasmidsFromDatabase }
 */
export function usePlasmidsLogic({ parts, assemblyEnzymes, overhangNames }) {
  const [linkedPlasmids, setLinkedPlasmidsState] = React.useState([]);

  const graphForPlasmids = React.useMemo(() => partsToEdgesGraph(parts), [parts]);
  const partDictionary = React.useMemo(() => parts.reduce((acc, part) => {
    acc[`${part.left_overhang}-${part.right_overhang}`] = part;
    return acc;
  }, {}), [parts]);

  const assignPlasmids = React.useCallback((plasmids) => plasmids.map(plasmid => {
    const enzymes = assemblyEnzymes.map(name => aliasedEnzymesByName[name.toLowerCase()]);
    const correspondingParts = assignSequenceToSyntaxPart(plasmid, enzymes, graphForPlasmids);
    const correspondingPartsStr = correspondingParts.map(part => `${part.left_overhang}-${part.right_overhang}`);
    const correspondingPartsNames = correspondingParts.map(part => {
      let namePart = '';
      const leftName = overhangNames[part.left_overhang];
      const rightName = overhangNames[part.right_overhang];
      if (leftName || rightName) {
        namePart = `${leftName || part.left_overhang}-${rightName || part.right_overhang}`;
      }
      return namePart;
    });
    return {
      ...plasmid,
      appData: {
        ...plasmid.appData,
        correspondingParts: correspondingPartsStr,
        partInfo: correspondingPartsStr.map(partStr => partDictionary[partStr]),
        correspondingPartsNames: correspondingPartsNames,
        longestFeature: correspondingParts.map(part => part.longestFeature)
      }
    };
  }), [graphForPlasmids, partDictionary, assemblyEnzymes, overhangNames]);

  // Wrapper for setLinkedPlasmids that automatically assigns plasmids if enzyme is available
  const setLinkedPlasmids = React.useCallback((plasmids) => {
    if (assemblyEnzymes.length > 0 && Array.isArray(plasmids) && plasmids.length > 0) {
      setLinkedPlasmidsState(assignPlasmids(plasmids));
    } else {
      setLinkedPlasmidsState(plasmids);
    }
  }, [assemblyEnzymes, assignPlasmids]);

  // Update existing plasmids when enzyme or assignment logic changes
  React.useEffect(() => {
    if (assemblyEnzymes.length > 0) {
      setLinkedPlasmidsState((prevLinkedPlasmids) => {
        if (prevLinkedPlasmids.length > 0) {
          return assignPlasmids(prevLinkedPlasmids);
        }
        return prevLinkedPlasmids;
      });
    }
  }, [assignPlasmids, assemblyEnzymes]); // Note: intentionally not including linkedPlasmids to avoid infinite loop

  const uploadPlasmids = React.useCallback(async (files) => {
    const plasmids = await Promise.all(files.map(async (file) => {
      try {
        const data = await anyToJson(file);
        const sequenceData = data[0].parsedSequence;
        // Force circular
        sequenceData.circular = true;
        return {...sequenceData, appData: { fileName: file.name, correspondingParts: [], partInfo: [], correspondingPartsNames: [] } };
      } catch (e) {
        throw new Error(`Error uploading plasmid from file ${file.name}: ${e.message}`);
      }
    }));
    setLinkedPlasmids(plasmids);
  }, [setLinkedPlasmids]);

  // entries: [{ databaseId, name, textFileSequence }], as returned by database.GetSequencesInBulkComponent
  // Topology is not forced to circular, since the sequence is used as stored in the database.
  const loadPlasmidsFromDatabase = React.useCallback(async (entries) => {
    const plasmids = await Promise.all(entries.map(async ({ databaseId, name, textFileSequence }) => {
      try {
        const data = await anyToJson(textFileSequence.file_content, { fileName: 'sequence.gb' });
        if (!data[0]?.success || !data[0].parsedSequence) {
          throw new Error(data[0]?.messages?.join(', ') || 'could not parse sequence');
        }
        const sequenceData = data[0].parsedSequence;
        return { ...sequenceData, appData: { fileName: name, databaseId, textFileSequence, correspondingParts: [], partInfo: [], correspondingPartsNames: [] } };
      } catch (e) {
        throw new Error(`Error loading plasmid ${name} from database: ${e.message}`);
      }
    }));
    setLinkedPlasmids(plasmids);
  }, [setLinkedPlasmids]);

  return { linkedPlasmids, setLinkedPlasmids, uploadPlasmids, loadPlasmidsFromDatabase };
}
