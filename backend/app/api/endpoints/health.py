from fastapi import APIRouter
import time

router = APIRouter()


@router.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "Architectural Thermal PINN Microservice",
        "timestamp": int(time.time()),
    }
