import math
from typing import Dict, Any, List, Optional
from app.models.schemas import (
    EnvelopeMaterialType,
    EnvelopeMaterialSpec,
    GridTariffType,
    GridEmissionRegion,
    ESGCalculationRequest,
    ESGCalculationResponse,
    YearlyCashflowPoint,
)

# Material Specs Database
MATERIAL_SPECS: Dict[EnvelopeMaterialType, EnvelopeMaterialSpec] = {
    EnvelopeMaterialType.STANDARD: EnvelopeMaterialSpec(
        material_type=EnvelopeMaterialType.STANDARD,
        name="Standard Code-Minimum (R-13 Wall / Double Clear)",
        wall_r_value=13.0,
        roof_r_value=20.0,
        window_u_value=0.48,
        shgc=0.65,
        capex_premium_per_sqft=0.0,
    ),
    EnvelopeMaterialType.HIGH_EFFICIENCY: EnvelopeMaterialSpec(
        material_type=EnvelopeMaterialType.HIGH_EFFICIENCY,
        name="High-Performance Envelope (R-24 Cellulose / Double Low-E Argon)",
        wall_r_value=24.0,
        roof_r_value=38.0,
        window_u_value=0.28,
        shgc=0.35,
        capex_premium_per_sqft=3.80,
    ),
    EnvelopeMaterialType.PASSIVE_HOUSE_ULTRA: EnvelopeMaterialSpec(
        material_type=EnvelopeMaterialType.PASSIVE_HOUSE_ULTRA,
        name="Passive House Ultra (R-40 VIP Aerogel / Triple Low-E Krypton)",
        wall_r_value=40.0,
        roof_r_value=60.0,
        window_u_value=0.16,
        shgc=0.22,
        capex_premium_per_sqft=7.50,
    ),
}

# Regional Grid Carbon Factors (kg CO2e / kWh)
GRID_CARBON_FACTORS: Dict[GridEmissionRegion, float] = {
    GridEmissionRegion.US_AVERAGE: 0.386,
    GridEmissionRegion.CALIFORNIA_CLEAN: 0.210,
    GridEmissionRegion.COAL_INTENSIVE: 0.720,
    GridEmissionRegion.EU_GREEN: 0.135,
}

# Tariff Rate Structures ($/kWh)
TARIFF_RATES = {
    GridTariffType.FLAT: {
        "rate": 0.185,
        "demand_charge_monthly": 15.0,
    },
    GridTariffType.TIME_OF_USE: {
        "peak_rate": 0.320,      # Summer 12:00 - 19:00
        "off_peak_rate": 0.135,  # Night / morning
        "demand_charge_monthly": 22.0,
    },
}

NET_ZERO_THRESHOLD_KWH_PER_SQFT = 5.0  # Net-Zero Ready Cooling EUI threshold (kWh/sqft/yr)


def compute_envelope_conductance(area_sqft: float, ceiling_height_m: float, spec: EnvelopeMaterialSpec) -> float:
    """
    Computes total building envelope UA (W/K) based on gross floor area and material spec.
    """
    area_m2 = area_sqft * 0.092903
    perimeter_m = 4.0 * math.sqrt(area_m2)
    envelope_wall_total = perimeter_m * ceiling_height_m
    window_area_m2 = envelope_wall_total * 0.18
    wall_area_m2 = max(0.0, envelope_wall_total - window_area_m2)
    roof_area_m2 = area_m2

    # Metric U-values (W/m²·K)
    u_wall_metric = 1.0 / (spec.wall_r_value * 0.1761)
    u_roof_metric = 1.0 / (spec.roof_r_value * 0.1761)
    u_window_metric = spec.window_u_value * 5.678

    ua_total = (
        wall_area_m2 * u_wall_metric
        + roof_area_m2 * u_roof_metric
        + window_area_m2 * u_window_metric
    )
    return ua_total


