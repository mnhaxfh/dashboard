from dataclasses import dataclass

@dataclass
class PathResult:
    path: list[str]
    total_cost: float