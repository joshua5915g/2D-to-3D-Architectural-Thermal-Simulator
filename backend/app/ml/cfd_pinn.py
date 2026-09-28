"""
Computational Fluid Dynamics (CFD) Physics-Informed Neural Network (PINN)
Enforces steady-state incompressible Navier-Stokes equations with Boussinesq thermal buoyancy
to simulate architectural cross-ventilation and thermal stack effects.
"""

import math
import logging
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import torch
import torch.nn as nn
from app.models.schemas import (
    CFDSimulateRequest,
    CFDSimulationResponse,
    WindowStateSpec,
    ElementType,
)

logger = logging.getLogger("thermal.cfd")


class NavierStokesPINN(nn.Module):
    """
    Physics-Informed Neural Network predicting 3D velocity vector (u, v, w)
    and scalar kinematic pressure p = P / rho:
    Input: (x, y, z) in [0, 1]^3
    Output: (u, v, w, p)
    """

    def __init__(self, hidden_dim: int = 48, num_layers: int = 4):
        super().__init__()
        layers = [nn.Linear(3, hidden_dim), nn.SiLU()]
        for _ in range(num_layers - 2):
            layers.append(nn.Linear(hidden_dim, hidden_dim))
            layers.append(nn.SiLU())
        layers.append(nn.Linear(hidden_dim, 4))
        self.net = nn.Sequential(*layers)

    def forward(self, xyz: torch.Tensor) -> torch.Tensor:
        return self.net(xyz)


def compute_navier_stokes_loss(
    model: nn.Module,
    xyz: torch.Tensor,
    nu: float = 1.5e-5,          # Kinematic viscosity of air (normalized)
    beta_g: float = 0.033,        # Boussinesq thermal expansion * gravity
    delta_T: float = 3.5,         # Indoor - Outdoor temperature excess
) -> torch.Tensor:
    """
    Computes Navier-Stokes PDE residuals for incompressibility and momentum:
      1. Continuity: div(u) = du/dx + dv/dy + dw/dz = 0
      2. X-Momentum: (u·grad)u + dp/dx - nu*laplacian(u) = 0
      3. Y-Momentum: (u·grad)v + dp/dy - nu*laplacian(v) = 0
      4. Z-Momentum: (u·grad)w + dp/dz - nu*laplacian(w) - beta*g*delta_T = 0
    """
    xyz.requires_grad_(True)
    pred = model(xyz)
    u = pred[:, 0:1]
    v = pred[:, 1:2]
    w = pred[:, 2:3]
    p = pred[:, 3:4]

    # --- First spatial derivatives ---
    grad_u = torch.autograd.grad(u, xyz, torch.ones_like(u), create_graph=True, retain_graph=True)[0]
    du_dx, du_dy, du_dz = grad_u[:, 0:1], grad_u[:, 1:2], grad_u[:, 2:3]

    grad_v = torch.autograd.grad(v, xyz, torch.ones_like(v), create_graph=True, retain_graph=True)[0]
    dv_dx, dv_dy, dv_dz = grad_v[:, 0:1], grad_v[:, 1:2], grad_v[:, 2:3]

    grad_w = torch.autograd.grad(w, xyz, torch.ones_like(w), create_graph=True, retain_graph=True)[0]
    dw_dx, dw_dy, dw_dz = grad_w[:, 0:1], grad_w[:, 1:2], grad_w[:, 2:3]

    grad_p = torch.autograd.grad(p, xyz, torch.ones_like(p), create_graph=True, retain_graph=True)[0]
    dp_dx, dp_dy, dp_dz = grad_p[:, 0:1], grad_p[:, 1:2], grad_p[:, 2:3]

    # Continuity (Mass Conservation)
    continuity = du_dx + dv_dy + dw_dz
    loss_continuity = torch.mean(continuity**2)

    # --- Second derivatives (Laplacians for Viscous Diffusion) ---
    d2u_dx2 = torch.autograd.grad(du_dx, xyz, torch.ones_like(du_dx), create_graph=True, retain_graph=True)[0][:, 0:1]
    d2u_dy2 = torch.autograd.grad(du_dy, xyz, torch.ones_like(du_dy), create_graph=True, retain_graph=True)[0][:, 1:2]
    d2u_dz2 = torch.autograd.grad(du_dz, xyz, torch.ones_like(du_dz), create_graph=True, retain_graph=True)[0][:, 2:3]
    laplacian_u = d2u_dx2 + d2u_dy2 + d2u_dz2

    d2v_dx2 = torch.autograd.grad(dv_dx, xyz, torch.ones_like(dv_dx), create_graph=True, retain_graph=True)[0][:, 0:1]
    d2v_dy2 = torch.autograd.grad(dv_dy, xyz, torch.ones_like(dv_dy), create_graph=True, retain_graph=True)[0][:, 1:2]
    d2v_dz2 = torch.autograd.grad(dv_dz, xyz, torch.ones_like(dv_dz), create_graph=True, retain_graph=True)[0][:, 2:3]
    laplacian_v = d2v_dx2 + d2v_dy2 + d2v_dz2

    d2w_dx2 = torch.autograd.grad(dw_dx, xyz, torch.ones_like(dw_dx), create_graph=True, retain_graph=True)[0][:, 0:1]
    d2w_dy2 = torch.autograd.grad(dw_dy, xyz, torch.ones_like(dw_dy), create_graph=True, retain_graph=True)[0][:, 1:2]
    d2w_dz2 = torch.autograd.grad(dw_dz, xyz, torch.ones_like(dw_dz), create_graph=True, retain_graph=True)[0][:, 2:3]
    laplacian_w = d2w_dx2 + d2w_dy2 + d2w_dz2

    # Convective Advection (u·grad)u
    adv_u = u * du_dx + v * du_dy + w * du_dz
    adv_v = u * dv_dx + v * dv_dy + w * dv_dz
    adv_w = u * dw_dx + v * dw_dy + w * dw_dz

    # Momentum residuals
    res_u = adv_u + dp_dx - (nu * laplacian_u)
    res_v = adv_v + dp_dy - (nu * laplacian_v)

    # Vertical momentum includes thermal stack effect (Boussinesq buoyancy)
    buoyancy = beta_g * delta_T * (xyz[:, 2:3])  # Stronger at higher elevations
    res_w = adv_w + dp_dz - (nu * laplacian_w) - buoyancy

    loss_momentum = torch.mean(res_u**2) + torch.mean(res_v**2) + torch.mean(res_w**2)
    return loss_continuity + loss_momentum


