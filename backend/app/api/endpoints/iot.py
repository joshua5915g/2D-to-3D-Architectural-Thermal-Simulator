"""
FastAPI IoT Endpoints & WebSocket Bridge for Live Digital Twin Sync
"""

import json
import asyncio
import logging
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from app.services.iot import iot_store, IoTSensorTelemetry, mqtt_service

logger = logging.getLogger("thermal.api.iot")

router = APIRouter()


@router.get("/sensors", response_model=List[IoTSensorTelemetry])
async def list_iot_sensors():
    """Returns the current state and variances of all registered IoT smart home sensors."""
    return iot_store.get_all_sensors()


@router.post("/telemetry", response_model=IoTSensorTelemetry)
async def ingest_sensor_telemetry(payload: IoTSensorTelemetry):
    """
    Ingest a live sensor payload via HTTP REST webhook.
    Enables integrations with Home Assistant, ESPHome, or custom microcontrollers.
    """
    iot_store.update_sensor(payload)
    return payload


@router.websocket("/ws")
async def iot_websocket_stream(websocket: WebSocket):
    """
    Real-time WebSocket feed that pushes live sensor telemetry and variance delta
    to the Next.js Digital Twin frontend.
    """
    await websocket.accept()
    queue = asyncio.Queue(maxsize=100)
    iot_store.add_listener(queue)

    try:
        # Initial state burst
        initial_data = [s.model_dump() for s in iot_store.get_all_sensors()]
        await websocket.send_json({
            "type": "INITIAL_SENSORS",
            "sensors": initial_data,
        })

        while True:
            # Wait for next event or client ping
            telemetry_data = await queue.get()
            await websocket.send_json({
                "type": "SENSOR_TELEMETRY",
                "sensor": telemetry_data,
            })
    except WebSocketDisconnect:
        logger.info("Client disconnected from IoT WebSocket.")
    except Exception as e:
        logger.warning(f"IoT WebSocket exception: {e}")
    finally:
        iot_store.remove_listener(queue)
