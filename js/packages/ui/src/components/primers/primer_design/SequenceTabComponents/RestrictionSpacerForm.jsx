import React from 'react';
import { FormLabel, Box, FormControl, TextField, Tooltip, FormControlLabel, Checkbox } from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';
import { useStore } from 'react-redux';
import { updateEditor } from '@teselagen/ove';
import EnzymeMultiSelect from '../../../form/EnzymeMultiSelect';
import { stringIsNotDNA } from '@opencloning/store/cloning_utils';
import { usePrimerDesign } from './PrimerDesignContext';
import { isEnzymePalindromic } from '@opencloning/utils/enzyme_utils';

function RestrictionSpacerForm() {
  const { primerDesignSettings } = usePrimerDesign();
  const {
    left_enzyme: leftEnzyme,
    right_enzyme: rightEnzyme,
    left_enzyme_inverted: leftEnzymeInverted,
    right_enzyme_inverted: rightEnzymeInverted,
    filler_bases: fillerBases,
    updateEnzymeSettings,
  } = primerDesignSettings;

  const store = useStore();

  // When enzymes change, update the displayed enzymes in the editor
  React.useEffect(() => {
    const allEnzymes = [leftEnzyme, rightEnzyme].filter((enzyme) => enzyme !== null);
    const filteredRestrictionEnzymes = allEnzymes.map((enzyme) => ({
      canBeHidden: true,
      value: enzyme,
    }));
    updateEditor(store, 'mainEditor', { annotationVisibility: { cutsites: leftEnzyme || rightEnzyme }, restrictionEnzymes: { filteredRestrictionEnzymes, isEnzymeFilterAnd: false } });
  }, [leftEnzyme, rightEnzyme]);

  return (
    <>
      <FormLabel>Restriction enzyme sites</FormLabel>
      <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FormControl sx={{ width: '10em', mt: 1.5, mr: 2 }}>
            <EnzymeMultiSelect value={leftEnzyme} setEnzymes={(v) => updateEnzymeSettings({ left_enzyme: v })} label="Left enzyme" multiple={false} />
          </FormControl>
          {leftEnzyme && !isEnzymePalindromic(leftEnzyme) && (
          <FormControlLabel
            control={<Checkbox checked={leftEnzymeInverted} onChange={(e) => updateEnzymeSettings({ left_enzyme_inverted: e.target.checked })} />}
            label="Invert site"
          />
          )}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FormControl sx={{ width: '10em', mt: 1.5, mr: 2 }}>
            <EnzymeMultiSelect value={rightEnzyme} setEnzymes={(v) => updateEnzymeSettings({ right_enzyme: v })} label="Right enzyme" multiple={false} />
          </FormControl>
          {rightEnzyme && !isEnzymePalindromic(rightEnzyme) && (
          <FormControlLabel
            control={<Checkbox checked={rightEnzymeInverted} onChange={(e) => updateEnzymeSettings({ right_enzyme_inverted: e.target.checked })} />}
            label="Invert site"
          />
          )}
        </Box>
        <FormControl sx={{ width: '10em', mt: 1.5 }}>
          <TextField
            label={(
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                5&apos; filler bases
                <Tooltip arrow placement="top" title="These bases are added to the 5&apos; end of the primer to ensure proper restriction enzyme digestion.">
                  <InfoIcon sx={{ fontSize: '1.2em', ml: 0.5 }} />
                </Tooltip>
              </Box>
                  )}
            value={fillerBases}
            onChange={(e) => updateEnzymeSettings({ filler_bases: e.target.value })}
            variant="outlined"
            inputProps={{
              id: 'sequence',
            }}
            error={stringIsNotDNA(fillerBases)}
            helperText={stringIsNotDNA(fillerBases) ? 'Invalid DNA sequence' : ''}
          />
        </FormControl>
      </Box>
    </>
  );
}

export default RestrictionSpacerForm;
