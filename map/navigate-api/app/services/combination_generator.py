from itertools import product

from app.model.node import Node


class CombinationGenerator:

    @staticmethod
    def generate(
        candidates: dict[str, list[Node]]
    ) -> list[list[Node]]:

        room_lists = list(candidates.values())

        return [
            list(combination)
            for combination in product(*room_lists)
        ]