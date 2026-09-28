from fastapi import APIRouter
from app.api.endpoints import health, vision, thermal, generative, iot, cfd
from app.api import extract

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(vision.router, tags=["Floorplan & Vision Pipeline"])
api_router.include_router(
    extract.router, prefix="/vision", tags=["Architectural Vision Extraction"]
)
api_router.include_router(
    thermal.router, prefix="/thermal", tags=["Thermal & Solar PINN"]
)
api_router.include_router(thermal.router, tags=["Thermal & Solar (Direct)"])
api_router.include_router(
    generative.router, prefix="/generate", tags=["Generative Floorplan AI"]
)
api_router.include_router(generative.router, tags=["Generative Floorplan AI (Direct)"])
api_router.include_router(
    iot.router, prefix="/iot", tags=["Live IoT Digital Twin"]
)
api_router.include_router(iot.router, tags=["Live IoT (Direct)"])
api_router.include_router(
    cfd.router, prefix="/cfd", tags=["CFD & Natural Ventilation"]
)
api_router.include_router(cfd.router, tags=["CFD & Natural Ventilation (Direct)"])


