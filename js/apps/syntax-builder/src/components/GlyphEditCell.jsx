import React from 'react'
import { useGridApiContext } from "@mui/x-data-grid"
import { Select, MenuItem, Box } from '@mui/material'
import { getSvgByGlyph } from '@opencloning/ui/components/assembler'

const glyphOptions = [
  'assembly-scar',
  'cds',
  'cds-stop',
  'chromosomal-locus',
  'engineered-region',
  'five-prime-sticky-restriction-site',
  'origin-of-replication',
  'primer-binding-site',
  'promoter',
  'ribosome-entry-site',
  'specific-recombination-site',
  'terminator',
  'three-prime-sticky-restriction-site',
]

// Custom edit component for glyph field
function GlyphEditCell({ id, value, field }) {
  const apiRef = useGridApiContext()

  const handleChange = (event) => {
    apiRef.current.setEditCellValue({ id, field, value: event.target.value })
  }

  return (
    <Select
      value={value || 'engineered-region'}
      onChange={handleChange}
      fullWidth
      size="small"
      autoFocus
      sx={{ fontSize: '0.875rem' }}
    >
      {glyphOptions.map((option) => (
        <MenuItem key={option} value={option}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component="img"
              src={getSvgByGlyph(option)}
              alt={option}
              sx={{ width: 24, height: 24, objectFit: 'contain' }}
            />
            <span>{option}</span>
          </Box>
        </MenuItem>
      ))}
    </Select>
  )
}

export default GlyphEditCell
