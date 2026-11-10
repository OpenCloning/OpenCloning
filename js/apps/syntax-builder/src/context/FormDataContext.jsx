import React, { useCallback } from 'react';
import { graphToMSA, partsToGraph, graphHasCycle, partsToEdgesGraph } from '@opencloning/ui/components/assembler';
import { usePlasmidsLogic } from '@opencloning/ui/components/assembler';
import cssColors from './css_colors';

// Validation functions - return '' if valid, error message if invalid
const validateColor = (color) => {
  // Color can be empty
  if (!color || color.trim() === '') return ''
  if (!cssColors.includes(color)
    && !/^#[0-9A-Fa-f]{3,6}$/.test(color)
    && !/^rgb\(\d{1,3},\d{1,3},\d{1,3}\)$/.test(color)
    && !/^rgba\(\d{1,3},\d{1,3},\d{1,3},\d{1,3}\)$/.test(color)
    && !/^hsl\(\d{1,3},\d{1,3},\d{1,3}\)$/.test(color)
    && !/^hsla\(\d{1,3},\d{1,3},\d{1,3},\d{1,3}\)$/.test(color)) {
    return 'Invalid color'
  }
  return ''
}

export const validateOverhang = (overhang, otherOverhang=null) => {
  if (!overhang) return 'Overhang is required'
  if (!/^[ACGTacgt]+$/.test(overhang)) return 'Only ACGT allowed'
  if (overhang.length < 3) return 'Must be at least 3 bases'
  if (otherOverhang && overhang === otherOverhang) return 'Overhangs must be different'
  return ''
}

const validateInside = (inside) => {
  // Inside sequence can be empty
  if (!inside) return ''
  if (!/^[ACGTNacgtn]+$/.test(inside)) return 'Only ACGTN allowed'
  return ''
}

const validateCodonStart = (value) => {
  // Codon start can be zero, but not negative
  if (value === '' || value === null || value === '') return ''
  const num = typeof value === 'number' ? value : parseInt(value, 10)
  if (isNaN(num) || num < 0) return 'Must be >= 0'
  return ''
}

export const validateField = (field, value, row=null) => {
  if (field === 'color') {
    return validateColor(value)
  } else if (field === 'left_overhang' || field === 'right_overhang') {
    const otherOverhang = field === 'left_overhang' ? 'right_overhang' : 'left_overhang'
    return validateOverhang(value, row ? row[otherOverhang] : null)
  } else if (field === 'left_inside' || field === 'right_inside') {
    return validateInside(value)
  } else if (field === 'left_codon_start' || field === 'right_codon_start') {
    return validateCodonStart(value)
  }
  return undefined // No validation for other fields
}

export const validatePart = (part) => {
  return !Object.keys(part).some(key => Boolean(validateField(key, part[key])));
}

function validateGraph(graph) {
  if (!graph) return { error: 'Invalid paths entered', nodes: [] }
  // All parts must be have in and out links
  const nodesWithMissingLinks = graph.nodes().filter(node => graph.inDegree(node) === 0 || graph.outDegree(node) === 0);
  if (nodesWithMissingLinks.length > 0) {
    return { error: `Parts with missing links: ${nodesWithMissingLinks.join(', ')}`, nodes: nodesWithMissingLinks }
  }
  // The graph should form a cycle
  if (!graphHasCycle(graph)) {
    return { error: 'The graph does not form a cycle. Please check the overhangs.', nodes: [] }
  }
  return { error: '', nodes: [] }
}

const FormDataContext = React.createContext();

export const makeDefaultPart = () => ({
  /* eslint-disable camelcase */
  name: '',
  info: '',
  glyph: 'engineered-region',
  left_overhang: '',
  right_overhang: '',
  left_inside: '',
  right_inside: '',
  left_codon_start: 0,
  right_codon_start: 0,
  color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')
});
/* eslint-enable camelcase */

export const defaultFields = [...Object.keys(makeDefaultPart())];

export const allOverhangsFromParts = (parts) => {
  const overhangs = [];
  parts.forEach(part => {
    if (part.left_overhang && !overhangs.includes(part.left_overhang)) {
      overhangs.push(part.left_overhang);
    }
    if (part.right_overhang && !overhangs.includes(part.right_overhang)) {
      overhangs.push(part.right_overhang);
    }
  });
  return overhangs;
}

