import React from 'react';
import { useFormData } from '../context/FormDataContext';
import { FormControlLabel, Switch } from '@mui/material';
import { SyntaxOverviewTable } from '@opencloning/ui/components/assembler';
import { graphToMSA } from '@opencloning/ui/components/assembler';
import SectionWrapper from './SectionWrapper';




function OverhangsPreview() {

  const { graph, parts } = useFormData();

  const [mode, setMode] = React.useState('detailed');
  const msa = React.useMemo(() => graph ? graphToMSA(graph) : [], [graph])

  if (graph) {
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


        <SyntaxOverviewTable msa={msa} mode={mode} parts={parts} />
      </SectionWrapper>
    )}
}

export default OverhangsPreview;
