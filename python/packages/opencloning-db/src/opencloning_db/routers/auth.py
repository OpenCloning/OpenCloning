"""Current user endpoint."""

from typing import Annotated

from fastapi import APIRouter, Depends

from opencloning_db.apimodels import UserPublic
from opencloning_db.deps import get_current_user
from opencloning_db.models import User

router = APIRouter(prefix='/auth', tags=['auth'])


@router.get('/me', response_model=UserPublic)
def read_me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserPublic:
    return UserPublic(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        is_instance_admin=current_user.is_instance_admin,
    )
