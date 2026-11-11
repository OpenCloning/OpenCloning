import React, { useMemo } from 'react'
import { Typography, Chip, Box } from '@mui/material'
import { DataGrid } from '@mui/x-data-grid'

function PartChip({ name, overhang}) {
  const label = name ? `${overhang} (${name})` : overhang;
  return (
    <Chip label={label} size="small" sx={{ fontSize: '0.7rem', height: 20, fontFamily: 'monospace' }}
    />
  )
}

function PlasmidSyntaxTable({ plasmids, maxHeight = 500 }) {
  const rows = useMemo(() => plasmids.map((plasmid, index) => {
    const { name, appData } = plasmid;
    const { fileName, correspondingParts, correspondingPartsNames, partInfo, longestFeature } = appData;

    let infoStr = '-';
    let longestFeatureStr = '-';
    const noParts = partInfo.length === 0;
    const multipleParts = partInfo.length > 1;

    if (partInfo.length === 1) {
      infoStr = partInfo[0] ? partInfo[0].name : 'Spans multiple parts';
      longestFeatureStr = longestFeature[0] ? longestFeature[0].name : '-';
    }
    if (multipleParts) {
      infoStr = 'Contains multiple parts';
    }

    return {
      id: index,
      name,
      fileName,
      correspondingParts,
      correspondingPartsNames,
      noParts,
      multipleParts,
      infoStr,
      longestFeatureStr,
      rowColor: partInfo.length === 1 ? partInfo[0]?.color : null,
    };
  }), [plasmids]);

  const rowColorStyles = useMemo(() => {
    const entries = rows
      .filter((r) => r.rowColor)
      .map((r) => [`& .MuiDataGrid-row[data-id="${r.id}"]`, { backgroundColor: `${r.rowColor} !important` }]);
    return Object.fromEntries(entries);
  }, [rows]);

  const columns = useMemo(() => [
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      sortable: true,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'fileName',
      headerName: 'File Name',
      width: 200,
      sortable: true,
      renderCell: (params) => (
        <Typography variant="body2" noWrap title={params.value}>
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'correspondingParts',
      headerName: 'Overhangs',
      width: 250,
      sortable: false,
      renderCell: (params) => {
        const { correspondingPartsNames, noParts } = params.row;
        const parts = params.value ?? [];
        return (
          <Box sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 0.5,
            width: '100%',
            ...(params.row.multipleParts ? { backgroundColor: 'red' } : {}),
          }}
          >
            {noParts ? '-' : parts.map((part, idx) => (
              <PartChip key={idx} name={correspondingPartsNames?.[idx]} overhang={part} />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'infoStr',
      headerName: 'Part Info',
      width: 180,
      sortable: true,
      renderCell: (params) => (
        <Typography variant="body2">{params.value}</Typography>
      ),
    },
    {
      field: 'longestFeatureStr',
      headerName: 'Longest Feature',
      width: 180,
      renderCell: (params) => (
        <Typography variant="body2">{params.value}</Typography>
      ),
    },
  ], []);

  return (
    <Box sx={{ height: Math.min(rows.length * 36 + 56, maxHeight), minHeight: 120, width: '100%' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        density="compact"
        disableRowSelectionOnClick
        disableColumnFilter
        disableVirtualization
        disableColumnMenu
        hideFooter
        initialState={{
          sorting: {
            sortModel: [{ field: 'name', sort: 'asc' }],
          },
        }}
        sx={{
          '& .MuiDataGrid-cell': {
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
          },
          '& .MuiDataGrid-columnHeader': { fontWeight: 'bold' },
          ...rowColorStyles,
        }}
      />
    </Box>
  )
}

export default PlasmidSyntaxTable
