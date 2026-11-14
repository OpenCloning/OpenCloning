import React, { useCallback } from 'react';
import { getSyntaxLayout, partKey, partsToEdgesGraph } from '@opencloning/ui/components/assembler';
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

// Checks that the parts form a syntax in which every part can be used in an assembly.
// Returns the message to display ('' if there are no problems) and the keys of the parts with problems.
// See the README for how the order of the overhangs is worked out from the parts.
export function validateSyntaxParts(parts) {
  const { order, incompleteParts, unreachableOverhangs } = getSyntaxLayout(parts);
  const messages = [];
  if (incompleteParts.length > 0) {
    messages.push(`Parts that are not in a complete assembly: ${incompleteParts.map(partKey).join(', ')}.`);
  }
  if (unreachableOverhangs.length > 0) {
    messages.push(
      `Overhangs that cannot be reached from the first overhang (${order[0]}): ${unreachableOverhangs.join(', ')}. `
      + 'If a part goes around the first overhang, list it after the other parts.'
    );
  }
  return { error: messages.join(' '), problematicParts: incompleteParts.map(partKey) };
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

  // Parts with invalid fields (e.g. while they are being typed) are left out of the preview and the checks
  const validParts = React.useMemo(() => parts.filter(validatePart), [parts]);
  const { error: graphErrorMessage, problematicParts } = React.useMemo(() => validateSyntaxParts(validParts), [validParts]);

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
    validParts,
    graphErrorMessage,
    problematicParts,
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
    resetFormData, validParts, graphErrorMessage, problematicParts, addDefaultPart, overhangNames, setOverhangNames, updateOverhangName, syntaxName, setSyntaxName,
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
