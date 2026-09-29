from enum import Enum
from typing import List, Tuple, Dict, Optional, Any
from pydantic import BaseModel, Field, HttpUrl


class ElementType(str, Enum):
    WALL = "wall"
    WINDOW = "window"
    DOOR = "door"


class ExtractFloorplanRequest(BaseModel):
    firebase_image_url: str = Field(
        ...,
        description="Public or authenticated Firebase Cloud Storage URL for the floorplan image",
        examples=["https://firebasestorage.googleapis.com/v0/b/.../floorplan.png"],
    )
    epsilon_factor: float = Field(
        default=0.015,
        ge=0.001,
        le=0.1,
        description="Douglas-Peucker polygon approximation tolerance factor",
    )
    min_contour_area: float = Field(
        default=80.0,
        ge=10.0,
        description="Minimum contour pixel area threshold to filter small drawing artifacts",
    )
    normalize_coordinates: bool = Field(
        default=True,
        description="Whether to normalize polygon points into [0.0, 1.0] viewport space",
    )


class ArchitecturalElement(BaseModel):
    id: str = Field(..., description="Unique element identifier (e.g. wall_0, door_2)")
    type: ElementType = Field(..., description="Classification: wall, window, or door")
    coordinates: List[Tuple[float, float]] = Field(
        ...,
        description="Ordered sequence of 2D [x, y] polygon vertices (normalized 0.0 to 1.0 or pixel metrics)",
    )
    confidence: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Detection / segmentation model confidence score",
    )
    thickness: Optional[float] = Field(
        default=None,
        description="Estimated element thickness in normalized or metric units",
    )


class FloorplanVectorData(BaseModel):
    elements: List[ArchitecturalElement] = Field(
        ..., description="List of extracted architectural vector elements"
    )
    image_dimensions: Tuple[int, int] = Field(
        ..., description="Original image dimensions [width, height] in pixels"
    )
    normalized: bool = Field(
        default=True, description="Indicates if coordinates are scaled from 0.0 to 1.0"
    )
    element_counts: Dict[str, int] = Field(
        default_factory=dict, description="Summary counts per element type"
    )
    message: Optional[str] = Field(
        default=None, description="Diagnostic status or processing summary"
    )


class HourlySolarTelemetry(BaseModel):
    hour: int = Field(..., ge=0, le=23, description="Hour of the day [0-23]")
    time_label: str = Field(..., description="Timestamp label (e.g., '14:00')")
    elevation_deg: float = Field(..., description="Sun elevation angle in degrees")
    azimuth_deg: float = Field(..., description="Sun azimuth angle in degrees")
    dni_wm2: float = Field(..., description="Direct Normal Irradiance in W/m^2")
    dhi_wm2: float = Field(..., description="Diffuse Horizontal Irradiance in W/m^2")
    window_penetration_flux_wm2: float = Field(
        default=0.0, description="Calculated solar thermal flux entering interior windows"
    )


class HVACNodeSpec(BaseModel):
    id: str = Field(..., description="Unique HVAC node identifier (e.g., 'hvac_living_1')")
    name: Optional[str] = Field(default="HVAC Terminal")
    position: Optional[Tuple[float, float, float]] = Field(
        default=None, description="3D coordinates [x, y, z] in normalized [0, 1] or metric space"
    )
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None
    setpoint_celsius: float = Field(
        default=21.0, ge=16.0, le=30.0, description="Target cooling thermostat setpoint"
    )
    cooling_capacity_kw: float = Field(
        default=3.5, ge=0.5, le=20.0, description="Nominal cooling capacity in kW"
    )
    active: bool = Field(default=True, description="Operating state of the HVAC terminal")
    radius_meters: float = Field(default=3.0)

    def get_coords(self) -> Tuple[float, float, float]:
        if self.position is not None:
            return self.position
        return (self.x if self.x is not None else 0.5, self.y if self.y is not None else 0.5, self.z if self.z is not None else 0.5)


class ShadingElementType(str, Enum):
    TREE = "tree"
    OVERHANG = "overhang"
    LOUVER = "louver"


