import torch
import torch.nn as nn
import numpy as np
from typing import List, Tuple, Dict, Any, Optional
from app.models.schemas import (
    ThermalSimulateRequest,
    ThermalSimulationGridResponse,
    HourlySolarTelemetry,
    ElementType,
)


class ThermalPINN(nn.Module):
    """
    Spatio-Temporal Physics-Informed Neural Network (PINN) for transient
    architectural heat transfer:
    dT/dt - alpha * (d^2T/dx^2 + d^2T/dy^2) = Q(x, y, t)
    """

    def __init__(
        self,
        hidden_dim: int = 64,
        num_layers: int = 4,
        base_temp: float = 24.0,
    ):
        super().__init__()
        self.base_temp = base_temp

        layers = [nn.Linear(3, hidden_dim), nn.Tanh()]
        for _ in range(num_layers - 1):
            layers.extend([nn.Linear(hidden_dim, hidden_dim), nn.Tanh()])

        out_layer = nn.Linear(hidden_dim, 1)
        # Initialize output layer around base temperature
        nn.init.xavier_uniform_(out_layer.weight, gain=0.1)
        nn.init.constant_(out_layer.bias, base_temp)

        layers.append(out_layer)
        self.net = nn.Sequential(*layers)

    def forward(self, xyt: torch.Tensor) -> torch.Tensor:
        """
        Input: (N, 3) where columns are [x, y, t_norm] in [0, 1]
        Output: (N, 1) predicted temperature in Celsius
        """
        return self.net(xyt)


def compute_pde_loss(
    model: nn.Module,
    xyt: torch.Tensor,
    alpha: float = 0.04,
    source_q: Optional[torch.Tensor] = None,
) -> torch.Tensor:
    """
    Calculates PDE residual loss via PyTorch autograd:
    Loss_pde = mean( (dT/dt - alpha * (d^2T/dx^2 + d^2T/dy^2) - Q)^2 )
    """
    xyt.requires_grad_(True)
    T = model(xyt)

    # First derivatives
    grads = torch.autograd.grad(
        outputs=T,
        inputs=xyt,
        grad_outputs=torch.ones_like(T),
        create_graph=True,
        retain_graph=True,
    )[0]

    dt_dx = grads[:, 0:1]
    dt_dy = grads[:, 1:2]
    dt_dt = grads[:, 2:3]

    # Second spatial derivatives (Laplacian)
    d2t_dx2 = torch.autograd.grad(
        outputs=dt_dx,
        inputs=xyt,
        grad_outputs=torch.ones_like(dt_dx),
        create_graph=True,
        retain_graph=True,
    )[0][:, 0:1]

    d2t_dy2 = torch.autograd.grad(
        outputs=dt_dy,
        inputs=xyt,
        grad_outputs=torch.ones_like(dt_dy),
        create_graph=True,
        retain_graph=True,
    )[0][:, 1:2]

    laplacian = d2t_dx2 + d2t_dy2
    q = 0.0 if source_q is None else source_q

    pde_residual = dt_dt - (alpha * laplacian) - q
    return torch.mean(pde_residual**2)


def generate_collocation_dataset(
    request: ThermalSimulateRequest,
    solar_telemetry: List[HourlySolarTelemetry],
    n_collocation: int = 500,
    n_boundary: int = 200,
) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
    """
    Generates training collocation points, boundary condition points, and initial condition points.
    """
    # 1. Domain interior collocation points (x, y, t)
    x_dom = np.random.uniform(0.05, 0.95, (n_collocation, 1))
    y_dom = np.random.uniform(0.05, 0.95, (n_collocation, 1))
    t_dom = np.random.uniform(0.0, 1.0, (n_collocation, 1))
    xyt_colloc = np.hstack([x_dom, y_dom, t_dom])

    # Approximate internal source term Q from solar window penetration
    # Hours with peak penetration inject thermal energy into interior
    window_gain_by_t = np.zeros((n_collocation, 1))
    for i in range(n_collocation):
        hour_idx = int(t_dom[i, 0] * 23.0)
        hour_flux = solar_telemetry[hour_idx].window_penetration_flux_wm2
        # Windows shine across floorplan
        window_gain_by_t[i, 0] = (hour_flux / 500.0) * 0.15

    # 2. Boundary condition points along perimeter/envelope
    # Extract wall and window elements
    wall_points: List[Tuple[float, float]] = []
    window_points: List[Tuple[float, float]] = []

    for elem in request.vector_data.elements:
        for pt in elem.coordinates:
            if elem.type == ElementType.WINDOW:
                window_points.append(pt)
            else:
                wall_points.append(pt)

    # Fallback envelope points if floorplan empty
    if not wall_points:
        wall_points = [
            (0.0, 0.0),
            (1.0, 0.0),
            (1.0, 1.0),
            (0.0, 1.0),
            (0.5, 0.0),
            (0.5, 1.0),
        ]

    # Sample boundary points across time
    bc_xyt_list = []
    bc_t_targets = []
    base_t = request.ambient_base_temp

    for _ in range(n_boundary):
        pt = wall_points[np.random.randint(len(wall_points))]
        t_val = np.random.uniform(0.0, 1.0)
        hour_idx = int(t_val * 23.0)
        tel = solar_telemetry[hour_idx]

        # Diurnal temperature cycle: coolest before dawn (5 AM), peak afternoon (14 PM)
        hour_float = t_val * 24.0
        diurnal_variation = 5.5 * np.sin((hour_float - 9.0) * (2 * np.pi / 24.0))

        # Solar radiation heating on exterior walls
        solar_facade_gain = (tel.dni_wm2 / 800.0) * 3.5 if tel.elevation_deg > 0 else 0.0
        boundary_temp = base_t + diurnal_variation + solar_facade_gain

        bc_xyt_list.append([pt[0], pt[1], t_val])
        bc_t_targets.append([boundary_temp])

    xyt_bc = np.array(bc_xyt_list, dtype=np.float32)
    t_bc_target = np.array(bc_t_targets, dtype=np.float32)

    # 3. Initial condition points (t = 0, midnight)
    x_ic = np.random.uniform(0.0, 1.0, (100, 1))
    y_ic = np.random.uniform(0.0, 1.0, (100, 1))
    t_ic = np.zeros((100, 1))
    xyt_ic = np.hstack([x_ic, y_ic, t_ic])
    # Midnight ambient baseline (cool)
    t_ic_target = np.full((100, 1), base_t - 2.5, dtype=np.float32)

    return (
        torch.tensor(xyt_colloc, dtype=torch.float32),
        torch.tensor(window_gain_by_t, dtype=torch.float32),
        torch.tensor(xyt_bc, dtype=torch.float32),
        torch.tensor(t_bc_target, dtype=torch.float32),
        torch.tensor(xyt_ic, dtype=torch.float32),
    )


