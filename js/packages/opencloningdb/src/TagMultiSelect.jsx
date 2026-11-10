import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { QuerySelect } from '@opencloning/ui';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';
import useCreateTagMutation from './useCreateTagMutation';

/**
 * Multi-select of the workspace tags. value and onChange use arrays of tag ids.
 * If allowCreate, a tag that does not exist can be created from the options popup,
 * and it is added to the selection. onCreateError receives the error if the creation fails.
 */
function TagMultiSelect({ onChange, label = 'Tags', value, excludeTagIds = [], allowCreate = true, onCreateError, ...rest }) {
  const query = React.useMemo(() => ({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await openCloningDBHttpClient.get(endpoints.tags);
      return data;
    },
    select: (tags) => tags.filter((tag) => !excludeTagIds.includes(tag.id)),
  }), [excludeTagIds]);

  const { data: options = [] } = useQuery(query);
  const valueAsObjects = React.useMemo(
    () => (value || []).map((id) => options.find((o) => o.id === id)).filter(Boolean),
    [value, options],
  );

  const createTagMutation = useCreateTagMutation({ onError: onCreateError });

  const handleCreateTag = React.useCallback(async (inputValue) => {
    let createdTag;
    try {
      createdTag = await createTagMutation.mutateAsync(inputValue);
    } catch {
      // Reported by onError
      return;
    }
    const selectedTagIds = value || [];
    onChange(selectedTagIds.includes(createdTag.id) ? selectedTagIds : [...selectedTagIds, createdTag.id]);
  }, [createTagMutation, onChange, value]);

  return (
    <QuerySelect
      query={query}
      label={label}
      loadingMessage="retrieving tags"
      errorMessage="Could not retrieve tags from OpenCloningDB"
      getOptionLabel={(tag) => tag.name}
      getOptionKey={(tag) => tag.id}
      value={valueAsObjects}
      onChange={(selectedTags) => onChange(selectedTags?.map((t) => t.id) ?? [])}
      inputProps={{ size: 'small' }}
      autoComplete={true}
      noOptionsAction={allowCreate ? { label: 'Create tag', onClick: handleCreateTag } : null}
      {...rest}
    />
  );
}

export default TagMultiSelect;
