from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from starlette.types import ASGIApp

from .get_router import get_router

from .endpoints.primer_design import router as primer_design_router
from .endpoints.external_import import router as import_router
from .endpoints.other import router as other_router
from .endpoints.annotation import router as annotation_router
from .endpoints.assembly import router as assembly_router
from .endpoints.no_assembly import router as no_assembly_router
from .endpoints.no_input import router as no_input_router
from .app_settings import settings
from .body_size_limit import MaxBodySizeMiddleware
from .observability.middleware import RequestContextMiddleware, register_error_handlers

# =====================================================


def create_fastapi_app() -> FastAPI:
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(MaxBodySizeMiddleware, max_size_mb=settings.MAX_REQUEST_BODY_SIZE_MB)

    router = get_router()

    if not settings.SERVE_FRONTEND:

        @router.get('/')
        async def greeting(request: Request):
            html_content = """
                <html>
                    <head>
                        <title>Welcome to OpenCloning API</title>
                    </head>
                    <body>
                        <h1>Welcome to OpenCloning API</h1>
                        <p>You can access the endpoints documentation <a href="./docs">here</a></p>
                    </body>
                </html>
                """
            return HTMLResponse(content=html_content, status_code=200)

    else:
        from .app_settings import frontend_config, FrontendConfig

        app.mount('/assets', StaticFiles(directory='frontend/assets'), name='assets')
        app.mount('/examples', StaticFiles(directory='frontend/examples'), name='examples')

        @router.get('/')
        async def get_frontend_index(request: Request):
            return FileResponse('frontend/index.html')

        @router.get('/config.json', response_model=FrontendConfig)
        async def get_config_json():
            """Return frontend config file built from env vars"""
            return frontend_config

    app.include_router(import_router, tags=['External Import'])
    app.include_router(assembly_router, tags=['Assembly'])
    app.include_router(no_assembly_router, tags=['No Assembly'])
    app.include_router(other_router, tags=['Other'])
    app.include_router(no_input_router, tags=['No Input'])
    app.include_router(primer_design_router, tags=['Primer Design'])
    app.include_router(annotation_router, tags=['Annotation'])

    if settings.BATCH_CLONING:
        from .batch_cloning import router as batch_cloning_router
        from .batch_cloning.domesticate import router as domesticate_router
        from .batch_cloning.ziqiang_et_al2024 import router as ziqiang_et_al2024_router
        from .batch_cloning.pombe import router as pombe_router

        app.include_router(batch_cloning_router, tags=['Batch Cloning'])
        app.include_router(domesticate_router, tags=['Batch Cloning'])
        app.include_router(ziqiang_et_al2024_router, tags=['Batch Cloning'])
        app.include_router(pombe_router, tags=['Batch Cloning'])

    # This router must be added before the frontend StaticFiles mount. When SERVE_FRONTEND is True,
    # the mount at '/' is registered last and would otherwise take precedence over API routes.
    app.include_router(router, tags=['General'])

    if settings.SERVE_FRONTEND:
        app.mount('/', StaticFiles(directory='frontend', html=False), name='frontend')

    return app


def wrap_with_cors(app: ASGIApp) -> ASGIApp:
    # Middleware is added at the outer ASGI layer so uncaught server errors still carry CORS headers.
    return CORSMiddleware(
        app,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
        expose_headers=['x-warning', 'x-request-id'],
    )


fastapi_app = create_fastapi_app()
app = RequestContextMiddleware(wrap_with_cors(fastapi_app))