class ExteriorShadingElementSpec(BaseModel):
    id: str = Field(..., description="Unique shading element identifier")
    type: ShadingElementType = Field(
        default=ShadingElementType.TREE,
        description="Shading intervention type: tree, overhang, or louver",
    )
    position: Tuple[float, float, float] = Field(
        default=(0.5, 0.5, 0.0), description="3D coordinates [x, y, z]"
    )
    dimensions: Tuple[float, float, float] = Field(
        default=(2.0, 2.0, 3.5),
        description="Physical dimensions [width/radius, depth, height]",
    )
    transmittance: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        description="Solar optical transmittance (0.0 = completely opaque, 0.15 = tree canopy)",
    )
    angle_deg: float = Field(
        default=0.0, description="Tilt or slat angle in degrees"
    )


class ThermalSimulateRequest(BaseModel):
    vector_data: FloorplanVectorData = Field(
        ..., description="Extracted architectural vector elements from Phase 2"
    )
    hvac_nodes: List[HVACNodeSpec] = Field(
        default_factory=list, description="Active mechanical cooling HVAC diffusers"
    )
    shading_elements: List[ExteriorShadingElementSpec] = Field(
        default_factory=list,
        description="Exterior passive solar shading elements (trees, overhangs, louvers)",
    )
    latitude: float = Field(
        default=41.3879, ge=-90.0, le=90.0, description="Site latitude in degrees"
    )
    longitude: float = Field(
        default=2.1699, ge=-180.0, le=180.0, description="Site longitude in degrees"
    )
    date: str = Field(
        default="2026-06-21", description="Simulation calendar date in YYYY-MM-DD format"
    )
    ambient_base_temp: float = Field(
        default=24.0, description="Baseline ambient outdoor temperature in Celsius"
    )
    grid_resolution: int = Field(
        default=32, ge=16, le=64, description="Spatial resolution per 2D heatmap slice"
    )
    epochs: int = Field(
        default=25, ge=5, le=100, description="Fine-tuning training epochs for PINN"
    )
    sync_with_iot: bool = Field(
        default=True, description="Whether to synchronize PINN boundary loss with live IoT telemetry"
    )


class ThermalSimulationGridResponse(BaseModel):
    time_steps: List[str] = Field(
        ..., description="List of 24 hourly interval labels ('00:00' to '23:00')"
    )
    solar_telemetry: List[HourlySolarTelemetry] = Field(
        ..., description="Calculated 24-hour solar trajectory and irradiance"
    )
    thermal_grids: List[List[List[float]]] = Field(
        ...,
        description="Temporal thermal heatmap array of shape [24, resolution, resolution] in Celsius",
    )
    grid_resolution: int = Field(..., description="Grid dimension N for N x N matrix")
    min_temperature: float = Field(..., description="Global minimum temperature in Celsius")
    max_temperature: float = Field(..., description="Global maximum temperature in Celsius")
    average_temperature: float = Field(..., description="Mean interior temperature in Celsius")
    iot_variances: Optional[Dict[str, float]] = Field(
        default=None, description="Simulated vs Actual variance delta per active IoT sensor"
    )
    status: str = Field(default="COMPLETED", description="Simulation execution status")
    message: str = Field(default="24-hour PINN thermal simulation completed.")


class GenerateFloorplanRequest(BaseModel):
    square_footage: float = Field(
        default=1800.0,
        ge=400.0,
        le=8000.0,
        description="Target interior living area in square feet",
    )
    num_bedrooms: int = Field(
        default=3,
        ge=1,
        le=8,
        description="Desired number of bedrooms",
    )
    num_bathrooms: int = Field(
        default=2,
        ge=1,
        le=6,
        description="Desired number of bathrooms",
    )
    include_balcony: bool = Field(
        default=True,
        description="Whether to include an exterior terrace or balcony boundary",
    )
    aspect_ratio: float = Field(
        default=1.33,
        ge=0.5,
        le=2.5,
        description="Target building envelope width-to-height aspect ratio",
    )
    architectural_style: str = Field(
        default="MODERN_MINIMALIST",
        description="Design taxonomy: MODERN_MINIMALIST, CONTEMPORARY_OPEN, or BIOPHILIC",
    )


