from dataclasses import dataclass

@dataclass
class SegmentResult:
    from_room: str
    to_room: str
    path: list[str]
    cost: float