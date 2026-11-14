import React from 'react';
import { useFormData } from '../context/FormDataContext';
import { FormControlLabel, Switch } from '@mui/material';
import { SyntaxOverviewTable } from '@opencloning/ui/components/assembler';
import SectionWrapper from './SectionWrapper';

function OverhangsPreview() {

  const { validParts } = useFormData();

  const [mode, setMode] = React.useState('detailed');

  if (validParts.length > 0) {
    return (
      <SectionWrapper title="Parts Preview" actions={
        <FormControlLabel
          control={
            <Switch
              checked={mode === 'detailed'}
              onChange={(e) => setMode(e.target.checked ? 'detailed' : 'compact')}
            />
          }
          label={mode === 'compact' ? 'Compact' : 'Detailed'}
        />
      }>
        <SyntaxOverviewTable parts={validParts} mode={mode} />
      </SectionWrapper>
    )}
}

export default OverhangsPreview;
