import React, { useCallback, useMemo } from 'react'
import { Box, Button, Alert, Tooltip } from '@mui/material'
import { Delete as DeleteIcon, Download as DownloadIcon, AddCircle as AddCircleIcon, CopyAll as CopyIcon } from '@mui/icons-material'
import { useDownloadData } from './useDownloadData'
import { useFormData, validatePart, validateField } from '../context/FormDataContext'
import { DataGrid, GridActionsCellItem, useGridApiRef } from '@mui/x-data-grid'
import { getSvgByGlyph, EditTextDialog } from '@opencloning/ui/components/assembler'
import GlyphEditCell from './GlyphEditCell'
import SectionWrapper from './SectionWrapper'

// Check if a part has a problematic overhang
const isPartProblematic = (part, problematicNodes) => {
  if (!problematicNodes || problematicNodes.length === 0) return false
  return problematicNodes.includes(`${part.left_overhang}-${part.right_overhang}`)
}

export default function PartsForm() {
  const { parts, addDefaultPart, setParts, problematicNodes, graphErrorMessage, mermaidString } = useFormData()
  const [infoDialog, setInfoDialog] = React.useState({ open: false, rowId: null, value: '' })
  const apiRef = useGridApiRef()

  const {downloadSyntaxTable} = useDownloadData()

  const handleDeleteRow = useCallback((id) => () => {
    setParts(prevParts => prevParts.filter(part => part.id !== id))
  }, [setParts])

  const handleCellClick = useCallback((params) => {
    if (params.field === 'info') {
      setInfoDialog({ open: true, rowId: params.id, value: params.value })
    } else if (params.field !== 'actions' && params.isEditable && params.cellMode !== 'edit') {
      apiRef.current.startCellEditMode({ id: params.id, field: params.field })
    }
  }, [apiRef])

  const getRowClassName = useCallback((params) => {
    if (!validatePart(params.row)) return 'error-row'
    return isPartProblematic(params.row, problematicNodes) ? 'problematic-row' : ''
  }, [problematicNodes])

  const handleInfoSave = useCallback((newValue) => {
    setParts(prevParts => 
      prevParts.map(part => 
        part.id === infoDialog.rowId 
          ? { ...part, info: newValue } 
          : part
      )
    )
    setInfoDialog({ open: false, rowId: null, value: '' })
  }, [infoDialog.rowId, setParts])

  const processRowUpdate = useCallback((newRow) => {
    setParts(prevParts => 
      prevParts.map(part => 
        part.id === newRow.id ? newRow : part
      )
    )
    return newRow
  }, [setParts])


  // Render cell with validation error display
  const renderValidatedCell = useCallback((field, params) => {
    const errorMessage = validateField(field, params.value, params.row)
    return (
      <Tooltip title={errorMessage || ''} placement="top" arrow>
        <Box className={field} sx={{ 
          color: errorMessage ? 'error.main' : 'inherit',
          fontWeight: errorMessage ? 'bold' : 'normal',
          width: '100%'
        }}>
          {params.value ?? ''}
        </Box>
      </Tooltip>
    )
  }, [])

  const columns = useMemo(() => [
    {
      field: 'actions',
      type: 'actions',
      headerName: '',
      width: 50,
      getActions: (params) => [
        <GridActionsCellItem
          key="delete"
          icon={<DeleteIcon />}
          label="Delete"
          onClick={handleDeleteRow(params.id)}
          disabled={parts.length === 1}
          color="error"
        />
      ]
    },
    { 
      field: 'name', 
      headerName: 'Name', 
      flex: 1,
      editable: true 
    },
    { 
      field: 'info', 
      headerName: 'Info', 
      flex: 1,
      editable: false,
      renderCell: (params) => (
        <Box sx={{ cursor: 'pointer', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {params.value ? (params.value.length > 30 ? `${params.value.substring(0, 30)}...` : params.value) : 'Click to edit...'}
        </Box>
      )
    },
    { 
      field: 'glyph', 
      headerName: 'Glyph', 
      flex: 1,
      editable: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <img src={getSvgByGlyph(params.value)} alt={params.value} style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
          <span>{params.value}</span>
        </Box>
      ),
      renderEditCell: (params) => <GlyphEditCell {...params} />
    },
    { 
      field: 'left_overhang', 
      headerName: 'Left Overhang', 
      flex: 1,
      editable: true,
      renderCell: (params) => renderValidatedCell('left_overhang', params),
      valueParser: (value) => (value || '').toUpperCase().replace(/[^ACGT]/g, '')
    },
    { 
      field: 'right_overhang', 
      headerName: 'Right Overhang', 
      flex: 1,
      editable: true,
      renderCell: (params) => renderValidatedCell('right_overhang', params),
      valueParser: (value) => (value || '').toUpperCase().replace(/[^ACGT]/g, '')
    },
    { 
      field: 'left_inside', 
      headerName: 'Left Inside', 
      flex: 1,
      editable: true,
      renderCell: (params) => renderValidatedCell('left_inside', params),
      valueParser: (value) => (value || '').toUpperCase().replace(/[^ACGTN]/g, '')
    },
    { 
      field: 'right_inside', 
      headerName: 'Right Inside', 
      flex: 1,
      editable: true,
      renderCell: (params) => renderValidatedCell('right_inside', params),
      valueParser: (value) => (value || '').toUpperCase().replace(/[^ACGTN]/g, '')
    },
    { 
      field: 'left_codon_start', 
      headerName: 'Left Codon Start', 
      flex: 1,
      type: 'number',
      editable: true,
      valueParser: (value) => Math.max(0, parseInt(value, 10) || 0)
    },
    { 
      field: 'right_codon_start', 
      headerName: 'Right Codon Start', 
      flex: 1,
      type: 'number',
      editable: true,
      valueParser: (value) => Math.max(0, parseInt(value, 10) || 0)
    },
    { 
      field: 'color', 
      headerName: 'Color', 
      flex: 1,
      editable: true,
      renderCell: (params) => {
        const errorMessage = validateField('color', params.value)
        return (
          <Tooltip title={errorMessage || ''} placement="top" arrow>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ 
                width: 20, height: 20, 
                backgroundColor: errorMessage ? 'transparent' : (params.value || 'transparent'),
                border: errorMessage ? '2px solid red' : '1px solid #ccc',
                borderRadius: '4px'
              }} />
              <span style={{ color: errorMessage ? 'red' : 'inherit', fontFamily: 'monospace' }}>{params.value}</span>
            </Box>
          </Tooltip>
        )
      }
    },
  ], [handleDeleteRow, parts.length, renderValidatedCell])

  return (
    <SectionWrapper title="Parts Info" actions={
      <>
        <Button size="small" variant="contained" startIcon={<AddCircleIcon />} onClick={addDefaultPart}>
            Add Part
        </Button>
        <Button size="small" variant="contained" startIcon={<DownloadIcon />} onClick={downloadSyntaxTable}>
            Download Parts Table
        </Button>
        <Button size="small" variant="contained" startIcon={<CopyIcon />} onClick={() => navigator.clipboard.writeText(mermaidString)}>
            Copy Mermaid String
        </Button>
        
      </>
    }>
      {graphErrorMessage && graphErrorMessage.length > 0 && (
        <Alert severity="warning" sx={{ my: 2 }}>
          {graphErrorMessage}
        </Alert>
      )}
      <DataGrid
        apiRef={apiRef}
        rows={parts}
        columns={columns}
        onCellClick={handleCellClick}
        getRowClassName={getRowClassName}
        processRowUpdate={processRowUpdate}
        density="compact"
        disableRowSelectionOnClick
        disableColumnSorting
        disableColumnFilter
        disableColumnMenu
        hideFooter
        autoHeight
        sx={{
          '& .MuiDataGrid-cell': { fontSize: '0.875rem' },
          '& .MuiDataGrid-columnHeader': { fontWeight: 'bold' },
          '& .problematic-row': { 
            backgroundColor: 'rgba(255, 152, 0, 0.15)',
            '&:hover': { backgroundColor: 'rgba(255, 152, 0, 0.25)' }
          },
          '& .error-row': {
            backgroundColor: 'rgba(255, 0, 0, 0.15)',
            '&:hover': { backgroundColor: 'rgba(255, 0, 0, 0.25)' }
          }
        }}
      />
      
      <EditTextDialog
        open={infoDialog.open}
        value={infoDialog.value}
        onClose={() => setInfoDialog({ open: false, rowId: null, value: '' })}
        onSave={handleInfoSave}
        title="Edit Info Text"
        placeholder="Enter info text..."
        multiline
      />
    </SectionWrapper>
  )
}