def calculate_building_energy_and_cost(
    area_sqft: float,
    ceiling_height_m: float,
    spec: EnvelopeMaterialSpec,
    tariff_type: GridTariffType,
    grid_region: GridEmissionRegion,
    simulated_temp_c: float,
    target_temp_c: float = 22.2,
    hvac_cop: float = 3.6,
) -> Dict[str, float]:
    """
    Calculates detailed annual mechanical HVAC cooling energy, overall building electricity,
    operational utility billing, and carbon footprint.
    """
    area_m2 = area_sqft * 0.092903
    ua_total = compute_envelope_conductance(area_sqft, ceiling_height_m, spec)

    # Temperature delta between indoor simulated/unconditioned and 72°F (22.2°C) target
    delta_t = max(2.5, simulated_temp_c - target_temp_c)

    # Thermal cooling extraction power (Watts)
    # Transmission heat gain + Solar aperture gain scaled by SHGC + Internal plug/occupant gains
    q_transmission_w = ua_total * delta_t * 1.4
    q_solar_gain_w = (area_m2 * 75.0) * spec.shgc
    q_internal_w = area_m2 * 8.0  # Typical residential/office equipment & occupant heat

    total_cooling_power_kw = (q_transmission_w + q_solar_gain_w + q_internal_w) / 1000.0

    # Annual equivalent full-load cooling hours (approx 1,650 hours)
    annual_cooling_hours = 1650.0
    annual_thermal_cooling_kwh = total_cooling_power_kw * annual_cooling_hours

    # Mechanical electrical power draw (kWh) = Thermal / COP
    annual_hvac_cooling_kwh = annual_thermal_cooling_kwh / max(1.5, hvac_cop)

    # Baseline non-HVAC electrical plug & lighting load (approx 3.2 kWh/sqft/year)
    annual_plug_loads_kwh = area_sqft * 3.20

    annual_total_electricity_kwh = annual_hvac_cooling_kwh + annual_plug_loads_kwh

    # Electricity cost based on tariff structure
    if tariff_type == GridTariffType.TIME_OF_USE:
        # HVAC cooling occurs predominantly during summer peak hours (70% on-peak)
        peak_rate = TARIFF_RATES[GridTariffType.TIME_OF_USE]["peak_rate"]
        off_peak_rate = TARIFF_RATES[GridTariffType.TIME_OF_USE]["off_peak_rate"]
        annual_cooling_cost = annual_hvac_cooling_kwh * (0.72 * peak_rate + 0.28 * off_peak_rate)
        annual_plug_cost = annual_plug_loads_kwh * (0.35 * peak_rate + 0.65 * off_peak_rate)
        fixed_charge = TARIFF_RATES[GridTariffType.TIME_OF_USE]["demand_charge_monthly"] * 12.0
        annual_cost_usd = annual_cooling_cost + annual_plug_cost + fixed_charge
    else:
        flat_rate = TARIFF_RATES[GridTariffType.FLAT]["rate"]
        fixed_charge = TARIFF_RATES[GridTariffType.FLAT]["demand_charge_monthly"] * 12.0
        annual_cost_usd = (annual_total_electricity_kwh * flat_rate) + fixed_charge

    # Carbon emissions (Metric Tons CO2e)
    carbon_intensity = GRID_CARBON_FACTORS.get(grid_region, 0.386)
    annual_carbon_tons = (annual_total_electricity_kwh * carbon_intensity) / 1000.0

    # Energy Use Intensity (EUI in kWh / sqft / yr)
    eui = annual_total_electricity_kwh / max(1.0, area_sqft)

    return {
        "annual_hvac_cooling_kwh": round(annual_hvac_cooling_kwh, 1),
        "annual_total_electricity_kwh": round(annual_total_electricity_kwh, 1),
        "annual_electricity_cost_usd": round(annual_cost_usd, 2),
        "annual_carbon_emissions_metric_tons": round(annual_carbon_tons, 2),
        "carbon_intensity_kg_per_kwh": carbon_intensity,
        "energy_use_intensity_kwh_per_sqft": round(eui, 2),
    }


