@dataclass(slots=True)
class Neighbor:

    node_id: str

    cost: float

    edge: Edge