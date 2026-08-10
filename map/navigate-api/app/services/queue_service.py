import random
class QueueService:
    def __init__(self):
        self._queues = {}

    def get_queue(self, room_id: str) -> int:

        if room_id not in self._queues:
            self._queues[room_id] = 0;
        return self._queues[room_id]
    
    def get_queues(self, room_repo: dict[str, list[str]]) -> dict[str, list[dict[str,int]]]:
        result = {}
        for room_type, rooms in room_repo.items():
            result[room_type] = []
            for room in rooms:
                queue_value = self.get_queue(room.id)
                result[room_type].append({room.id: queue_value})
        print(result)
        return result

    def update_queue(self, room_id: str, value: int):

        self._queues[room_id] = value