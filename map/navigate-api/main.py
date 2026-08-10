from app.core.graph_loader import GraphLoader
from app.services.queue_service import QueueService
from app.services.candidate_selector import CandidateSelector
from app.services.combination_generator import CombinationGenerator
from app.services.planner_service import PlannerService


def main():

    graph = GraphLoader.load("app/data/graph.json")

    queue_service = QueueService()

    selector = CandidateSelector(queue_service)

    room_types = [
        "CLINIC"
    ]

    candidates = selector.select(
        graph,
        room_types
    )

    print("=" * 60)
    print("Candidates")
    print("=" * 60)

    for room_type, room_ids in candidates.items():
        print(f"{room_type}: {room_ids}")

    combinations = CombinationGenerator.generate(candidates)

    print()
    print("=" * 60)
    print("Combinations")
    print("=" * 60)

    for i, combination in enumerate(combinations, start=1):
        print(f"{i}. {combination}")

    current_node = "A1"  # đổi thành node bắt đầu của bạn

    result = PlannerService.plan(
        graph=graph,
        current=current_node,
        combinations=combinations
    )

    print()
    print("=" * 60)
    print("BEST RESULT")
    print("=" * 60)

    print("Selected rooms:")
    print(result.selected_rooms)

    print()

    print("Total cost:")
    print(result.total_cost)

    print()

    print("Total path:")
    print(result.total_path)

    print()

    print("Segments")

    for segment in result.segments:

        print("----------------------------------")
        print(f"{segment.from_room} -> {segment.to_room}")
        print(f"Cost : {segment.cost}")
        print(segment.path)


if __name__ == "__main__":
    main()