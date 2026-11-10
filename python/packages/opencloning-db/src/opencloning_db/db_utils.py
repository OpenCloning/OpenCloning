from sqlalchemy.orm import Session
from fastapi import HTTPException
from opencloning_db.models import Workspace


def get_workspace_or_404(session: Session, workspace_id: int) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail='Workspace not found')
    return workspace