export function FormDataProvider({ children }) {

  const [syntaxName, setSyntaxName] = React.useState('');
  const [parts, setParts] = React.useState([]);
  const [overhangNames, setOverhangNames] = React.useState({});
  const [graph, setGraph] = React.useState(null);
  const [graphErrorMessage, setGraphErrorMessage] = React.useState('');
  const [problematicNodes, setProblematicNodes] = React.useState([]);
  const [relatedDois, setRelatedDois] = React.useState(['']);
  const [submitters, setSubmitters] = React.useState(['']);
  const [assemblyEnzymes, setAssemblyEnzymes] = React.useState(['BsaI']);
  const [domesticationEnzyme, setDomesticationEnzyme] = React.useState('BsaI');

  const graph2 = React.useMemo(() => partsToEdgesGraph(parts), [parts]);
  let mermaidString = 'flowchart TD\n';
  graph2.forEachNode((node) => {
    graph2.forEachOutboundNeighbor(node, (neighbor) => {
      mermaidString += `${node} --> ${neighbor}\n`;
    });
  });

  // Plasmids logic - separated into its own hook for better organization
  const { linkedPlasmids, setLinkedPlasmids, uploadPlasmids } = usePlasmidsLogic({
    parts,
    assemblyEnzymes,
    overhangNames
  });

  React.useEffect(() => {
    const allOverhangs = allOverhangsFromParts(parts);
    setOverhangNames(prev => {
      const newOverhangNames = { ...prev };
      // Remove entries that are not in the parts
      for (const overhang of Object.keys(newOverhangNames)) {
        if (!allOverhangs.includes(overhang)) {
          delete newOverhangNames[overhang];
        }
      }
      // Add new entries
      for (const overhang of allOverhangs) {
        if (!newOverhangNames[overhang]) {
          newOverhangNames[overhang] = '';
        }
      }
      return newOverhangNames;

    })
  }, [parts]);

  const updateOverhangName = React.useCallback((overhang, name) => {
    setOverhangNames(prev => ({ ...prev, [overhang]: name }));
  }, [setOverhangNames]);

  const addDefaultPart = useCallback(() => {
    setParts(prevParts => [...prevParts, { ...makeDefaultPart(), id: Math.max(...prevParts.map(part => part.id), 0) + 1 }]);
  }, []);

  React.useEffect(() => {
    setGraphErrorMessage('');
    setProblematicNodes([]);
    if (parts.length > 0) {
      try {
        const validParts = parts.filter(validatePart);
        const thisGraph = partsToGraph(validParts);
        const { error, nodes: problemNodes } = validateGraph(thisGraph);
        setGraphErrorMessage(error);
        setProblematicNodes(problemNodes);
        // This is just to test if it gives errors
        graphToMSA(thisGraph);
        setGraph(thisGraph);
      } catch (error) {
        if (error.message.includes('given graph is not acyclic')) {
          setGraphErrorMessage('Multiple independent cycles detected in the graph, or cycle that does not include all parts. Please check the overhangs.');
        }
        else if (error.message.includes('could not find source node "undefined"')) {
          setGraphErrorMessage('Not enough parts to form a graph');
        }
        else {
          setGraphErrorMessage(error.message);
        }
        setGraph(null);
      }
    } else {
      setGraph(null);
    }
  }, [parts]);

  const resetFormData = React.useCallback(() => {
    setParts([]);
    setOverhangNames({});
    setAssemblyEnzymes([]);
    setDomesticationEnzyme('');
    setSyntaxName('');
    setRelatedDois(['']);
    setSubmitters(['']);
    setLinkedPlasmids([]);
  }, [setParts, setOverhangNames, setAssemblyEnzymes, setDomesticationEnzyme, setSyntaxName, setRelatedDois, setSubmitters, setLinkedPlasmids]);


  const value = React.useMemo(() => ({
    relatedDois,
    setRelatedDois,
    submitters,
    setSubmitters,
    assemblyEnzymes,
    setAssemblyEnzymes,
    domesticationEnzyme,
    setDomesticationEnzyme,
    parts,
    setParts,
    resetFormData,
    graph,
    graphErrorMessage,
    problematicNodes,
    addDefaultPart,
    overhangNames,
    setOverhangNames,
    updateOverhangName,
    syntaxName,
    setSyntaxName,
    linkedPlasmids,
    setLinkedPlasmids,
    uploadPlasmids,
    mermaidString,
  }), [
    relatedDois, setRelatedDois, submitters, setSubmitters, assemblyEnzymes, setAssemblyEnzymes, domesticationEnzyme, setDomesticationEnzyme, parts, setParts,
    resetFormData, graph, graphErrorMessage, problematicNodes, addDefaultPart, overhangNames, setOverhangNames, updateOverhangName, syntaxName, setSyntaxName,
    linkedPlasmids, setLinkedPlasmids, uploadPlasmids, mermaidString]);

  return (
    <FormDataContext.Provider value={value}>
      {children}
    </FormDataContext.Provider>
  );
}

export function useFormData() {
  const context = React.useContext(FormDataContext);
  if (!context) {
    throw new Error('useFormData must be used within a FormDataProvider');
  }
  return context;
}

// Convenience hook for accessing plasmids-related values from context
export function useLinkedPlasmids() {
  const { linkedPlasmids, uploadPlasmids, setLinkedPlasmids } = useFormData();
  return { linkedPlasmids, uploadPlasmids, setLinkedPlasmids };
}
