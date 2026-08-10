from dataclasses import dataclass, field

from app.model.path_result import PathResult


@dataclass
class DistanceMatrix:

    matrix: dict[tuple[str, str], PathResult] = field(
        default_factory=dict
    )

    def put(
        self,
        start: str,
        end: str,
        result: PathResult
    ) -> None:

        self.matrix[(start, end)] = result

    def get(
        self,
        start: str,
        end: str
    ) -> PathResult:

        return self.matrix[(start, end)]