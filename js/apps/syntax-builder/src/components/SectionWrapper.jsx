import React from 'react'
import { Typography, Paper, Box, Collapse, IconButton } from '@mui/material'
import { ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material'

function SectionWrapper({ title, children, actions, defaultExpanded = true }) {
  const [expanded, setExpanded] = React.useState(defaultExpanded)

  const handleToggle = () => {
    setExpanded(!expanded)
  }

  return (
    <Paper sx={{ p: 2, mb: 2 }} >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: expanded ? 1 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={handleToggle}>
          <IconButton size="small">
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Typography variant="h6">{title}</Typography>
        </Box>
        {actions}
      </Box>
      <Collapse in={expanded}>
        {children}
      </Collapse>
    </Paper>
  )
}

export default SectionWrapper