def generate_cfd_datasets(
    request: CFDSimulateRequest,
    n_collocation: int = 600,
    n_boundary: int = 150,
) -> Tuple[
    torch.Tensor,                  # xyz_colloc
    torch.Tensor, torch.Tensor,    # xyz_inlet, uvw_inlet
    torch.Tensor, torch.Tensor,    # xyz_outlet, p_outlet
    torch.Tensor, torch.Tensor,    # xyz_wall, uvw_wall
    List[Tuple[float, float, float]] # inlet_seed_points for streamlines
]:
    """
    Assembles collocation domain points and physical boundary conditions
    based on floorplan geometry and operable window orientations.
    """
    # 1. Interior collocation points (x, y, z)
    x_dom = np.random.uniform(0.05, 0.95, (n_collocation, 1))
    y_dom = np.random.uniform(0.05, 0.95, (n_collocation, 1))
    z_dom = np.random.uniform(0.1, 0.9, (n_collocation, 1))
    xyz_colloc = np.hstack([x_dom, y_dom, z_dom])

    # Wind vector direction in normalized 2D plane
    # wind_direction_deg: 0=N (+Y), 90=E (+X), 180=S (-Y), 270=W (-X)
    rad = math.radians(request.wind_direction_deg)
    # Meteorological azimuth: blowing FROM angle -> velocity vector is reversed
    v_norm_x = -math.sin(rad)
    v_norm_y = -math.cos(rad)
    v_mag = float(request.wind_speed_mps)

    # Window states map
    win_states: Dict[str, bool] = {
        w.window_id: w.is_open for w in request.window_states
    }

    inlet_pts = []
    inlet_vels = []
    outlet_pts = []
    outlet_pressures = []
    wall_pts = []
    inlet_seeds: List[Tuple[float, float, float]] = []

    for elem in request.vector_data.elements:
        is_window = elem.type == ElementType.WINDOW
        window_open = win_states.get(elem.id, True) if is_window else False

        coords = elem.coordinates
        if len(coords) < 2:
            continue

        for i in range(len(coords)):
            p1 = coords[i]
            p2 = coords[(i + 1) % len(coords)]
            mx = (p1[0] + p2[0]) / 2.0
            my = (p1[1] + p2[1]) / 2.0

            # Normal vector to window segment
            dx = p2[0] - p1[0]
            dy = p2[1] - p1[1]
            seg_len = math.hypot(dx, dy)
            if seg_len < 1e-4:
                continue

            # Inward pointing normal
            nx = -dy / seg_len
            ny = dx / seg_len

            # Dot product with wind direction vector
            dot = nx * v_norm_x + ny * v_norm_y

            if is_window and window_open:
                for z_val in [0.35, 0.5, 0.65]:
                    pt_3d = [mx, my, z_val]
                    if dot > 0.05:  # Windward inlet
                        inlet_pts.append(pt_3d)
                        # Open window wind velocity
                        inlet_vels.append([v_norm_x * v_mag * dot, v_norm_y * v_mag * dot, 0.05])
                        inlet_seeds.append((mx, my, z_val))
                    else:  # Leeward outlet
                        outlet_pts.append(pt_3d)
                        outlet_pressures.append([0.0])
            else:
                # Solid wall or closed window -> no-slip
                for z_val in [0.2, 0.5, 0.8]:
                    wall_pts.append([mx, my, z_val])

    # Fallback bounds if sparse
    if not inlet_pts:
        # Default windward entry point
        inlet_pts = [[0.1, 0.5, 0.5], [0.15, 0.5, 0.5]]
        inlet_vels = [[v_norm_x * v_mag, v_norm_y * v_mag, 0.0]] * 2
        inlet_seeds = [(0.1, 0.5, 0.5), (0.15, 0.5, 0.5)]

    if not outlet_pts:
        outlet_pts = [[0.9, 0.5, 0.5], [0.85, 0.5, 0.5]]
        outlet_pressures = [[0.0], [0.0]]

    if not wall_pts:
        wall_pts = [[0.5, 0.0, 0.5], [0.5, 1.0, 0.5]]

    # Zero velocity for walls
    wall_vels = [[0.0, 0.0, 0.0]] * len(wall_pts)

    return (
        torch.tensor(xyz_colloc, dtype=torch.float32),
        torch.tensor(inlet_pts, dtype=torch.float32),
        torch.tensor(inlet_vels, dtype=torch.float32),
        torch.tensor(outlet_pts, dtype=torch.float32),
        torch.tensor(outlet_pressures, dtype=torch.float32),
        torch.tensor(wall_pts, dtype=torch.float32),
        torch.tensor(wall_vels, dtype=torch.float32),
        inlet_seeds,
    )


