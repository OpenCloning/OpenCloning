import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box, Chip } from '@mui/material';
import { AddCircle as AddCircleIcon } from '@mui/icons-material';

function chipRenderer(selected, primers) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {selected.map((id) => (
        <Chip key={id} label={primers.find((p) => p.id === id).name} />
      ))}
    </Box>
  );
}

function SelectPrimerForm({ primers, selected, onChange, goToPrimerTab, label, multiple = false }) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    // If the primer that was selected is deleted
    const primerIds = primers.map(({ id }) => id);
    if (!multiple) {
      if (selected && !primerIds.includes(selected)) {
        onChange(null);
      }
    } else {
      onChange(selected.filter((id) => primerIds.includes(id)));
    }
  }, [primers]);

  const onChangeHandleCreatePrimer = (value) => {
    if (multiple) {
      onChange(value.filter((id) => id !== ""));
    } else {
      onChange(value);
    }
  };

  const handleCreatePrimerClick = () => {
    setOpen(false);
    goToPrimerTab();
  };

  return (
    <FormControl fullWidth>
      <InputLabel>{label}</InputLabel>
      <Select
        multiple={multiple}
        value={selected}
        onChange={(e) => onChangeHandleCreatePrimer(e.target.value)}
        onClose={() => setOpen(false)}
        onOpen={() => setOpen(true)}
        open={open}
        label={label}
        renderValue={multiple ? (s) => chipRenderer(s, primers) : undefined}
      >
        <MenuItem onClick={handleCreatePrimerClick} value="">
          <AddCircleIcon color="success" />
          <em style={{ marginLeft: 8 }}>Create primer</em>
        </MenuItem>
        {primers.map(({ name, id }) => (<MenuItem key={id} value={id}>{name}</MenuItem>))}
      </Select>
    </FormControl>
  );
}

export default SelectPrimerForm;
