import React from 'react'

import { Box} from '@mui/material'
import OverhangsPreview from './OverhangsPreview'
import GeneralInfo from './GeneralInfo'
import PartsForm from './PartsForm'
import LinkedPlasmidsTable from './LinkedPlasmidsTable'
import OverhangNamesForm from './OverhangNamesForm'
import HeaderActions from './HeaderActions'


function DesignForm() {
  return (
    <Box data-testid="design-form" sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <HeaderActions />
      <Box sx={{ overflowY: 'auto', flex: 1, p: 1.5 }}>
        <GeneralInfo />
        <OverhangsPreview />
        <PartsForm />
        <OverhangNamesForm />
        <LinkedPlasmidsTable />
      </Box>
    </Box>
  )
}

export default DesignForm
