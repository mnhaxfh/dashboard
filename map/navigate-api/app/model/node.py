from dataclasses import dataclass, field
from typing import Any
@dataclass(slots=True)
class Node:
    id: str
    building: int
    floor: int
    x: float
    y: float
    label: str
    type: str
    room_type: str
    properties: dict[str, Any] = field(default_factory=dict)