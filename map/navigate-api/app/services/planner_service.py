from app.model.navigation_result import NavigationResult
from app.model.node import Node
from app.services.distance_matrix_service import DistanceMatrixService
from app.services.route_evaluator import RouteEvaluator


class PlannerService:

    @staticmethod
    def plan(graph, current: Node, combinations: list[list[Node]]) -> NavigationResult:

        matrix = DistanceMatrixService.build(graph, current, combinations)

        best = None

        for combination in combinations:

            result = RouteEvaluator.evaluate(current, combination, matrix)

            if best is None or result.total_cost < best.total_cost:

                best = result

        return best
