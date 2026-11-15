import React from 'react'
import { Upload as UploadIcon } from '@mui/icons-material'
import { Box } from '@mui/material'
import { useLinkedPlasmids } from '../context/FormDataContext';
import SectionWrapper from './SectionWrapper';
import { PlasmidSyntaxTable } from '@opencloning/ui/components/assembler';
import { FileUploadButton } from '@opencloning/ui/components/common';

function UploadPlasmidsButton({ onFileChange }) {
  return (
    <FileUploadButton size="small" variant="contained" startIcon={<UploadIcon />} onFiles={onFileChange} multiple accept=".gbk,.gb,.fasta,.fa,.dna">
      Upload linked plasmids
    </FileUploadButton>
  )
}


function LinkedPlasmidsTable() {
  const { linkedPlasmids: plasmids, uploadPlasmids } = useLinkedPlasmids()
  return (
    <SectionWrapper title="Linked plasmids" actions={<UploadPlasmidsButton onFileChange={uploadPlasmids} />}>
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <PlasmidSyntaxTable plasmids={plasmids} maxHeight={600} />
      </Box>
    </SectionWrapper>
  )
}

export default LinkedPlasmidsTable
