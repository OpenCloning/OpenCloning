import React from 'react';
import { batch, useDispatch } from 'react-redux';
import { useQueryClient } from '@tanstack/react-query';
import { setWorkspaceHeader, clearWorkspaceHeader } from '@opencloning/opencloningdb';
import { useOidcAuth } from '../auth/OidcAuthContext';
import { setWorkspace, clearUser, setUser } from '../store/authSlice';
import { setRememberedWorkspaceId } from '../utils/auth_utils';
import useStableNavigate from './useStableNavigate';
import { cloningActions } from '@opencloning/store/cloning';

const { reset: resetCloningState } = cloningActions;

export default function useChangeWorkspace() {
  const { signOut } = useOidcAuth();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const navigate = useStableNavigate();

  const changeWorkspace = React.useCallback(
    (workspace) => {
      setRememberedWorkspaceId(workspace.id);
      queryClient.clear();
      setWorkspaceHeader(workspace.id);
      batch(() => {
        dispatch(
          setWorkspace({
            id: workspace.id,
            name: workspace.name,
            role: workspace.role ?? null,
          }),
        );
        dispatch(resetCloningState());
      });
    },
    [dispatch, queryClient],
  );

  const clearWorkspace = React.useCallback(() => {
    clearWorkspaceHeader();
    batch(() => {
      dispatch(setWorkspace(null));
      dispatch(resetCloningState());
    });
    queryClient.clear();
  }, [dispatch, queryClient]);

  const applySession = React.useCallback(
    (user, workspace) => {
      dispatch(setUser(user));
      changeWorkspace(workspace);
    },
    [dispatch, changeWorkspace],
  );

  const logout = React.useCallback(async () => {
    clearWorkspace();
    dispatch(clearUser());
    await signOut();
    navigate('/login');
  }, [clearWorkspace, dispatch, navigate, signOut]);

  return React.useMemo(
    () => ({ changeWorkspace, clearWorkspace, applySession, logout }),
    [changeWorkspace, clearWorkspace, applySession, logout],
  );
}
