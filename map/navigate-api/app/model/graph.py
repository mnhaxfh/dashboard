from dataclasses import dataclass, field

@dataclass
class Graph:

    nodes: dict[str, Node] = field(default_factory=dict)

    adjacency: dict[str, list[Edge]] = field(default_factory=dict)

    room_type_index: dict[str, list[Node]] = field(default_factory=dict)