"""Tag and input_entity tag endpoints."""

from collections.abc import Callable
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from opencloning_db.apimodels import (
    DeletedResponse,
    EntityTagAttach,
    InputEntityRef,
    RemovedResponse,
    TagCreate,
    TagRead,
)
from opencloning_db.models import Tag, User, WorkspaceRole
from opencloning_db.workspace_deps import (
    WorkspaceContext,
    get_editor_workspace_ctx,
    get_input_entity_in_workspace_for_user,
    get_line_in_workspace_for_user,
    get_tag_in_workspace_for_user,
    get_viewer_workspace_ctx,
)

router = APIRouter(tags=['tags'])


def _get_resource_tags(
    session: Session,
    current_user: User,
    workspace_id: int,
    resource_id: int,
    loader: Callable[[Session, User, int, int, WorkspaceRole], Any],
) -> list[TagRead]:
    resource = loader(session, current_user, workspace_id, resource_id, WorkspaceRole.viewer)
    return [TagRead(id=t.id, name=t.name) for t in resource.tags]


def _attach_tag_to_resource(
    session: Session,
    current_user: User,
    workspace_id: int,
    resource_id: int,
    tag_id: int,
    loader: Callable[[Session, User, int, int, WorkspaceRole], Any],
    conflict_message: str,
) -> TagRead:
    resource = loader(session, current_user, workspace_id, resource_id, WorkspaceRole.editor)
    tag = session.get(Tag, tag_id)
    if tag is None or tag.workspace_id != resource.workspace_id:
        raise HTTPException(status_code=404, detail='Tag not found')
    if tag in resource.tags:
        raise HTTPException(status_code=409, detail=conflict_message)
    resource.tags.append(tag)
    session.commit()
    return TagRead(id=tag.id, name=tag.name)


def _remove_tag_from_resource(
    session: Session,
    current_user: User,
    workspace_id: int,
    resource_id: int,
    tag_id: int,
    loader: Callable[[Session, User, int, int, WorkspaceRole], Any],
    missing_link_message: str,
) -> RemovedResponse:
    resource = loader(session, current_user, workspace_id, resource_id, WorkspaceRole.editor)
    tag = session.get(Tag, tag_id)
    if tag is None or tag.workspace_id != resource.workspace_id:
        raise HTTPException(status_code=404, detail='Tag not found')
    if tag not in resource.tags:
        raise HTTPException(status_code=404, detail=missing_link_message)
    resource.tags.remove(tag)
    session.commit()
    return RemovedResponse(removed=tag_id)


@router.get('/tags', response_model=list[TagRead])
def get_tags(ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)]):
    """List tags in a workspace."""
    current_user, session, workspace_id = ctx.destructure()
    tags = session.query(Tag).filter_by(workspace_id=workspace_id).all()
    return [TagRead(id=t.id, name=t.name) for t in tags]


@router.post('/tags', response_model=TagRead)
def post_tag(
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
    body: TagCreate,
):
    """Create a user-defined tag."""
    current_user, session, workspace_id = ctx.destructure()
    existing = session.query(Tag).filter_by(name=body.name, workspace_id=workspace_id).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Tag '{body.name}' already exists")
    tag = Tag(name=body.name, workspace_id=workspace_id)
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return TagRead(id=tag.id, name=tag.name)


@router.get('/tags/{tag_id}', response_model=TagRead)
def get_tag(
    tag_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get a tag by id."""
    current_user, session, workspace_id = ctx.destructure()
    tag = get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.viewer)
    return TagRead(id=tag.id, name=tag.name)


@router.get('/tags/{tag_id}/input_entities', response_model=list[InputEntityRef])
def get_tag_entities(
    tag_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """List all sequences and primers with this tag."""
    current_user, session, workspace_id = ctx.destructure()
    tag = get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.viewer)
    return [InputEntityRef(id=e.id, type=e.type, name=e.name) for e in tag.input_entities]


@router.delete('/tags/{tag_id}', response_model=DeletedResponse)
def delete_tag(
    tag_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Delete a tag (removes it from all entities)."""
    current_user, session, workspace_id = ctx.destructure()
    tag = get_tag_in_workspace_for_user(session, current_user, workspace_id, tag_id, WorkspaceRole.editor)
    session.delete(tag)
    session.commit()
    return DeletedResponse(deleted=tag_id)


@router.get('/input_entities/{entity_id}/tags', response_model=list[TagRead])
def get_entity_tags(
    entity_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get tags for a sequence or primer (id is input_entity id = sequence.id or primer.id)."""
    current_user, session, workspace_id = ctx.destructure()
    return _get_resource_tags(
        session,
        current_user,
        workspace_id,
        entity_id,
        get_input_entity_in_workspace_for_user,
    )


@router.post('/input_entities/{entity_id}/tags', response_model=TagRead)
def post_entity_tag(
    entity_id: int,
    body: EntityTagAttach,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Attach an existing tag to a sequence or primer."""
    current_user, session, workspace_id = ctx.destructure()
    return _attach_tag_to_resource(
        session,
        current_user,
        workspace_id,
        entity_id,
        body.tag_id,
        get_input_entity_in_workspace_for_user,
        conflict_message='Entity already has this tag',
    )


@router.delete('/input_entities/{entity_id}/tags/{tag_id}', response_model=RemovedResponse)
def delete_entity_tag(
    entity_id: int,
    tag_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Remove a tag from a sequence or primer."""
    current_user, session, workspace_id = ctx.destructure()
    return _remove_tag_from_resource(
        session,
        current_user,
        workspace_id,
        entity_id,
        tag_id,
        get_input_entity_in_workspace_for_user,
        missing_link_message='Tag not linked to this entity',
    )


@router.get('/lines/{line_id}/tags', response_model=list[TagRead])
def get_line_tags(
    line_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_viewer_workspace_ctx)],
):
    """Get tags for a line."""
    current_user, session, workspace_id = ctx.destructure()
    return _get_resource_tags(
        session,
        current_user,
        workspace_id,
        line_id,
        get_line_in_workspace_for_user,
    )


@router.post('/lines/{line_id}/tags', response_model=TagRead)
def post_line_tag(
    line_id: int,
    body: EntityTagAttach,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Attach an existing tag to a line."""
    current_user, session, workspace_id = ctx.destructure()
    return _attach_tag_to_resource(
        session,
        current_user,
        workspace_id,
        line_id,
        body.tag_id,
        get_line_in_workspace_for_user,
        conflict_message='Line already has this tag',
    )


@router.delete('/lines/{line_id}/tags/{tag_id}', response_model=RemovedResponse)
def delete_line_tag(
    line_id: int,
    tag_id: int,
    ctx: Annotated[WorkspaceContext, Depends(get_editor_workspace_ctx)],
):
    """Remove a tag from a line."""
    current_user, session, workspace_id = ctx.destructure()
    return _remove_tag_from_resource(
        session,
        current_user,
        workspace_id,
        line_id,
        tag_id,
        get_line_in_workspace_for_user,
        missing_link_message='Tag not linked to this line',
    )
