"""
graph.py
--------
Hospital Workflow Navigation API — all-in-one.
Chạy: uvicorn graph:app --reload

TRƯỚC KHI CHẠY, phải set biến môi trường MYSQL_URL:
  Linux/Mac   : export MYSQL_URL="mysql+pymysql://root:PASSWORD@localhost:3306/hospital"
  Windows CMD : set MYSQL_URL=mysql+pymysql://root:PASSWORD@localhost:3306/hospital
  Windows PS  : $env:MYSQL_URL="mysql+pymysql://root:PASSWORD@localhost:3306/hospital"
"""

from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, String, Integer, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import networkx as nx
from typing import Optional
import os

# ─────────────────────────────────────────────
# CONFIG
# Đọc từ biến môi trường — không hardcode password.
# Nếu chưa set sẽ báo lỗi rõ ràng ngay khi khởi động.
# ─────────────────────────────────────────────

MYSQL_URL = os.environ.get("MYSQL_URL")
if not MYSQL_URL:
    raise RuntimeError(
        "Chưa set biến môi trường MYSQL_URL.\n"
        "Ví dụ: export MYSQL_URL='mysql+pymysql://root:PASSWORD@localhost:3306/hospital'"
    )

engine = create_engine(MYSQL_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

# Các room_id tồn tại trong DB nhưng KHÔNG có trên frontend map
EXCLUDED_ROOMS = {"ER-01"}


# ─────────────────────────────────────────────
# ORM MODELS
# ─────────────────────────────────────────────

class Room(Base):
    """
    Mỗi node trên bản đồ bệnh viện.
    room_type: 'clinical' | 'blood_lab' | 'xray' | 'ultrasound' | 'endoscopy'
               | 'hall' | 'elevator' | 'reception' | 'emergency'
    """
    __tablename__ = "rooms"
    room_id       = Column(String(30),  primary_key=True)
    floor         = Column(Integer,     nullable=True)   # None = shared (Elevator)
    room_type     = Column(String(50))
    department    = Column(String(100))
    current_queue = Column(Integer, default=0)


class MapEdge(Base):
    """Cạnh trong đồ thị bản đồ — load khi khởi động."""
    __tablename__ = "map_edges"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    from_node = Column(String(30))
    to_node   = Column(String(30))
    weight    = Column(Float)


class WorkflowRule(Base):
    """
    Định nghĩa luồng khám theo nhóm bệnh.
    step_order=1 : khám lâm sàng (chọn phòng clinical tối ưu)
    step_order=2 : xét nghiệm máu (bắt buộc)
    step_order>=3: cận lâm sàng tiếp theo tuỳ nhóm bệnh
    """
    __tablename__ = "workflow_rules"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    disease_group = Column(String(100))
    step_order    = Column(Integer)
    required_type = Column(String(50))


class Doctor(Base):
    __tablename__ = "doctors"
    id         = Column(String(50),  primary_key=True)
    name       = Column(String(100))
    department = Column(String(100))
    room_id    = Column(String(30))
    priority   = Column(String(20))


class Appointment(Base):
    __tablename__ = "appointments"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    patient_id       = Column(String(50))
    patient_name     = Column(String(100))
    doctor_id        = Column(String(50))
    appointment_date = Column(String(20))
    appointment_time = Column(String(20))
    reason           = Column(String(500))


# ─────────────────────────────────────────────
# GRAPH BUILDER
# ─────────────────────────────────────────────

def build_graph(db: Session) -> nx.Graph:
    G = nx.Graph()
    for e in db.query(MapEdge).all():
        G.add_edge(e.from_node, e.to_node, weight=e.weight)
    return G


# ─────────────────────────────────────────────
# DB DEPENDENCY
# ─────────────────────────────────────────────

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# CORE ROUTING ALGORITHM
# ─────────────────────────────────────────────

def best_room_for_type(
    G: nx.Graph,
    current_pos: str,
    room_type: str,
    db: Session,
) -> Optional[tuple]:
    """
    Trả về (room, distance, path) tối ưu:
      1. Ưu tiên queue ít nhất
      2. Nếu queue bằng nhau → khoảng cách ngắn nhất
    Loại trừ EXCLUDED_ROOMS (không có trên frontend map).
    """
    candidates = (
        db.query(Room)
        .filter(Room.room_type == room_type)
        .filter(~Room.room_id.in_(EXCLUDED_ROOMS))
        .all()
    )

    scored = []
    for room in candidates:
        if room.room_id not in G:
            continue
        try:
            dist = nx.shortest_path_length(G, current_pos, room.room_id, weight="weight")
            path = nx.shortest_path(G, current_pos, room.room_id, weight="weight")
            scored.append((room, dist, path))
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            continue

    if not scored:
        return None

    scored.sort(key=lambda x: (x[0].current_queue, x[1]))
    return scored[0]


# ─────────────────────────────────────────────
# APP
# ─────────────────────────────────────────────

app = FastAPI(title="Hospital Workflow Navigation API")


class NavigationRequest(BaseModel):
    patient_id:       str
    disease_group:    str        # vd: "nam_khoa", "tieu_hoa", "tim_mach"
    current_location: str = "Reception"


@app.post("/navigate")
def navigate(req: NavigationRequest, db: Session = Depends(get_db)):
    # 1. Load workflow rules theo disease_group
    rules = (
        db.query(WorkflowRule)
        .filter(WorkflowRule.disease_group == req.disease_group)
        .order_by(WorkflowRule.step_order)
        .all()
    )
    if not rules:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy workflow cho nhóm bệnh: {req.disease_group}",
        )

    # 2. Build graph và validate starting node
    G = build_graph(db)
    if req.current_location not in G:
        raise HTTPException(
            status_code=400,
            detail=f"Vị trí bắt đầu '{req.current_location}' không có trong graph.",
        )

    current_pos = req.current_location
    stages = []
    full_path = [current_pos]

    for rule in rules:
        result = best_room_for_type(G, current_pos, rule.required_type, db)
        if result is None:
            raise HTTPException(
                status_code=500,
                detail=(
                    f"Không tìm được phòng loại '{rule.required_type}' "
                    f"từ '{current_pos}'"
                ),
            )

        room, dist, path = result
        full_path.extend(path[1:])   # tránh lặp node hiện tại

        stages.append({
            "step":          rule.step_order,
            "required_type": rule.required_type,
            "room_id":       room.room_id,
            "department":    room.department,
            "floor":         room.floor,
            "queue":         room.current_queue,
            "distance":      round(dist, 1),
            "path_segment":  path,
        })

        current_pos = room.room_id

    return {
        "patient_id":    req.patient_id,
        "disease_group": req.disease_group,
        "full_path":     full_path,
        "summary":       " → ".join(full_path),
        "stages":        stages,
    }


