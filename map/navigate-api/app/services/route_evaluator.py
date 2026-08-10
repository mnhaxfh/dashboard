from app.model.distance_matrix import DistanceMatrix
from app.model.navigation_result import NavigationResult
from app.model.segment_result import SegmentResult


class RouteEvaluator:

    @staticmethod
    def evaluate(
        current: str,
        combination: list[str],
        matrix: DistanceMatrix
    ) -> NavigationResult:

        segments = []

        selected_rooms = []

        total_cost = 0

        previous = current

        for room_id in combination:

            result = matrix.get(
                previous,
                room_id
            )

            segments.append(
                SegmentResult(
                    from_room=previous,
                    to_room=room_id,
                    path=result.path,
                    cost=result.total_cost
                )
            )

            total_cost += result.total_cost

            selected_rooms.append(room_id)

            previous = room_id

        return NavigationResult(
            selected_rooms=selected_rooms,
            segments=segments,
            total_path=RouteEvaluator.merge_segments(segments),
            total_cost=total_cost
        )

    @staticmethod
    def merge_segments(
        segments: list[SegmentResult]
    ) -> list[str]:

        total_path = []

        for index, segment in enumerate(segments):

            if index == 0:
                total_path.extend(segment.path)
            else:
                total_path.extend(segment.path[1:])

        return total_path