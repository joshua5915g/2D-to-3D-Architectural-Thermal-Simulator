"""
Live IoT Sensor Ingestion & MQTT Subscriber Service
Bridges physical smart-home environmental sensors with the Digital Twin PINN simulator.
"""

import json
import time
import math
import random
import logging
import asyncio
import threading
from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field

try:
    import paho.mqtt.client as mqtt
except ImportError:
    mqtt = None

logger = logging.getLogger("thermal.iot")


class IoTSensorTelemetry(BaseModel):
    sensor_id: str
    room_name: str = "General Zone"
    x: float = Field(..., description="Normalized domain coordinate [0, 1]")
    y: float = Field(..., description="Normalized domain coordinate [0, 1]")
    z: float = Field(default=1.2, description="Sensor elevation (meters)")
    temperature_celsius: float
    humidity_pct: float = 50.0
    simulated_temp_celsius: Optional[float] = None
    variance_celsius: Optional[float] = None
    battery_pct: float = 98.0
    rssi_dbm: int = -58
    timestamp: float = Field(default_factory=time.time)
    online: bool = True


class IoTSensorStore:
    """
    Thread-safe in-memory store for live IoT sensor telemetry.
    Distributes events to real-time WebSocket listeners.
    """
    _instance: Optional["IoTSensorStore"] = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(IoTSensorStore, cls).__new__(cls)
                cls._instance._sensors: Dict[str, IoTSensorTelemetry] = {}
                cls._instance._listeners: Set[asyncio.Queue] = set()
                cls._instance._init_default_sensors()
            return cls._instance

    def _init_default_sensors(self):
        """Seed initial architectural smart sensors."""
        defaults = [
            IoTSensorTelemetry(
                sensor_id="sensor_living_01",
                room_name="Living Area",
                x=0.35,
                y=0.40,
                z=1.2,
                temperature_celsius=22.6,
                humidity_pct=49.0,
                simulated_temp_celsius=23.1,
                variance_celsius=-0.5,
            ),
            IoTSensorTelemetry(
                sensor_id="sensor_suite_02",
                room_name="Master Suite",
                x=0.68,
                y=0.62,
                z=1.2,
                temperature_celsius=21.9,
                humidity_pct=52.5,
                simulated_temp_celsius=22.4,
                variance_celsius=-0.5,
            ),
            IoTSensorTelemetry(
                sensor_id="sensor_patio_03",
                room_name="Perimeter Glazing / Patio",
                x=0.82,
                y=0.25,
                z=1.4,
                temperature_celsius=25.8,
                humidity_pct=44.0,
                simulated_temp_celsius=26.4,
                variance_celsius=-0.6,
            ),
        ]
        for s in defaults:
            self._sensors[s.sensor_id] = s

    def update_sensor(self, telemetry: IoTSensorTelemetry):
        with self._lock:
            # Preserve simulated temp if not present in new payload
            if telemetry.simulated_temp_celsius is None and telemetry.sensor_id in self._sensors:
                telemetry.simulated_temp_celsius = self._sensors[telemetry.sensor_id].simulated_temp_celsius

            if telemetry.simulated_temp_celsius is not None:
                telemetry.variance_celsius = round(
                    telemetry.temperature_celsius - telemetry.simulated_temp_celsius, 2
                )

            self._sensors[telemetry.sensor_id] = telemetry

        # Dispatch non-blocking to active WebSockets
        self._notify_listeners(telemetry)

    def update_simulated_readings(self, sensor_sim_map: Dict[str, float]):
        """Called when PINN runs to update simulated counterparts."""
        with self._lock:
            for s_id, sim_t in sensor_sim_map.items():
                if s_id in self._sensors:
                    s = self._sensors[s_id]
                    s.simulated_temp_celsius = round(sim_t, 2)
                    s.variance_celsius = round(s.temperature_celsius - s.simulated_temp_celsius, 2)
                    self._notify_listeners(s)

    def get_all_sensors(self) -> List[IoTSensorTelemetry]:
        with self._lock:
            return list(self._sensors.values())

    def get_sensor(self, sensor_id: str) -> Optional[IoTSensorTelemetry]:
        with self._lock:
            return self._sensors.get(sensor_id)

    def add_listener(self, queue: asyncio.Queue):
        self._listeners.add(queue)

    def remove_listener(self, queue: asyncio.Queue):
        self._listeners.discard(queue)

    def _notify_listeners(self, telemetry: IoTSensorTelemetry):
        payload = telemetry.model_dump()
        for q in list(self._listeners):
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                pass
            except Exception:
                self._listeners.discard(q)