def trace_streamlines_rk4(
    model: nn.Module,
    seeds: List[Tuple[float, float, float]],
    device: torch.device,
    max_steps: int = 60,
    ds: float = 0.025,
) -> List[List[Tuple[float, float, float, float]]]:
    """
    Integrates 3D streamlines through the predicted velocity field using RK4.
    Returns: List of curves: [[(x, y, z, velocity_mps), ...]]
    """
    model.eval()
    curves: List[List[Tuple[float, float, float, float]]] = []

    # Augment seeds with slight perturbations for volumetric stream ribbons
    augmented_seeds = []
    for sx, sy, sz in seeds[:8]:
        for d_offset in [-0.03, 0.0, 0.03]:
            for z_offset in [-0.04, 0.0, 0.04]:
                augmented_seeds.append((
                    np.clip(sx + d_offset, 0.05, 0.95),
                    np.clip(sy + d_offset, 0.05, 0.95),
                    np.clip(sz + z_offset, 0.15, 0.85),
                ))

    def get_velocity(pos: np.ndarray) -> np.ndarray:
        t_pos = torch.tensor(pos.reshape(1, 3), dtype=torch.float32, device=device)
        with torch.no_grad():
            pred = model(t_pos).cpu().numpy()[0]
        return pred[:3]

    for seed in augmented_seeds[:35]:
        traj = []
        cur_pos = np.array(seed, dtype=np.float32)

        for _ in range(max_steps):
            # Check domain bounds
            if np.any(cur_pos < 0.02) or np.any(cur_pos > 0.98):
                break

            v1 = get_velocity(cur_pos)
            speed = float(np.linalg.norm(v1))
            if speed < 0.04:  # Stagnant zone
                break

            k1 = v1 / speed

            p2 = cur_pos + 0.5 * ds * k1
            v2 = get_velocity(p2)
            k2 = v2 / max(1e-4, np.linalg.norm(v2))

            p3 = cur_pos + 0.5 * ds * k2
            v3 = get_velocity(p3)
            k3 = v3 / max(1e-4, np.linalg.norm(v3))

            p4 = cur_pos + ds * k3
            v4 = get_velocity(p4)
            k4 = v4 / max(1e-4, np.linalg.norm(v4))

            step = (ds / 6.0) * (k1 + 2 * k2 + 2 * k3 + k4)
            cur_pos = cur_pos + step

            traj.append((
                round(float(cur_pos[0]), 4),
                round(float(cur_pos[1]), 4),
                round(float(cur_pos[2]), 4),
                round(speed, 3),
            ))

        if len(traj) >= 5:
            curves.append(traj)

    return curves


