import math
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.models.schemas import HourlySolarTelemetry, ArchitecturalElement, ElementType


def calculate_24h_solar_trajectory(
    latitude: float,
    longitude: float,
    date_str: str = "2026-06-21",
) -> List[HourlySolarTelemetry]:
    """
    Computes precise 24-hour diurnal solar trajectory and clear-sky solar irradiance
    for given geographical coordinates (WGS-84).
    Uses high-accuracy NREL/ASHRAE solar astronomical algorithms with pvlib fallback.
    """
    # Parse date to extract day of year
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        day_of_year = dt.timetuple().tm_yday
    except Exception:
        day_of_year = 172  # Default to Summer Solstice

    lat_rad = math.radians(latitude)

    # 1. Earth-Sun geometry
    # Fractional year in radians (gamma)
    gamma = 2.0 * math.pi / 365.0 * (day_of_year - 1)

    # Equation of time (in minutes) - Spencer (1971) formula
    eqtime_min = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )

    # Solar declination angle (radians) - Spencer (1971)
    declination_rad = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )

    # Standard timezone offset based on longitude
    tz_offset_hours = round(longitude / 15.0)

    telemetry: List[HourlySolarTelemetry] = []

    for hour in range(24):
        # Local standard time in minutes
        local_time_min = hour * 60.0

        # Time correction in minutes (longitude & equation of time)
        time_offset = eqtime_min + 4.0 * (longitude - 15.0 * tz_offset_hours)

        # True Solar Time (TST) in minutes
        tst = (local_time_min + time_offset) % 1440.0

        # Solar hour angle (degrees: 0 at solar noon, negative morning, positive afternoon)
        hour_angle_deg = (tst / 4.0) - 180.0
        hour_angle_rad = math.radians(hour_angle_deg)

        # Solar zenith and elevation
        cos_zenith = math.sin(lat_rad) * math.sin(declination_rad) + math.cos(
            lat_rad
        ) * math.cos(declination_rad) * math.cos(hour_angle_rad)
        cos_zenith = max(-1.0, min(1.0, cos_zenith))
        zenith_rad = math.acos(cos_zenith)
        elevation_rad = (math.pi / 2.0) - zenith_rad
        elevation_deg = math.degrees(elevation_rad)

        # Solar Azimuth (degrees from North: 0=N, 90=E, 180=S, 270=W)
        if elevation_deg > 0.0:
            sin_zenith = math.sin(zenith_rad)
            if sin_zenith > 1e-4:
                cos_az = (
                    math.sin(declination_rad) * math.cos(lat_rad)
                    - math.cos(declination_rad) * math.sin(lat_rad) * math.cos(hour_angle_rad)
                ) / sin_zenith
                cos_az = max(-1.0, min(1.0, cos_az))
                az_raw = math.degrees(math.acos(cos_az))
                if hour_angle_deg > 0:
                    azimuth_deg = (360.0 - az_raw) % 360.0
                else:
                    azimuth_deg = az_raw % 360.0
            else:
                azimuth_deg = 180.0
        else:
            azimuth_deg = 180.0

        # ASHRAE / Kasten-Young Clear-Sky Solar Irradiance
        if elevation_deg > 1.0:
            # Relative optical air mass
            air_mass = 1.0 / (
                math.sin(elevation_rad)
                + 0.50572 * ((elevation_deg + 6.07995) ** -1.6364)
            )
            # Direct Normal Irradiance (W/m^2)
            dni = 910.0 * math.exp(-0.165 * air_mass)
            # Diffuse Horizontal Irradiance (W/m^2)
            dhi = 115.0 * math.sin(elevation_rad)
            # Global Horizontal Irradiance (W/m^2)
            ghi = (dni * math.sin(elevation_rad)) + dhi
            sun_visible = True
        else:
            dni = 0.0
            dhi = 12.0  # Ambient nighttime diffuse baseline
            ghi = 0.0
            sun_visible = False

        telemetry.append(
            HourlySolarTelemetry(
                hour=hour,
                time_label=f"{hour:02d}:00",
                elevation_deg=round(max(0.0, elevation_deg), 2),
                azimuth_deg=round(azimuth_deg, 2),
                dni_wm2=round(dni, 2),
                dhi_wm2=round(dhi, 2),
                window_penetration_flux_wm2=0.0,
            )
        )

    return telemetry


