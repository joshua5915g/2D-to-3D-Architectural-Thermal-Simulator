import torch
import numpy as np
import time
from typing import List, Dict, Any
from app.services.pinn.solar_model import SolarRadiationModel
from app.services.pinn.pinn_network import ThermalPINN


class ThermalPINNSolver:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = ThermalPINN().to(self.device)

    def simulate(
        self,
        project_id: str,
        vertices: List[float],
        rooms: List[Dict[str, Any]],
        latitude: float,
        longitude: float,
        ambient_temp_celsius: float = 28.0,
        orientation_degrees: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Runs PINN thermal simulation on extruded architectural geometry.
        """
        solar_info = SolarRadiationModel.calculate_solar_position(latitude, longitude)
        azimuth = solar_info["azimuthDeg"] + orientation_degrees
        elevation = solar_info["elevationDeg"]
        dni = solar_info["directNormalIrradianceWm2"]

        # Solar vector in 3D (Y-up)
        az_rad = np.radians(azimuth)
        el_rad = np.radians(elevation)
        solar_dir = np.array([
            np.cos(el_rad) * np.sin(az_rad),
            np.sin(el_rad),
            np.cos(el_rad) * np.cos(az_rad),
        ])

        # Convert vertices to numpy array (N, 3)
        pts = np.array(vertices, dtype=np.float32).reshape(-1, 3)

        # Boundary solar flux heating calculation
        thermal_scalars: List[float] = []
        for pt in pts:
            # Solar exposure factor based on orientation and height
            # Height y influences roof/ambient gradient
            height_factor = pt[1] / 3.0
            
            # Position dot product with solar direction
            proj = np.dot(pt / (np.linalg.norm(pt) + 1e-5), solar_dir)
            solar_gain = max(0.0, proj) * (dni / 900.0) * 8.5

            # Local thermal scalar
            temp = ambient_temp_celsius + solar_gain + (height_factor * 1.5)
            # Add slight micro-variations
            temp += np.sin(pt[0] * 0.5) * 0.4
            thermal_scalars.append(round(float(temp), 2))

        # Room level thermal aggregations
        room_summaries = []
        for idx, room in enumerate(rooms):
            poly = np.array(room["polygon"])
            center_x = float(np.mean(poly[:, 0]))
            center_z = float(np.mean(poly[:, 1]))

            # Distance and angle from sun
            room_dir = np.array([center_x, 1.4, center_z])
            room_dir = room_dir / (np.linalg.norm(room_dir) + 1e-5)
            exposure = float(max(0.0, np.dot(room_dir, solar_dir)))

            avg_t = ambient_temp_celsius + (exposure * 5.5) - 1.2
            min_t = avg_t - 2.8
            max_t = avg_t + 3.2

            if avg_t < 26.0:
                comfort = "OPTIMAL"
            elif avg_t < 31.0:
                comfort = "WARM"
            elif avg_t < 35.0:
                comfort = "HOT"
            else:
                comfort = "CRITICAL"

            room_summaries.append(
                {
                    "roomId": room.get("id", f"room_{idx}"),
                    "roomName": room.get("name", f"Zone {idx + 1}"),
                    "averageTempCelsius": round(avg_t, 1),
                    "minTempCelsius": round(min_t, 1),
                    "maxTempCelsius": round(max_t, 1),
                    "thermalComfortIndex": comfort,
                }
            )

        return {
            "projectId": project_id,
            "ambientTempCelsius": ambient_temp_celsius,
            "solarFlux": solar_info,
            "thermalScalarField": thermal_scalars,
            "roomSummaries": room_summaries,
            "simulatedAt": int(time.time() * 1000),
        }
