import math
from typing import Dict, Any


class SolarRadiationModel:
    @staticmethod
    def calculate_solar_position(
        latitude_deg: float,
        longitude_deg: float,
        day_of_year: int = 172,  # June 21 (Summer Solstice peak)
        solar_hour: float = 13.5, # 1:30 PM peak solar flux
    ) -> Dict[str, float]:
        """
        Calculates solar elevation, azimuth, and direct/diffuse radiation flux.
        """
        lat_rad = math.radians(latitude_deg)

        # Solar declination angle
        declination = 23.45 * math.sin(
            math.radians((360.0 / 365.0) * (284 + day_of_year))
        )
        dec_rad = math.radians(declination)

        # Hour angle (15 degrees per hour from solar noon)
        hour_angle_deg = 15.0 * (solar_hour - 12.0)
        hour_angle_rad = math.radians(hour_angle_deg)

        # Solar elevation angle (altitude)
        sin_elev = math.sin(lat_rad) * math.sin(dec_rad) + math.cos(lat_rad) * math.cos(
            dec_rad
        ) * math.cos(hour_angle_rad)
        sin_elev = max(-1.0, min(1.0, sin_elev))
        elevation_rad = math.asin(sin_elev)
        elevation_deg = math.degrees(elevation_rad)

        # Solar azimuth angle
        if elevation_deg > 0:
            cos_az = (
                math.sin(dec_rad) * math.cos(lat_rad)
                - math.cos(dec_rad) * math.sin(lat_rad) * math.cos(hour_angle_rad)
            ) / math.cos(elevation_rad)
            cos_az = max(-1.0, min(1.0, cos_az))
            azimuth_deg = math.degrees(math.acos(cos_az))
            if solar_hour > 12.0:
                azimuth_deg = 360.0 - azimuth_deg
        else:
            azimuth_deg = 180.0
            elevation_deg = 0.0

        # Atmospheric Direct Normal Irradiance (ASHRAE clear-sky model approximation)
        if elevation_deg > 2.0:
            air_mass = 1.0 / (math.sin(elevation_rad) + 0.50572 * ((elevation_deg + 6.07995) ** -1.6364))
            dni = 920.0 * math.exp(-0.17 * air_mass)
            dhi = 120.0 * math.sin(elevation_rad)
        else:
            dni = 0.0
            dhi = 15.0

        return {
            "azimuthDeg": round(azimuth_deg, 2),
            "elevationDeg": round(max(0.0, elevation_deg), 2),
            "directNormalIrradianceWm2": round(dni, 1),
            "diffuseHorizontalIrradianceWm2": round(dhi, 1),
        }
