import React from 'react'
import SectionWrapper from './SectionWrapper'
import { useFormData } from '../context/FormDataContext';
import { DataGrid, useGridApiRef } from '@mui/x-data-grid';

function OverhangNamesForm() {
  const { overhangNames, updateOverhangName } = useFormData();
  const apiRef = useGridApiRef();
  
  // Transform overhangNames object into rows format for DataGrid
  const rows = React.useMemo(() => 
    Object.keys(overhangNames).map((overhang) => ({
      id: overhang,
      overhang,
      name: overhangNames[overhang] || '',
    })),
  [overhangNames]);

  const columns = React.useMemo(() => [
    {
      field: 'overhang',
      headerName: 'Overhang',
      width: 150,
      editable: false,
      renderCell: (params) => (
        <span style={{ fontFamily: 'monospace' }}>{params.value}</span>
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 300,
      editable: true,
    },
  ], []);

  const handleCellClick = React.useCallback((params) => {
    if (params.isEditable && params.cellMode !== 'edit') {
      apiRef.current.startCellEditMode({ id: params.id, field: params.field });
    }
  }, [apiRef]);

  const processRowUpdate = React.useCallback((newRow) => {
    updateOverhangName(newRow.id, newRow.name || '');
    return newRow;
  }, [updateOverhangName]);

  return (
    <SectionWrapper title="Overhang Names">
      <DataGrid
        apiRef={apiRef}
        rows={rows}
        columns={columns}
        onCellClick={handleCellClick}
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
        }}
      />
    </SectionWrapper>
  )
}

export default OverhangNamesForm