@app.get("/rooms")
def list_rooms(db: Session = Depends(get_db)):
    return db.query(Room).all()


@app.get("/room-types")
def room_types(db: Session = Depends(get_db)):
    """
    Trả về mapping room_id -> {room_type, department, floor, queue}.
    Frontend dùng để highlight màu theo loại phòng.
    Loại trừ EXCLUDED_ROOMS vì không có trên frontend map.
    """
    rooms = (
        db.query(Room)
        .filter(~Room.room_id.in_(EXCLUDED_ROOMS))
        .all()
    )
    return {
        r.room_id: {
            "room_type":  r.room_type,
            "department": r.department,
            "floor":      r.floor,
            "queue":      r.current_queue,
        }
        for r in rooms
    }


@app.patch("/rooms/{room_id}/queue")
def update_queue(room_id: str, delta: int, db: Session = Depends(get_db)):
    """
    Tăng/giảm queue sau khi bệnh nhân vào/ra phòng.
    delta = +1 (vào) | -1 (ra)
    """
    room = db.query(Room).filter(Room.room_id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room {room_id} không tồn tại")
    room.current_queue = max(0, room.current_queue + delta)
    db.commit()
    db.refresh(room)
    return {"room_id": room_id, "current_queue": room.current_queue}


@app.get("/workflow-rules/{disease_group}")
def get_workflow(disease_group: str, db: Session = Depends(get_db)):
    rules = (
        db.query(WorkflowRule)
        .filter(WorkflowRule.disease_group == disease_group)
        .order_by(WorkflowRule.step_order)
        .all()
    )
    if not rules:
        raise HTTPException(
            status_code=404,
            detail=f"Không tìm thấy workflow: {disease_group}",
        )
    return rules


@app.get("/doctors")
def list_doctors(db: Session = Depends(get_db)):
    return db.query(Doctor).all()


@app.get("/doctors/room/{room_id}")
def doctors_by_room(room_id: str, db: Session = Depends(get_db)):
    """Trả về danh sách bác sĩ đang trực ở một phòng cụ thể."""
    doctors = db.query(Doctor).filter(Doctor.room_id == room_id).all()
    if not doctors:
        raise HTTPException(status_code=404, detail=f"Không có bác sĩ ở phòng {room_id}")
    return doctors