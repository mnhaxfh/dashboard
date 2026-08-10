import heapq
from math import inf

from app.model.graph import Graph
from app.model.path_result import PathResult


class Dijkstra:

    @staticmethod
    def shortest_path(graph: Graph, start: str, end: str) -> PathResult:
        """
        Tìm đường đi ngắn nhất giữa 2 node bằng thuật toán Dijkstra.

        Args:
            graph: Đồ thị đã được load vào RAM.
            start: ID node bắt đầu.
            end: ID node đích.

        Returns:
            PathResult(path, total_cost)
        """

        # Kiểm tra node tồn tại
        if start not in graph.nodes:
            raise ValueError(f"Start node '{start}' không tồn tại.")

        if end not in graph.nodes:
            raise ValueError(f"End node '{end}' không tồn tại.")

        # Khởi tạo
        distance = {node_id: inf for node_id in graph.nodes}
        previous: dict[str, str] = {}
        visited: set[str] = set()

        distance[start] = 0

        priority_queue: list[tuple[float, str]] = []
        heapq.heappush(priority_queue, (0, start))

        # Dijkstra
        while priority_queue:

            current_cost, current = heapq.heappop(priority_queue)

            if current in visited:
                continue

            visited.add(current)

            # Đã tới đích
            if current == end:
                break

            # Duyệt các node kề
            for edge in graph.adjacency.get(current, []):

                neighbor = edge.to_node

                if neighbor in visited:
                    continue

                new_cost = current_cost + edge.cost

                if new_cost < distance[neighbor]:

                    distance[neighbor] = new_cost
                    previous[neighbor] = current

                    heapq.heappush(priority_queue, (new_cost, neighbor))

        # Không tìm được đường
        if distance[end] == inf:
            return PathResult(path=[], total_cost=inf)

        # Khôi phục đường đi
        path = []
        current = end

        while current != start:
            path.append(current)
            current = previous[current]

        path.append(start)
        path.reverse()

        return PathResult(path=path, total_cost=distance[end])