class GeneratedFloorplanResponse(BaseModel):
    vector_data: FloorplanVectorData = Field(
        ..., description="Normalized 2D architectural vector geometry for 3D extrusion"
    )
    rooms: List[Dict[str, Any]] = Field(
        default_factory=list, description="Synthesized spatial room layout breakdown"
    )
    total_area_sqft: float = Field(..., description="Actual estimated square footage")
    aspect_ratio: float = Field(..., description="Envelope aspect ratio")
    generator_loss: Optional[float] = Field(
        default=None, description="GAN generator convergence metric"
    )
    status: str = Field(default="COMPLETED")
    message: str = Field(default="Floorplan synthesized successfully by Generative AI.")


class WindowStateSpec(BaseModel):
    window_id: str = Field(..., description="Identifier of the window element")
    is_open: bool = Field(default=True, description="Whether the window sash is open")
    open_fraction: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Effective open area ratio"
    )


class CFDSimulateRequest(BaseModel):
    vector_data: FloorplanVectorData = Field(
        ..., description="Extracted architectural vector elements"
    )
    window_states: List[WindowStateSpec] = Field(
        default_factory=list, description="Window operable open/closed states"
    )
    wind_speed_mps: float = Field(
        default=3.5, ge=0.1, le=20.0, description="Ambient incident wind velocity (m/s)"
    )
    wind_direction_deg: float = Field(
        default=225.0, ge=0.0, le=360.0, description="Wind azimuth angle in degrees (0 = North, 90 = East, 180 = South, 270 = West)"
    )
    outdoor_temp_celsius: float = Field(
        default=24.0, description="Outdoor ambient air temperature (Celsius)"
    )
    indoor_avg_temp_celsius: float = Field(
        default=28.0, description="Average indoor temperature for stack effect Boussinesq buoyancy"
    )
    grid_resolution: int = Field(
        default=24, ge=12, le=48, description="CFD mesh grid sampling resolution"
    )
    epochs: int = Field(
        default=20, ge=5, le=80, description="Navier-Stokes PINN training epochs"
    )


class StreamlinePoint3D(BaseModel):
    x: float
    y: float
    z: float
    velocity_mps: float
    pressure_norm: float


class CFDSimulationResponse(BaseModel):
    velocity_grid: List[List[List[float]]] = Field(
        ..., description="Planar velocity magnitude scalar field of shape [Z, Y, X]"
    )
    streamlines: List[List[Tuple[float, float, float, float]]] = Field(
        ..., description="List of 3D flow streamline trajectories: [[(x, y, z, velocity_mps), ...]]"
    )
    grid_resolution: int = Field(..., description="Grid dimension resolution")
    max_velocity_mps: float = Field(..., description="Maximum localized flow velocity in m/s")
    avg_velocity_mps: float = Field(..., description="Mean interior velocity in m/s")
    air_changes_per_hour: float = Field(
        ..., description="Estimated natural volumetric Air Changes per Hour (ACH)"
    )
    cross_ventilation_efficiency: float = Field(
        ..., description="Percentage of interior area with effective air renewal (> 0.2 m/s)"
    )
    open_window_count: int = Field(default=0, description="Number of operable open windows")
    status: str = Field(default="COMPLETED")
    message: str = Field(default="Navier-Stokes CFD ventilation simulation completed.")


class EnvelopeMaterialType(str, Enum):
    STANDARD = "STANDARD"
    HIGH_EFFICIENCY = "HIGH_EFFICIENCY"
    PASSIVE_HOUSE_ULTRA = "PASSIVE_HOUSE_ULTRA"


class GridTariffType(str, Enum):
    FLAT = "FLAT"
    TIME_OF_USE = "TIME_OF_USE"


class GridEmissionRegion(str, Enum):
    US_AVERAGE = "US_AVERAGE"
    CALIFORNIA_CLEAN = "CALIFORNIA_CLEAN"
    COAL_INTENSIVE = "COAL_INTENSIVE"
    EU_GREEN = "EU_GREEN"