def solve_24h_thermal_grid(
    request: ThermalSimulateRequest,
    solar_telemetry: List[HourlySolarTelemetry],
) -> ThermalSimulationGridResponse:
    """
    Trains the Physics-Informed Neural Network (PINN) and generates
    the 24-hour temporal grid temperature matrix of shape [24, N, N].
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    model = ThermalPINN(
        hidden_dim=48,
        num_layers=4,
        base_temp=request.ambient_base_temp,
    ).to(device)

    # Generate training points
    (
        xyt_colloc,
        source_q,
        xyt_bc,
        t_bc_target,
        xyt_ic,
    ) = generate_collocation_dataset(request, solar_telemetry)

    xyt_colloc = xyt_colloc.to(device)
    source_q = source_q.to(device)
    xyt_bc = xyt_bc.to(device)
    t_bc_target = t_bc_target.to(device)
    xyt_ic = xyt_ic.to(device)
    t_ic_target = torch.full((xyt_ic.shape[0], 1), request.ambient_base_temp - 2.5, device=device)

    optimizer = torch.optim.Adam(model.parameters(), lr=0.003)
    loss_fn = nn.MSELoss()

    # Training loop
    model.train()
    epochs = max(5, min(request.epochs, 50))
    for _ in range(epochs):
        optimizer.zero_grad()

        # 1. Physics loss (PDE residual)
        loss_pde = compute_pde_loss(model, xyt_colloc, alpha=0.03, source_q=source_q)

        # 2. Boundary condition loss
        pred_bc = model(xyt_bc)
        loss_bc = loss_fn(pred_bc, t_bc_target)

        # 3. Initial condition loss
        pred_ic = model(xyt_ic)
        loss_ic = loss_fn(pred_ic, t_ic_target)

        total_loss = loss_pde + (2.0 * loss_bc) + (1.5 * loss_ic)
        total_loss.backward()
        optimizer.step()

    # Inference across 24 hours on grid
    model.eval()
    res = request.grid_resolution
    xs = np.linspace(0.0, 1.0, res)
    ys = np.linspace(0.0, 1.0, res)
    grid_x, grid_y = np.meshgrid(xs, ys)
    pts_2d = np.stack([grid_x.ravel(), grid_y.ravel()], axis=1)

    thermal_grids: List[List[List[float]]] = []
    time_steps: List[str] = []

    global_min = float("inf")
    global_max = float("-inf")
    all_temps = []

    with torch.no_grad():
        for hour in range(24):
            t_norm = hour / 23.0
            time_steps.append(f"{hour:02d}:00")

            t_col = np.full((pts_2d.shape[0], 1), t_norm)
            query_xyt = torch.tensor(
                np.hstack([pts_2d, t_col]), dtype=torch.float32, device=device
            )
            t_pred = model(query_xyt).cpu().numpy().reshape(res, res)

            # Round values to 2 decimal places for clean JSON payload
            grid_slice = [[round(float(val), 2) for val in row] for row in t_pred]
            thermal_grids.append(grid_slice)

            s_min = float(t_pred.min())
            s_max = float(t_pred.max())
            if s_min < global_min:
                global_min = s_min
            if s_max > global_max:
                global_max = s_max
            all_temps.append(t_pred.mean())

    avg_temp = float(np.mean(all_temps))

    return ThermalSimulationGridResponse(
        time_steps=time_steps,
        solar_telemetry=solar_telemetry,
        thermal_grids=thermal_grids,
        grid_resolution=res,
        min_temperature=round(global_min, 2),
        max_temperature=round(global_max, 2),
        average_temperature=round(avg_temp, 2),
        status="COMPLETED",
        message="24-hour PINN thermal simulation completed successfully.",
    )
