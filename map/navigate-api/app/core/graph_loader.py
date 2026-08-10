from app.model.graph import Graph
import json
from collections import defaultdict
from app.model.graph import Graph
from app.model.node import Node
from app.model.edge import Edge


class GraphLoader:

    @staticmethod
    def load(path: str) -> Graph:
        """
        Load graph.json và xây dựng Graph object.
        """
        graph = Graph()

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        GraphLoader._load_nodes(graph, data)
        GraphLoader._load_edges(graph, data)

        return graph


    @staticmethod
    def _load_nodes(graph: Graph, data: dict):

        for building in data["buildings"]:

            building_id = building["id"]

            for floor in building["floors"]:

                for node_data in floor["nodes"]:

                    node = Node(
                        id=node_data["id"],
                        building=building_id,
                        floor=node_data["floor"],
                        x=node_data["x"],
                        y=node_data["y"],
                        label=node_data.get("label", ""),
                        type=node_data["type"],
                        room_type=node_data.get("room_type", ""),
                        properties=node_data.get("properties", {})
                    )

                    graph.nodes[node.id] = node

                    if node.room_type:
                        graph.room_type_index.setdefault(
                            node.room_type,
                            []
                        ).append(node)
                    
    @staticmethod
    def _load_edges(graph: Graph, data: dict):
        edges = data["edges"]
        for edge_data in edges:
           edge = Edge(
               id=edge_data["id"],
               from_node=edge_data["from"],
               to_node=edge_data["to"],
               distance=edge_data["distance"],
               weight=edge_data["weight"],
               cost=edge_data["distance"] * edge_data["weight"],
               edge_type=edge_data["edgeType"],
               bidirectional=edge_data["bidirectional"],
           )

           graph.adjacency.setdefault(edge.from_node, []).append(edge)

           if edge.bidirectional:

               reverse = Edge(
                   id=edge.id,
                   from_node=edge.to_node,
                   to_node=edge.from_node,
                   distance=edge.distance,
                   weight=edge.weight,
                   cost=edge.cost,
                   edge_type=edge.edge_type,
                   bidirectional=edge.bidirectional,
               )

               graph.adjacency.setdefault(reverse.from_node, []).append(reverse)
                        
    
graph = GraphLoader.load("app/data/graph.json")

print(len(graph.nodes))
print(len(graph.adjacency))
print(graph.room_type_index.keys())
                    