class EnvelopeMaterialSpec(BaseModel):
    material_type: EnvelopeMaterialType
    name: str
    wall_r_value: float = Field(..., description="Wall thermal resistance (ft²·°F·h/BTU)")
    roof_r_value: float = Field(..., description="Roof thermal resistance (ft²·°F·h/BTU)")
    window_u_value: float = Field(..., description="Window thermal transmittance (BTU/h·ft²·°F)")
    shgc: float = Field(..., description="Solar Heat Gain Coefficient")
    capex_premium_per_sqft: float = Field(..., description="Upfront material cost premium ($/sqft)")


class ESGCalculationRequest(BaseModel):
    floor_area_sqft: float = Field(
        default=1800.0, ge=300.0, le=20000.0, description="Building gross floor area in sqft"
    )
    ceiling_height_meters: float = Field(default=2.8, ge=2.0, le=6.0)
    target_temp_celsius: float = Field(
        default=22.2, description="Target interior cooling setpoint (72°F = 22.2°C)"
    )
    envelope_material: EnvelopeMaterialType = Field(
        default=EnvelopeMaterialType.STANDARD, description="Envelope insulation and glazing grade"
    )
    tariff_type: GridTariffType = Field(
        default=GridTariffType.TIME_OF_USE, description="Utility rate structure: FLAT or TIME_OF_USE"
    )
    grid_region: GridEmissionRegion = Field(
        default=GridEmissionRegion.US_AVERAGE, description="Electrical grid carbon intensity zone"
    )
    simulated_avg_temp: Optional[float] = Field(
        default=27.5, description="Simulated average indoor temperature in Celsius from PINN"
    )
    outdoor_avg_temp: Optional[float] = Field(
        default=32.0, description="Ambient peak outdoor summer temperature in Celsius"
    )
    hvac_cop: float = Field(
        default=3.6, ge=2.0, le=6.0, description="Mechanical chiller / heat pump COP rating"
    )
    discount_rate_pct: float = Field(
        default=5.0, ge=1.0, le=15.0, description="Annual discount rate for financial NPV"
    )


class YearlyCashflowPoint(BaseModel):
    year: int
    standard_cumulative_cost: float
    upgraded_cumulative_cost: float
    net_savings: float
    cumulative_npv: float


class ESGCalculationResponse(BaseModel):
    annual_hvac_cooling_kwh: float = Field(
        ..., description="Projected annual mechanical cooling electrical demand in kWh"
    )
    annual_total_electricity_kwh: float = Field(
        ..., description="Total building annual electrical load (HVAC + baseline plug loads)"
    )
    annual_electricity_cost_usd: float = Field(
        ..., description="Projected annual utility electricity billing in USD"
    )
    annual_carbon_emissions_metric_tons: float = Field(
        ..., description="Annual Scope 2 operational greenhouse gas emissions in metric tons CO2e"
    )
    carbon_intensity_kg_per_kwh: float = Field(
        ..., description="Regional grid carbon emissions factor in kg CO2e / kWh"
    )
    energy_use_intensity_kwh_per_sqft: float = Field(
        ..., description="Energy Use Intensity (EUI) in kWh / sqft / year"
    )
    net_zero_compliant: bool = Field(
        ..., description="True if building complies with Net-Zero Energy ready thresholds (< 22 kWh/sqft/yr)"
    )
    net_zero_threshold_kwh_per_sqft: float = Field(default=22.0)
    net_zero_variance_pct: float = Field(
        ..., description="Variance from Net-Zero threshold (+% violates threshold, -% conforms)"
    )
    upfront_capex_delta_usd: float = Field(
        ..., description="Additional capital expenditure over standard baseline ($)"
    )
    annual_opex_savings_usd: float = Field(
        ..., description="Annual operating electricity cost savings compared to standard baseline ($)"
    )
    simple_payback_years: Optional[float] = Field(
        default=None, description="Simple capital payback breakeven period in years"
    )
    npv_15_year_usd: float = Field(
        ..., description="15-Year Net Present Value (NPV) of efficiency upgrade"
    )
    cashflows_15_year: List[YearlyCashflowPoint] = Field(
        default_factory=list, description="15-year cumulative financial cashflow projection"
    )
    status: str = Field(default="COMPLETED")
    message: str = Field(default="ESG & Financial ROI calculated successfully.")



