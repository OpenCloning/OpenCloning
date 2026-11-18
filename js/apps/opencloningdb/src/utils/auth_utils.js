import { openCloningDBHttpClient, endpoints } from '@opencloning/opencloningdb';

export const LAST_WORKSPACE_ID_KEY = 'lastWorkspaceId';

// The user is signed in but belongs to no workspace (e.g. removed from all of them). Retrying does not help.
export class NoWorkspacesError extends Error {
  constructor() {
    super('You are not a member of any workspace. Ask a workspace owner to add you.');
    this.name = 'NoWorkspacesError';
  }
}

export function getRememberedWorkspaceId() {
  const raw = localStorage.getItem(LAST_WORKSPACE_ID_KEY);
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}

export function setRememberedWorkspaceId(workspaceId) {
  localStorage.setItem(LAST_WORKSPACE_ID_KEY, String(workspaceId));
}

export function pickWorkspace(workspaces) {
  const rememberedId = getRememberedWorkspaceId();
  if (rememberedId != null) {
    const match = workspaces.find((w) => w.id === rememberedId);
    if (match) return match;
  }
  return workspaces[0];
}

/** Assumes a valid token is already on the HTTP client (e.g. after login/register). */
export async function fetchUserAndFirstWorkspace() {
  const { data: user } = await openCloningDBHttpClient.get(endpoints.authMe);
  const { data: workspaces } = await openCloningDBHttpClient.get(endpoints.workspaces);
  if (!workspaces?.length) {
    throw new NoWorkspacesError();
  }
  return { user, workspace: pickWorkspace(workspaces) };
}
