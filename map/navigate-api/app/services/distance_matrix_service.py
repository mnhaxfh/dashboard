from app.core.dijkstra import Dijkstra
from app.model.distance_matrix import DistanceMatrix
from app.model.graph import Graph


class DistanceMatrixService:

    @staticmethod
    def build(
        graph: Graph,
        current: str,
        combinations: list[list[str]]
    ) -> DistanceMatrix:

        matrix = DistanceMatrix()

        for combination in combinations:

            previous = current

            for room_id in combination:

                key = (previous, room_id)

                if key not in matrix.matrix:

                    result = Dijkstra.shortest_path(
                        graph,
                        previous,
                        room_id
                    )

                    matrix.put(
                        previous,
                        room_id,
                        result
                    )

                previous = room_id

        return matrix