import torch
import torch.nn as nn
from typing import Tuple


class ThermalPINN(nn.Module):
    """
    Physics-Informed Neural Network approximating the 3D Laplace/Poisson Heat Equation
    within architectural volumes and envelope boundaries:
    k * (d^2T/dx^2 + d^2T/dy^2 + d^2T/dz^2) + Q_solar = 0
    """

    def __init__(self, hidden_dim: int = 64, num_layers: int = 4):
        super().__init__()

        layers = [nn.Linear(3, hidden_dim), nn.Tanh()]
        for _ in range(num_layers - 1):
            layers.extend([nn.Linear(hidden_dim, hidden_dim), nn.Tanh()])

        layers.append(nn.Linear(hidden_dim, 1))
        self.network = nn.Sequential(*layers)

    def forward(self, xyz: torch.Tensor) -> torch.Tensor:
        """
        Input: (N, 3) spatial coordinates [x, y, z]
        Output: (N, 1) temperature in Celsius
        """
        return self.network(xyz)

    def compute_pde_residual(
        self, xyz: torch.Tensor, thermal_diffusivity: float = 0.05
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Calculates second-order spatial derivatives via PyTorch autograd.
        """
        xyz.requires_grad_(True)
        t = self.forward(xyz)

        # First derivatives: dT/dx, dT/dy, dT/dz
        grads = torch.autograd.grad(
            outputs=t,
            inputs=xyz,
            grad_outputs=torch.ones_like(t),
            create_graph=True,
            retain_graph=True,
        )[0]

        dt_dx = grads[:, 0:1]
        dt_dy = grads[:, 1:2]
        dt_dz = grads[:, 2:3]

        # Second derivatives: d^2T/dx^2, d^2T/dy^2, d^2T/dz^2
        d2t_dx2 = torch.autograd.grad(
            dt_dx, xyz, grad_outputs=torch.ones_like(dt_dx), create_graph=True
        )[0][:, 0:1]
        d2t_dy2 = torch.autograd.grad(
            dt_dy, xyz, grad_outputs=torch.ones_like(dt_dy), create_graph=True
        )[0][:, 1:2]
        d2t_dz2 = torch.autograd.grad(
            dt_dz, xyz, grad_outputs=torch.ones_like(dt_dz), create_graph=True
        )[0][:, 2:3]

        laplacian = d2t_dx2 + d2t_dy2 + d2t_dz2
        pde_residual = thermal_diffusivity * laplacian

        return t, pde_residual
