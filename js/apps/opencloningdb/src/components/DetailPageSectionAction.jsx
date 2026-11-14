
import { IconButton, Tooltip } from '@mui/material'
import React from 'react'

function DetailPageSectionAction({ icon, onClick, title = '' }) {
  return (
    <Tooltip title={title} placement="top">
      <IconButton onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  )
}

export default DetailPageSectionAction