iot_store = IoTSensorStore()


class MQTTService:
    """
    Subscribes to live sensor packets over MQTT.
    Supports real brokers and automatic synthetic emulation.
    """

    def __init__(
        self,
        broker_host: str = "broker.emqx.io",
        broker_port: int = 1883,
        topic: str = "thermalsim/sensors/+/telemetry",
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.topic = topic
        self.client: Optional[mqtt.Client] = None
        self.is_connected = False
        self._synthetic_running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        """Starts MQTT listener in a background daemon thread."""
        if mqtt is not None:
            try:
                # paho-mqtt v2 compatible callback API
                self.client = mqtt.Client(
                    mqtt.CallbackAPIVersion.VERSION2,
                    client_id=f"thermalsim-twin-{random.randint(1000, 9999)}"
                )
                self.client.on_connect = self._on_connect
                self.client.on_message = self._on_message
                self.client.on_disconnect = self._on_disconnect

                # Attempt non-blocking connection
                self.client.connect_async(self.broker_host, self.broker_port, 60)
                self.client.loop_start()
                logger.info(f"MQTT Service connecting to {self.broker_host}:{self.broker_port}...")
            except Exception as e:
                logger.warning(f"Could not connect to external MQTT broker: {e}. Running local twin emulation.")

        # Always start synthetic generator so the UI always has realistic live streams
        self.start_synthetic_generator()

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            self.is_connected = True
            logger.info(f"Connected to MQTT Broker. Subscribing to: {self.topic}")
            client.subscribe(self.topic)
        else:
            logger.warning(f"Failed to connect to MQTT broker, rc={rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        self.is_connected = False
        logger.info("Disconnected from MQTT broker.")

    def _on_message(self, client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8"))
            telemetry = IoTSensorTelemetry(**payload)
            iot_store.update_sensor(telemetry)
            logger.debug(f"Received MQTT telemetry from {telemetry.sensor_id}: {telemetry.temperature_celsius}°C")
        except Exception as e:
            logger.error(f"Error parsing MQTT payload on {msg.topic}: {e}")

    def start_synthetic_generator(self):
        """Starts a background worker providing periodic realistic live fluctuations."""
        if self._synthetic_running:
            return
        self._synthetic_running = True

        def _worker():
            logger.info("Synthetic IoT Sensor stream active.")
            step = 0
            while self._synthetic_running:
                step += 1
                now = time.time()
                sensors = iot_store.get_all_sensors()
                for s in sensors:
                    # Realistic subtle diurnal / draft fluctuation (0.1 to 0.2 deg C)
                    drift = math.sin(step * 0.15 + hash(s.sensor_id) % 10) * 0.18
                    noise = (random.random() - 0.5) * 0.08
                    new_temp = round(s.temperature_celsius + drift * 0.1 + noise, 2)

                    # Keep within comfortable physical boundaries
                    new_temp = max(18.0, min(31.0, new_temp))

                    updated = s.model_copy(
                        update={
                            "temperature_celsius": new_temp,
                            "timestamp": now,
                            "humidity_pct": round(max(30.0, min(70.0, s.humidity_pct + (random.random() - 0.5) * 0.3)), 1),
                        }
                    )
                    iot_store.update_sensor(updated)

                time.sleep(2.0)

        self._thread = threading.Thread(target=_worker, daemon=True)
        self._thread.start()

    def stop(self):
        self._synthetic_running = False
        if self.client:
            try:
                self.client.loop_stop()
                self.client.disconnect()
            except Exception:
                pass


mqtt_service = MQTTService()
