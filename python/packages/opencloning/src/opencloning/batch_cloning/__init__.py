from fastapi.responses import FileResponse
import os
from ..get_router import get_router

router = get_router()


@router.get('/batch_cloning')
def batch_cloning():
    return FileResponse(os.path.join(os.path.dirname(__file__), 'index.html'))
