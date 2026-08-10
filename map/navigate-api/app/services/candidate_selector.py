from app.model.graph import Graph
from app.model.node import Node
from app.services.queue_service import QueueService


class CandidateSelector:

    def __init__(self, queue_service: QueueService):
        self.queue_service = queue_service

    def select(
        self,
        graph: Graph,
        room_types: list[str]
    ) -> dict[str, list[Node]]:
        rooms_repo = {}
        for room_type in room_types:
            rooms = graph.room_type_index.get(room_type, [])
            if not rooms:
                raise ValueError(f"Không có phòng loại {room_type}")
            rooms_repo[room_type] = rooms
        
        rooms_queues = self.queue_service.get_queues(rooms_repo)
        results = {}
        for room_type, rooms in rooms_queues.items():
            min_queue = min(room[room_id] for room in rooms for room_id in room)
            results[room_type] = [
                room_id
                for room in rooms
                for room_id in room
                if room[room_id] == min_queue
            ]
            
        return results