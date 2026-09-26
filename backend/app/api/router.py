from fastapi import APIRouter
from app.api.endpoints import health, vision, thermal
from app.api import extract

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(vision.router, tags=["Floorplan & Vision Pipeline"])
api_router.include_router(
    extract.router, prefix="/vision", tags=["Architectural Vision Extraction"]
)
api_router.include_router(thermal.router, tags=["Thermal & Solar"])

