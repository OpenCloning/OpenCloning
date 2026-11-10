import React from 'react';
import { Box, Typography, TextField, Paper, Alert, Button } from '@mui/material';
import { useFormData, validateOverhang } from '../context/FormDataContext';
import OverhangsPreview from './OverhangsPreview';

export function validateOverhangPaths(paths) {
  if (!paths || paths.length === 0) {
    return { isValid: true, error: '' }
  }

  // Validate all overhangs are valid
  for (const path of paths) {
    if (!Array.isArray(path) || path.length < 2) {
      return { isValid: false, error: 'Each path must contain at least 2 overhangs' }
    }
    for (const overhang of path) {
      const error = validateOverhang(overhang)
      if (error) {
        return { isValid: false, error: `Invalid overhang "${overhang}": ${error}` }
      }
    }
  }

  // Build ordering from first path
  const nodeOrder = [...paths[0]]
  const nodePositions = new Map()
  paths[0].forEach((node, index) => {
    nodePositions.set(node, index)
  })

  // Validate subsequent paths respect ordering
  for (let pathIndex = 1; pathIndex < paths.length; pathIndex++) {
    const path = paths[pathIndex]
    
    // First node must exist in previous paths
    const firstNode = path[0]
    if (!nodePositions.has(firstNode)) {
      return { 
        isValid: false, 
        error: `Path ${pathIndex + 1} starts with "${firstNode}" which doesn't exist in previous paths` 
      }
    }

    let lastPosition = nodePositions.get(firstNode)

    // Process remaining nodes in path
    for (let i = 1; i < path.length; i++) {
      const node = path[i]
      
      if (nodePositions.has(node)) {
        // Node exists - check ordering
        const nodePosition = nodePositions.get(node)
        if (nodePosition < lastPosition) {
          return { 
            isValid: false, 
            error: `Path ${pathIndex + 1} violates ordering: "${node}" appears before "${path[i - 1]}"` 
          }
        }
        lastPosition = nodePosition
      } else {
        // New node - add to ordering after last position
        const insertPosition = lastPosition + 1
        nodeOrder.splice(insertPosition, 0, node)
        // Update all positions after insertion
        nodePositions.clear()
        nodeOrder.forEach((n, idx) => {
          nodePositions.set(n, idx)
        })
        lastPosition = insertPosition
      }
    }
  }

  return { isValid: true, error: '', nodeOrder }
}

const exampleText = "CCCT\nAACG\nTATG\nATCC\nGCTG\nTACA\nGAGT\nCCGA\nCGCT\nCCCT\n\nTATG\nTTCT\nATCC\n\nATCC\nTGGC\nGCTG\nCCGA\nCAAT\nCCCT";


function OverhangsField() {

  const { setParts } = useFormData();

  // Local state to preserve linebreaks in the text field
  const [localValue, setLocalValue] = React.useState(exampleText);
  const [errorMessage, setErrorMessage] = React.useState('');

  const handleChange = (event) => {
    setErrorMessage('');
    let value = event.target.value;

    // Only allow ACGT characters and linebreaks
    // Convert to uppercase and filter out anything that's not ACGT or newline
    value = value.toUpperCase().replace(/[^ACGT\n]/g, '');

    // Process each line: normalize per line without limiting length
    const rawLines = value.split('\n');
    const processedLines = rawLines.map((line) => {
      return line.trim();
    });
    const processedValue = processedLines.join('\n');

    // Update local state to preserve linebreaks
    setLocalValue(processedValue);

    // Parse paths: group consecutive non-empty lines into paths
    const lines = processedLines;
    const paths = [];
    let currentPath = [];
    
    for (const line of lines) {
      if (line.length === 0) {
        // Empty line - end current path if it has content
        if (currentPath.length > 0) {
          paths.push(currentPath);
          currentPath = [];
        }
      } else {
        // Non-empty line - add to current path
        currentPath.push(line);
      }
    }

    // Add final path if it has content
    if (currentPath.length > 0) {
      paths.push(currentPath);
    }

    const validation = validateOverhangPaths(paths);
    if (!validation.isValid) {
      setErrorMessage(validation.error);
      setParts([]);
      return;
    }
    // Extract all edges from all paths
    const edges = new Set();
    for (const path of paths) {
      for (let i = 0; i < path.length - 1; i++) {
        edges.add(`${path[i]}|${path[i + 1]}`);
      }
    }

    // Convert edges to parts
    const parts = [];
    edges.forEach((edge) => {
      const [leftOverhang, rightOverhang] = edge.split('|');
      /* eslint-disable camelcase */
      parts.push({
        id: parts.length + 1,
        name: `${parts.length + 1}`,
        info: '',
        glyph: 'engineered-region',
        left_overhang: leftOverhang,
        right_overhang: rightOverhang,
        left_inside: '',
        right_inside: '',
        left_codon_start: 0,
        right_codon_start: 0,
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
      });
    /* eslint-enable camelcase */
    });
    setParts(parts);
  };

  React.useEffect(() => {
    handleChange({ target: { value: exampleText } });
  }, []);

  
  return (

    <Paper data-testid="overhangs-step" sx={{ p: 1.5 }}>
      <Typography variant="h6" gutterBottom>
          Overhangs
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
            Enter overhangs, one per line. Use empty lines to separate paths. Each overhang must be at least 3 DNA bases (ACGT).
        </Typography>
      </Box>
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}
      <TextField
        multiline
        rows={10}
        fullWidth
        value={localValue}
        onChange={handleChange}
        placeholder="ACGT&#10;TATG&#10;CATG&#10;&#10;TATG&#10;TTCT&#10;ATCC"
        inputProps={{
          style: { 
            fontFamily: 'monospace',
            fontSize: '0.875rem',
            textTransform: 'uppercase'
          }
        }}
        sx={{
          '& .MuiInputBase-input': {
            fontFamily: 'monospace',
          }
        }}
      />
    </Paper>
  )
}



function OverhangsStep({ setOverhangsStep }) {


  return (
    <Box data-testid="overhangs-step-container" sx={{ p: 3 }}>
      <OverhangsField />
      <OverhangsPreview />
      <Button variant="contained" onClick={() => setOverhangsStep(false)}>Next</Button>
    </Box>
  );
}

export default OverhangsStep;
