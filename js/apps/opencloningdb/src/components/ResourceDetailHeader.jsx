import React from 'react'
import { Button, Typography, Box, IconButton, Tooltip } from '@mui/material';
import { ArrowBack as ArrowBackIcon, Edit as EditIcon, } from '@mui/icons-material';
import TagChipList from './TagChipList';

function ResourceDetailHeader({
  title,
  tags,
  entityId=null,
  entityType=null,
  onBack,
  backTitle,
  afterTitle = null,
  belowTitle = null,
  editorComponent : EditorComponent = null,
  editorComponentProps = {},
  editorIconToolTipText = 'Edit name',
  afterEditorComponent = null,
  ...rest
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  return (
    <Box {...rest}>
      <Button onClick={onBack} sx={{ mb: 2 }}>
        <ArrowBackIcon fontSize="small" sx={{ mr: 1 }} /> {backTitle}
      </Button>
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'row', mb: 1 }} data-testid="resource-detail-header-title">
        {!isEditing && (
          <>
            <Typography variant="h5">
              {title}
            </Typography>
            {afterTitle && <Box variant="h5" sx={{ mx: 1 }}>&mdash;</Box>}
            {afterTitle}
            {EditorComponent !== null && (
              <Tooltip title={editorIconToolTipText} arrow placement="right">
                <IconButton onClick={() => setIsEditing(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {afterEditorComponent}
          </>)}
        {isEditing && (
          <Box>
            <EditorComponent onSave={() => setIsEditing(false)} {...editorComponentProps} />
          </Box>
        )}
      </Box>
      {belowTitle}
      {Array.isArray(tags) && (
        <Box sx={{ mb: 1 }}>
          <TagChipList tags={tags} entityId={entityId} entityType={entityType} canDelete={true} />
        </Box>
      )}
    </Box>
  )
}

export default ResourceDetailHeader
