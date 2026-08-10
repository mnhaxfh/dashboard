from dataclasses import dataclass

from app.model.segment_result import SegmentResult


@dataclass
class NavigationResult:
    selected_rooms: list[str]
    segments: list[SegmentResult]
    total_path: list[str]
    total_cost: float