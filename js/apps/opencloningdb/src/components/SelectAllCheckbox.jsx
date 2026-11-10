import React from 'react';
import { Checkbox } from '@mui/material';

function SelectAllCheckbox({ ids, selectedIds, toggleRow, ariaLabel = 'select all'}) {

  const selectedCount = ids.reduce((acc, id) => acc + (selectedIds.has(id) ? 1 : 0), 0);
  const allSelected = ids.length > 0 && selectedCount === ids.length;
  const someSelected = selectedCount > 0 && selectedCount < ids.length;

  const toggleAll = () => {
    if (!ids.length) return;

    if (allSelected) {
      ids.forEach((id) => {
        if (selectedIds.has(id)) toggleRow(id);
      });
    } else {
      ids.forEach((id) => {
        if (!selectedIds.has(id)) toggleRow(id);
      });
    }
  };

  return (
    <Checkbox
      size="small"
      checked={allSelected}
      indeterminate={someSelected}
      disabled={!ids.length}
      onChange={toggleAll}
      inputProps={{ 'aria-label': ariaLabel }}
    />
  );
}

export default SelectAllCheckbox;

