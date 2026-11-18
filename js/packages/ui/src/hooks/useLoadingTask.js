import React from 'react';
import { useDispatch } from 'react-redux';
import { cloningActions } from '@opencloning/store/cloning';

const { startLoadingTask, stopLoadingTask } = cloningActions;

let nextTaskId = 1;

/**
 * Returns `withLoading(fn, message)`, which runs the async function `fn` while
 * <LoadingBackdrop /> blocks the UI and shows `message`. It returns what `fn` returns
 * (or throws what it throws). Calls can be nested: the backdrop stays until all have ended.
 */
export default function useLoadingTask() {
  const dispatch = useDispatch();

  return React.useCallback(async (fn, message = 'Loading...') => {
    const id = nextTaskId;
    nextTaskId += 1;
    dispatch(startLoadingTask({ id, message }));
    try {
      return await fn();
    } finally {
      dispatch(stopLoadingTask(id));
    }
  }, [dispatch]);
}
