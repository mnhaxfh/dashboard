from dataclasses import dataclass

@dataclass(slots=True)
class Edge:
    id: str
    from_node: str
    to_node: str

    distance: float
    weight: float

    cost: float

    edge_type: str

    bidirectional: bool