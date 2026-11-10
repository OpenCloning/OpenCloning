import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openCloningDBHttpClient } from './common';
import endpoints from './endpoints';

/**
 * Mutation to create a tag, called with the tag name, resolves to the created tag.
 * onError receives the error if the creation fails.
 */
export default function useCreateTagMutation({ onError } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagName) => {
      const { data } = await openCloningDBHttpClient.post(endpoints.tagPost, { name: tagName });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError,
  });
}
