import numpy as np
from typing import List, Dict, Any, Tuple


class MeshExtruder:
    @staticmethod
    def extrude_walls_to_3d(
        walls: List[Dict[str, Any]], height_meters: float = 2.8
    ) -> Dict[str, Any]:
        """
        Extrudes 2D wall line segments with thickness into 3D box prisms.
        Outputs flat vertex arrays, triangle indices, normals, and UVs for Three.js.
        """
        vertices: List[float] = []
        indices: List[int] = []
        normals: List[float] = []
        uvs: List[float] = []

        vertex_offset = 0

        for wall in walls:
            p1 = np.array([wall["startPoint"][0], wall["startPoint"][1]], dtype=float)
            p2 = np.array([wall["endPoint"][0], wall["endPoint"][1]], dtype=float)
            thickness = float(wall.get("thickness", 0.25))
            wall_h = float(wall.get("height", height_meters))

            # Wall direction vector & orthogonal normal vector
            delta = p2 - p1
            length = np.linalg.norm(delta)
            if length < 0.001:
                continue

            direction = delta / length
            normal_2d = np.array([-direction[1], direction[0]]) * (thickness / 2.0)

            # 4 base corners in 2D plane (x, z)
            c1 = p1 + normal_2d
            c2 = p2 + normal_2d
            c3 = p2 - normal_2d
            c4 = p1 - normal_2d

            # 8 3D box corners: 4 bottom (y = 0), 4 top (y = wall_h)
            # Three.js uses Y-up
            corners = [
                [c1[0], 0.0, c1[1]],      # 0: bottom front-left
                [c2[0], 0.0, c2[1]],      # 1: bottom front-right
                [c3[0], 0.0, c3[1]],      # 2: bottom back-right
                [c4[0], 0.0, c4[1]],      # 3: bottom back-left
                [c1[0], wall_h, c1[1]],   # 4: top front-left
                [c2[0], wall_h, c2[1]],   # 5: top front-right
                [c3[0], wall_h, c3[1]],   # 6: top back-right
                [c4[0], wall_h, c4[1]],   # 7: top back-left
            ]

            # Box faces (6 faces * 2 triangles = 12 triangles)
            faces = [
                # Front face (0, 1, 5, 4)
                ([0, 1, 5], [0, 5, 4], [0, 0, 1]),
                # Back face (2, 3, 7, 6)
                ([2, 3, 7], [2, 7, 6], [0, 0, -1]),
                # Left face (3, 0, 4, 7)
                ([3, 0, 4], [3, 4, 7], [-1, 0, 0]),
                # Right face (1, 2, 6, 5)
                ([1, 2, 6], [1, 6, 5], [1, 0, 0]),
                # Top face (4, 5, 6, 7)
                ([4, 5, 6], [4, 6, 7], [0, 1, 0]),
                # Bottom face (3, 2, 1, 0)
                ([3, 2, 1], [3, 1, 0], [0, -1, 0]),
            ]

            for tri1, tri2, norm in faces:
                # Add 6 vertices per face for flat normals
                idx_base = len(vertices) // 3
                face_indices = [tri1[0], tri1[1], tri1[2], tri2[1], tri2[2]]
                
                for idx in [tri1[0], tri1[1], tri1[2], tri2[0], tri2[1], tri2[2]]:
                    v = corners[idx]
                    vertices.extend([round(v[0], 3), round(v[1], 3), round(v[2], 3)])
                    normals.extend(norm)
                    uvs.extend([0.0, 1.0])

                indices.extend([
                    idx_base, idx_base + 1, idx_base + 2,
                    idx_base + 3, idx_base + 4, idx_base + 5
                ])

        return {
            "vertices": vertices,
            "indices": indices,
            "normals": normals,
            "uvs": uvs,
        }
