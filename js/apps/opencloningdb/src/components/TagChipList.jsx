import React from 'react'
import TagChip from './TagChip'
import { Box, Chip, CircularProgress, Tooltip } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { Add as AddIcon } from '@mui/icons-material';
import TagEntitiesDialog from './TagEntitiesDialog';



function TagChipList({tags, entityId=null, entityType=null, canDelete=false}) {
  // If id is passed, it can edit the tags
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = React.useState(false);

  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: [entityType, entityId] });
    queryClient.invalidateQueries({ queryKey: ['sequence', entityId, 'cloning_strategy'] });
    queryClient.invalidateQueries({ queryKey: ['line', entityId] });
    queryClient.invalidateQueries({ queryKey: ['primer', entityId] });
  };

  const noTagsText = React.useMemo(() => {
    if (entityId && entityType) {
      return <em>No tags</em>;
    }
    return "-";
  }, [entityId, entityType]);
  if (!Array.isArray(tags)) return <CircularProgress />;
  return <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }} data-testid="tag-chip-list">
    {tags.sort((a, b) => a.name.localeCompare(b.name)).map((tag) => <TagChip canDelete={canDelete} entityId={entityId} entityType={entityType} key={tag.id} tag={tag} />)}
    {tags.length === 0 && noTagsText}
    {entityId && entityType && (
      <>
        <Tooltip title="Add tag" arrow placement="right">
          <Chip
            size="small"
            label={<AddIcon fontSize="small" />}
            onClick={() => setOpenDialog(true)}
          />
        </Tooltip>
        <TagEntitiesDialog
          selectedEntities={[{id: entityId}]}
          entityType={entityType}
          label="Tag"
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          onSuccess={onSuccess}
          excludeTagIds={tags.map((tag) => tag.id)}
        />
      </>
    )}
  </Box>
}

export default TagChipList