def calculate_esg_and_roi(request: ESGCalculationRequest) -> ESGCalculationResponse:
    """
    Evaluates complete ESG, Net-Zero compliance, and Financial ROI metrics.
    Compares the selected envelope against standard code baseline.
    """
    area_sqft = request.floor_area_sqft
    sim_temp = request.simulated_avg_temp or 27.5
    target_temp = request.target_temp_celsius or 22.2

    # 1. Calculate Standard Baseline Metrics
    standard_spec = MATERIAL_SPECS[EnvelopeMaterialType.STANDARD]
    standard_results = calculate_building_energy_and_cost(
        area_sqft=area_sqft,
        ceiling_height_m=request.ceiling_height_meters,
        spec=standard_spec,
        tariff_type=request.tariff_type,
        grid_region=request.grid_region,
        simulated_temp_c=sim_temp,
        target_temp_c=target_temp,
        hvac_cop=request.hvac_cop,
    )

    # 2. Calculate Active Selected Material Metrics
    active_spec = MATERIAL_SPECS.get(request.envelope_material, standard_spec)
    active_results = calculate_building_energy_and_cost(
        area_sqft=area_sqft,
        ceiling_height_m=request.ceiling_height_meters,
        spec=active_spec,
        tariff_type=request.tariff_type,
        grid_region=request.grid_region,
        simulated_temp_c=sim_temp,
        target_temp_c=target_temp,
        hvac_cop=request.hvac_cop,
    )

    # 3. Financial CapEx and OpEx Delta
    upfront_capex_delta = round(area_sqft * active_spec.capex_premium_per_sqft, 2)
    annual_opex_savings = max(
        0.0,
        round(
            standard_results["annual_electricity_cost_usd"]
            - active_results["annual_electricity_cost_usd"],
            2,
        ),
    )

    # 4. Simple Payback Period
    if upfront_capex_delta <= 0:
        simple_payback = 0.0
    elif annual_opex_savings > 1.0:
        simple_payback = round(upfront_capex_delta / annual_opex_savings, 1)
    else:
        simple_payback = None

    # 5. 15-Year Discounted Cashflow & NPV
    r = request.discount_rate_pct / 100.0
    cashflows: List[YearlyCashflowPoint] = []
    cumulative_npv = -upfront_capex_delta
    std_cumulative = 0.0
    upg_cumulative = upfront_capex_delta

    for year in range(1, 16):
        std_annual = standard_results["annual_electricity_cost_usd"] * ((1.025) ** (year - 1))  # 2.5% inflation
        upg_annual = active_results["annual_electricity_cost_usd"] * ((1.025) ** (year - 1))
        yearly_savings = std_annual - upg_annual

        std_cumulative += std_annual
        upg_cumulative += upg_annual

        discounted_savings = yearly_savings / ((1.0 + r) ** year)
        cumulative_npv += discounted_savings

        cashflows.append(
            YearlyCashflowPoint(
                year=year,
                standard_cumulative_cost=round(std_cumulative, 2),
                upgraded_cumulative_cost=round(upg_cumulative, 2),
                net_savings=round(std_cumulative - upg_cumulative, 2),
                cumulative_npv=round(cumulative_npv, 2),
            )
        )

    # 6. Net-Zero Energy Compliance
    eui = active_results["energy_use_intensity_kwh_per_sqft"]
    net_zero_compliant = eui <= NET_ZERO_THRESHOLD_KWH_PER_SQFT
    variance_pct = round(((eui - NET_ZERO_THRESHOLD_KWH_PER_SQFT) / NET_ZERO_THRESHOLD_KWH_PER_SQFT) * 100.0, 1)

    return ESGCalculationResponse(
        annual_hvac_cooling_kwh=active_results["annual_hvac_cooling_kwh"],
        annual_total_electricity_kwh=active_results["annual_total_electricity_kwh"],
        annual_electricity_cost_usd=active_results["annual_electricity_cost_usd"],
        annual_carbon_emissions_metric_tons=active_results["annual_carbon_emissions_metric_tons"],
        carbon_intensity_kg_per_kwh=active_results["carbon_intensity_kg_per_kwh"],
        energy_use_intensity_kwh_per_sqft=eui,
        net_zero_compliant=net_zero_compliant,
        net_zero_threshold_kwh_per_sqft=NET_ZERO_THRESHOLD_KWH_PER_SQFT,
        net_zero_variance_pct=variance_pct,
        upfront_capex_delta_usd=upfront_capex_delta,
        annual_opex_savings_usd=annual_opex_savings,
        simple_payback_years=simple_payback,
        npv_15_year_usd=round(cumulative_npv, 2),
        cashflows_15_year=cashflows,
        status="COMPLETED",
        message="ESG carbon telemetry and financial ROI projected successfully.",
    )