def solve_cfd_ventilation(request: CFDSimulateRequest) -> CFDSimulationResponse:
    """
    Trains the NavierStokesPINN on the active architectural floorplan
    and evaluates the resulting flow field and animated streamlines.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = NavierStokesPINN(hidden_dim=48, num_layers=4).to(device)

    (
        xyz_colloc,
        xyz_inlet,
        uvw_inlet,
        xyz_outlet,
        p_outlet,
        xyz_wall,
        uvw_wall,
        inlet_seeds,
    ) = generate_cfd_datasets(request)

    xyz_colloc = xyz_colloc.to(device)
    xyz_inlet = xyz_inlet.to(device)
    uvw_inlet = uvw_inlet.to(device)
    xyz_outlet = xyz_outlet.to(device)
    p_outlet = p_outlet.to(device)
    xyz_wall = xyz_wall.to(device)
    uvw_wall = uvw_wall.to(device)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.004)
    loss_fn = nn.MSELoss()

    delta_T = max(0.5, request.indoor_avg_temp_celsius - request.outdoor_temp_celsius)

    # Quick PINN training epochs
    model.train()
    epochs = max(5, min(request.epochs, 50))
    for _ in range(epochs):
        optimizer.zero_grad()

        # 1. Incompressible Navier-Stokes PDE Loss
        loss_pde = compute_navier_stokes_loss(
            model=model,
            xyz=xyz_colloc,
            nu=1.5e-5,
            beta_g=0.033,
            delta_T=delta_T,
        )

        # 2. Inlet Window Velocity Boundary Condition
        pred_inlet = model(xyz_inlet)[:, :3]
        loss_inlet = loss_fn(pred_inlet, uvw_inlet)

        # 3. Outlet Window Pressure Boundary Condition
        pred_outlet_p = model(xyz_outlet)[:, 3:4]
        loss_outlet = loss_fn(pred_outlet_p, p_outlet)

        # 4. Solid Walls & Closed Windows No-Slip Boundary Condition
        pred_wall = model(xyz_wall)[:, :3]
        loss_wall = loss_fn(pred_wall, uvw_wall)

        total_loss = (
            loss_pde
            + (3.5 * loss_inlet)
            + (2.0 * loss_outlet)
            + (2.5 * loss_wall)
        )
        total_loss.backward()
        optimizer.step()

    # Inference grid sampling at mid-height (z = 0.5)
    model.eval()
    res = request.grid_resolution
    xs = np.linspace(0.0, 1.0, res)
    ys = np.linspace(0.0, 1.0, res)
    grid_x, grid_y = np.meshgrid(xs, ys)
    pts_2d = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)
    pts_3d = np.hstack([pts_2d, np.full((pts_2d.shape[0], 1), 0.5)])

    with torch.no_grad():
        query_tensor = torch.tensor(pts_3d, dtype=torch.float32, device=device)
        pred_grid = model(query_tensor).cpu().numpy()
        vel_mag = np.linalg.norm(pred_grid[:, :3], axis=1).reshape(res, res)

    # Convert to 2D matrix slice
    vel_slice = [[round(float(val), 3) for val in row] for row in vel_mag]
    max_vel = float(np.max(vel_mag))
    avg_vel = float(np.mean(vel_mag))

    # Air renewal efficiency (> 0.2 m/s comfort threshold)
    effective_cells = np.sum(vel_mag > 0.2)
    cross_eff = round(float(effective_cells / (res * res)) * 100.0, 1)

    # Estimate Air Changes per Hour (ACH)
    # ACH = 3600 * Q_inlet / House Volume
    open_count = sum(1 for w in request.window_states if w.is_open)
    if not request.window_states:
        open_count = 3  # Default assumption

    ach = round(max(0.5, (open_count * 1.8 * avg_vel * 3600.0) / 450.0), 1)

    # 3D Streamline tracing via RK4
    streamlines = trace_streamlines_rk4(model, inlet_seeds, device)

    return CFDSimulationResponse(
        velocity_grid=[vel_slice],
        streamlines=streamlines,
        grid_resolution=res,
        max_velocity_mps=round(max_vel, 2),
        avg_velocity_mps=round(avg_vel, 2),
        air_changes_per_hour=ach,
        cross_ventilation_efficiency=cross_eff,
        open_window_count=open_count,
        status="COMPLETED",
        message="Navier-Stokes CFD ventilation simulation completed successfully.",
    )