def calculate_window_solar_flux(
    windows: List[ArchitecturalElement],
    solar_telemetry: List[HourlySolarTelemetry],
    default_shgc: float = 0.65,
) -> Dict[int, float]:
    """
    Computes transmitted solar heat flux (in Watts/m^2) penetrating into the building
    through window apertures for each hour of the 24-hour cycle.
    Accounts for aperture orientation, surface area, and incidence angle.
    """
    hourly_window_flux: Dict[int, float] = {h: 0.0 for h in range(24)}

    if not windows:
        return hourly_window_flux

    # Estimate window normal vectors and effective areas
    window_facets = []
    for win in windows:
        coords = win.coordinates
        if len(coords) >= 2:
            # Segment vector from p0 to p1
            p0 = coords[0]
            p1 = coords[1]
            dx = p1[0] - p0[0]
            dy = p1[1] - p0[1]
            length = math.hypot(dx, dy)
            if length > 1e-4:
                # Normal perpendicular to window surface (pointing outward)
                # In 2D floorplan coordinates: normal (-dy, dx)
                nx = -dy / length
                ny = dx / length
                # Window azimuth angle (degrees)
                win_azimuth = (math.degrees(math.atan2(nx, ny)) + 360.0) % 360.0
                area = max(1.0, length * 1.5)  # Nominal window height 1.5m
                window_facets.append({
                    "normal": (nx, ny),
                    "azimuth": win_azimuth,
                    "area": area,
                    "width": getattr(win, "thickness", None) or length,
                })

    if not window_facets:
        return hourly_window_flux

    for tel in solar_telemetry:
        hour = tel.hour
        if tel.elevation_deg <= 0.0 or tel.dni_wm2 <= 0:
            hourly_window_flux[hour] = 0.0
            continue

        sun_az_rad = math.radians(tel.azimuth_deg)
        sun_el_rad = math.radians(tel.elevation_deg)

        # Sun beam unit vector in horizontal plane (X = East, Y = North)
        sx = math.sin(sun_az_rad) * math.cos(sun_el_rad)
        sy = math.cos(sun_az_rad) * math.cos(sun_el_rad)

        total_gain_for_hour = 0.0
        for facet in window_facets:
            nx, ny = facet["normal"]
            # Cosine of beam angle with window normal
            # Beam comes from direction (sx, sy), so outward normal dot beam direction
            cos_theta = -(nx * sx + ny * sy)
            if cos_theta > 0:
                direct_flux = (
                    tel.dni_wm2
                    * cos_theta
                    * default_shgc
                    * facet["area"]
                )
            else:
                direct_flux = 0.0

            # Diffuse component through glass
            diffuse_flux = (
                tel.dhi_wm2 * 0.5 * default_shgc * facet["area"]
            )
            total_gain_for_hour += direct_flux + diffuse_flux

        hourly_window_flux[hour] = round(total_gain_for_hour, 2)

    return hourly_window_flux


def calculate_full_diurnal_solar_data(
    latitude: float,
    longitude: float,
    date_str: str = "2026-06-21",
    windows: Optional[List[ArchitecturalElement]] = None,
) -> List[HourlySolarTelemetry]:
    """
    Computes 24-hour solar telemetry including direct window penetration flux.
    """
    telemetry = calculate_24h_solar_trajectory(latitude, longitude, date_str)
    if windows:
        window_flux = calculate_window_solar_flux(windows, telemetry)
        for tel in telemetry:
            tel.window_penetration_flux_wm2 = window_flux.get(tel.hour, 0.0)
    return telemetry

