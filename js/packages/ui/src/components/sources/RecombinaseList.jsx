import React from 'react';
import { Box, Button, Chip, FormControl, TextField } from '@mui/material';
import LabelWithTooltip from '../form/LabelWithTooltip';

const SITE_PATTERN = /^[A-Z]+[a-z]+[A-Z]+$/;
const DEFAULT_SITE1_NAME = 'attB';
const DEFAULT_SITE2_NAME = 'attP';
const SITE_PATTERN_HELP = `
Sites must match: uppercase-lowercase-uppercase (e.g. AAaaTTC, ATGCCCTAAaaCT).
Lowercase letters represent the homology region where sequences will be joined,
so the lowercase parts must match in both sites.
`;

function RecombinaseList({ recombinases, setRecombinases }) {
  const [name, setName] = React.useState('');
  const [site1, setSite1] = React.useState('');
  const [site2, setSite2] = React.useState('');
  const [site1Name, setSite1Name] = React.useState(DEFAULT_SITE1_NAME);
  const [site2Name, setSite2Name] = React.useState(DEFAULT_SITE2_NAME);
  const [site1Error, setSite1Error] = React.useState('');
  const [site2Error, setSite2Error] = React.useState('');

  const validateSite = (value) => {
    if (!value.trim()) return 'Required';
    if (!SITE_PATTERN.test(value)) return SITE_PATTERN_HELP;
    return '';
  };

  const onAdd = () => {
    const err1 = validateSite(site1);
    const err2 = validateSite(site2);
    setSite1Error(err1);
    setSite2Error(err2);
    if (err1 || err2) return;

    const rec = {
      site1: site1.trim(),
      site2: site2.trim(),
      site1_name: site1Name.trim() || DEFAULT_SITE1_NAME,
      site2_name: site2Name.trim() || DEFAULT_SITE2_NAME,
      ...(name.trim() && { name: name.trim() }),
    };
    setRecombinases([...recombinases, rec]);
    setName('');
    setSite1('');
    setSite2('');
    setSite1Name(DEFAULT_SITE1_NAME);
    setSite2Name(DEFAULT_SITE2_NAME);
    setSite1Error('');
    setSite2Error('');
  };

  const onRemove = (index) => {
    setRecombinases(recombinases.filter((_, i) => i !== index));
  };

  return (
    <>
      <FormControl fullWidth sx={{ mt: 1 }}>
        <LabelWithTooltip
          label="Recombinase recognition sites"
          tooltip={SITE_PATTERN_HELP}
        />
      </FormControl>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
        <TextField
          fullWidth
          label="Recombinase name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          size="small"
        />
        <TextField
          label="Site 1"
          fullWidth
          value={site1}
          onChange={(e) => { setSite1(e.target.value); setSite1Error(''); }}
          error={Boolean(site1Error)}
          helperText={site1Error}
          size="small"
          placeholder="e.g. AAaaTTC"
          sx={{ '& input': { fontFamily: 'monospace' } }}
        />
        <TextField
          label="Site 1 name"
          fullWidth
          value={site1Name}
          onChange={(e) => setSite1Name(e.target.value)}
          size="small"
          placeholder={DEFAULT_SITE1_NAME}
        />
        <TextField
          label="Site 2"
          fullWidth
          value={site2}
          onChange={(e) => { setSite2(e.target.value); setSite2Error(''); }}
          error={Boolean(site2Error)}
          helperText={site2Error}
          size="small"
          placeholder="e.g. CCaaGC"
          sx={{ '& input': { fontFamily: 'monospace' } }}
        />
        <TextField
          label="Site 2 name"
          fullWidth
          value={site2Name}
          onChange={(e) => setSite2Name(e.target.value)}
          size="small"
          placeholder={DEFAULT_SITE2_NAME}
        />
        <Button variant="outlined" onClick={onAdd} size="small" sx={{ alignSelf: 'flex-start' }}>
            Add recombinase
        </Button>
      </Box>
      {recombinases.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
          {recombinases.map((rec, i) => (
            <Chip
              key={`${rec.site1}-${rec.site2}-${i}`}
              label={rec.name || `${rec.site1} / ${rec.site2}`}
              onDelete={() => onRemove(i)}
              size="small"
            />
          ))}
        </Box>
      )}
    </>
  );
}

export default React.memo(RecombinaseList);
