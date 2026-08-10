"""
seed_db.py
----------
Chạy một lần để tạo bảng và nhét data vào MySQL.

TRƯỚC KHI CHẠY, phải set biến môi trường MYSQL_URL:
  Linux/Mac   : export MYSQL_URL="mysql+pymysql://root:PASSWORD@localhost:3306/hospital"
  Windows CMD : set MYSQL_URL=mysql+pymysql://root:PASSWORD@localhost:3306/hospital
  Windows PS  : $env:MYSQL_URL="mysql+pymysql://root:PASSWORD@localhost:3306/hospital"

Sau đó chạy: python seed_db.py

CẢNH BÁO: seed_db.py sẽ XÓA SẠCH và tạo lại toàn bộ bảng.
Nếu DB đã có data thì KHÔNG chạy file này.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from graph import Base, Room, MapEdge, WorkflowRule, Doctor, Appointment

MYSQL_URL = os.environ.get("MYSQL_URL")
if not MYSQL_URL:
    raise RuntimeError(
        "Chưa set biến môi trường MYSQL_URL.\n"
        "Ví dụ: export MYSQL_URL='mysql+pymysql://root:PASSWORD@localhost:3306/hospital'"
    )

engine = create_engine(MYSQL_URL)
Base.metadata.drop_all(engine)    # reset sạch
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
db = Session()

# ─────────────────────────────────────────────
# 1. ROOMS
# room_id phải khớp chính xác với label trong floorConfigs của frontend.
# ─────────────────────────────────────────────
rooms = [
    # ── Infrastructure ──────────────────────────────────────────────────────
    Room(room_id="Reception", floor=1,    room_type="reception", department="Lễ tân",   current_queue=0),
    Room(room_id="Hall_F1",   floor=1,    room_type="hall",      department="",current_queue=0),
    Room(room_id="Hall_F2",   floor=2,    room_type="hall",      department="",current_queue=0),
    Room(room_id="Stair_case",   floor=2,    room_type="hall",      department="",               current_queue=0)

    # ── Tầng 1 — Phòng khám ─────────────────────────────────────────────────
    Room(room_id="101",  floor=1, room_type="administrative",  department="Phòng hồ sơ",   current_queue=5),
    Room(room_id="102",  floor=1, room_type="administrative", department="Phòng hồ sơ", current_queue=7),
    Room(room_id="Technical-1",  floor=1, room_type="technical",  department="Khu vực kỹ thuật",   current_queue=2),
    Room(room_id="Technical-2",  floor=1, room_type="clinical",  department="Khu vực kỹ thuật",current_queue=2),
    Room(room_id="100",  floor=1, room_type="clinical",  department="Phòng khám",    current_queue=3),
    Room(room_id="103",  floor=1, room_type="clinical",  department="Phòng khám",   current_queue=2),
    Room(room_id="104",  floor=1, room_type="clinical",  department="Phòng khám",   current_queue=2),
    Room(room_id="105",  floor=1, room_type="clinical",  department="Phòng khám",   current_queue=2),
    Room(room_id="106",  floor=1, room_type="clinical",  department="Phòng khám",   current_queue=2),
    Room(room_id="107",  floor=1, room_type="clinical",  department="Phòng khám",   current_queue=2),
    Room(room_id="108",  floor=1, room_type="clinical",  department="Phòng siêu âm",   current_queue=2),
    Room(room_id="109",  floor=1, room_type="clinical",  department="Phòng siêu âm",   current_queue=2),
    Room(room_id="110",  floor=1, room_type="clinical",  department="Phòng X quang",   current_queue=2),
    Room(room_id="111",  floor=1, room_type="clinical",  department="Phòng X quang",   current_queue=2),
    Room(room_id="112",  floor=1, room_type="clinical",  department="Phòng siêu âm",   current_queue=2),

    
    Room(room_id="115",  floor=1, room_type="clinical",  department="Phòng cấp cứu",   current_queue=2),
    Room(room_id="Elevator-1",  floor=1, room_type="elevator",  department="Thang máy",current_queue=0),
    Room(room_id="Elevator-2",  floor=1, room_type="elevator",  department="Thang máy",current_queue=0),
    Room(room_id="Elevator-3",  floor=1, room_type="elevator",  department="Thang máy",current_queue=0),
    Room(room_id="Elevator-3",  floor=1, room_type="elevator",  department="Thang máy",current_queue=0),
    Room(room_id="Stair_case-1",   floor=1,    room_type="stair_case",department="Cầu thang bộ",current_queue=0),
    Room(room_id="Stair_case-2",   floor=1,    room_type="stair_case",      department="Cầu thang bộ",current_queue=0),
    Room(room_id="Exit-1",   floor=1,    room_type="exit",      department="Lối thoát hiểm",current_queue=0),
    Room(room_id="Exit-2",   floor=1,    room_type="exit",      department="Lối thoát hiểm",current_queue=0),
    Room(room_id="Toilet-1",   floor=1,    room_type="toilet",      department="Nhà vệ sinh",current_queue=0),
    Room(room_id="Toilet-2",   floor=1,    room_type="toilet",      department="Nhà vệ sinh",current_queue=0),
    Room(room_id="Hall-1",   floor=1,    room_type="hall",      department="Sảnh chờ",current_queue=0),
    Room(room_id="Hall-1",   floor=1,    room_type="hall",      department="Sảnh chờ",current_queue=0),
    Room(room_id="Cashier",   floor=1,    room_type="cashier",      department="Cashier",current_queue=0),
    Room(room_id="Pharmacy",  floor=1, room_type="pharmacy",  department="Pharmacy",current_queue=0),
    Room(room_id="Department-of-Pharmacy",  floor=1, room_type="department_pharmecy",  department="department_pharmecy",current_queue=0),


    # Tầng 2
    Room(room_id="201",  floor=2, room_type="administrative",  department="Khoa xét nghiệm",   current_queue=5),
    Room(room_id="202",  floor=2, room_type="administrative",  department="Phòng thủ thuật",   current_queue=5),
    Room(room_id="203",  floor=2, room_type="administrative",  department="Phòng khám phụ khoa",   current_queue=5),
    Room(room_id="204",  floor=2, room_type="administrative",  department="Phòng rửa dụng cụ",   current_queue=5),
    Room(room_id="205",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="206",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="207",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="208",  floor=2, room_type="clinical",  department="Phòng siêu âm nam",   current_queue=5),
    Room(room_id="Toilet",floor=2,    room_type="toilet",      department="Nhà vệ sinh",current_queue=0),
    Room(room_id="Stair_case-1",   floor=2,    room_type="stair_case-1",department="Cầu thang bộ",current_queue=0),
    Room(room_id="Elevator-1",  floor=2, room_type="elevator-1",  department="Thang máy",current_queue=0),
    Room(room_id="Elevator-2",  floor=2, room_type="elevator-2",  department="Thang máy",current_queue=0),
    Room(room_id="209",  floor=2, room_type="clinical",  department="Phòng giám đốc chuyên môn",   current_queue=5),
    Room(room_id="210",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="211",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="212",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="213",  floor=2, room_type="clinical",  department="Phòng khám",   current_queue=5),
    Room(room_id="214",  floor=2, room_type="clinical",  department="Phòng xét nghiệm tế bào",   current_queue=5),
    Room(room_id="215",  floor=2, room_type="clinical",  department="Phòng siêu âm",   current_queue=5),
    Room(room_id="217",  floor=2, room_type="clinical",  department="Kho",   current_queue=5),
    Room(room_id="Blood-lab",  floor=2, room_type="blood_lab",  department="Khu vực xét nghiệm lấy mẫu",   current_queue=5),
    Room(room_id="220",  floor=2, room_type="clinical",  department="Phòng lấy tinh chất 1",   current_queue=5),
    Room(room_id="221",  floor=2, room_type="clinical",  department="Phòng lấy tinh chất 2",   current_queue=5),
    Room(room_id="222",  floor=2, room_type="clinical",  department="Phòng lấy tinh chất 3",   current_queue=5),
    Room(room_id="223",  floor=2, room_type="clinical",  department="Phòng lấy tinh chất 4",   current_queue=5),
    Room(room_id="Stair_case-2",   floor=2,    room_type="stair_case-2",department="Cầu thang bộ",current_queue=0),
    
]
db.bulk_save_objects(rooms)

# ─────────────────────────────────────────────
# 2. MAP EDGES  (undirected → insert 2 chiều)
# Chỉ chứa node CÓ TRÊN frontend map.
# ─────────────────────────────────────────────
raw_edges = [
    ("Reception", "Hall_F1",   10),
    ("Hall_F1",   "101",        5),
    ("Hall_F1",   "115",        7),
    ("Hall_F1",   "120",        8),
    ("Hall_F1",   "125",       10),
    ("Hall_F1",   "130",       12),
    ("Hall_F1",   "Elevator",  15),
    ("Elevator",  "Hall_F2",    5),
    ("Hall_F2",   "204",        5),
    ("Hall_F2",   "210",       10),
    ("Hall_F2",   "220",       12),
    ("Hall_F2",   "240",        8),
    ("Hall_F2",   "250",       14),
    ("Hall_F2",   "260",       16),
    ("Hall_F2",   "270",       18),
]

edges = []
for (a, b, w) in raw_edges:
    edges.append(MapEdge(from_node=a, to_node=b, weight=w))
    edges.append(MapEdge(from_node=b, to_node=a, weight=w))
db.bulk_save_objects(edges)

# ───────────────────────────────────────────── 
# 3. WORKFLOW RULES
# ─────────────────────────────────────────────
workflow = [
    WorkflowRule(disease_group="nam_khoa",  step_order=1, required_type="clinical"),
    WorkflowRule(disease_group="nam_khoa",  step_order=2, required_type="blood_lab"),
    WorkflowRule(disease_group="nam_khoa",  step_order=3, required_type="ultrasound"),

    WorkflowRule(disease_group="tieu_hoa",  step_order=1, required_type="clinical"),
    WorkflowRule(disease_group="tieu_hoa",  step_order=2, required_type="blood_lab"),
    WorkflowRule(disease_group="tieu_hoa",  step_order=3, required_type="endoscopy"),
    WorkflowRule(disease_group="tieu_hoa",  step_order=4, required_type="xray"),

    WorkflowRule(disease_group="tim_mach",  step_order=1, required_type="clinical"),
    WorkflowRule(disease_group="tim_mach",  step_order=2, required_type="blood_lab"),
    WorkflowRule(disease_group="tim_mach",  step_order=3, required_type="xray"),

    WorkflowRule(disease_group="than_kinh", step_order=1, required_type="clinical"),
    WorkflowRule(disease_group="than_kinh", step_order=2, required_type="blood_lab"),
    WorkflowRule(disease_group="than_kinh", step_order=3, required_type="xray"),
    WorkflowRule(disease_group="than_kinh", step_order=4, required_type="ultrasound"),

    WorkflowRule(disease_group="da_lieu",   step_order=1, required_type="clinical"),
    WorkflowRule(disease_group="da_lieu",   step_order=2, required_type="blood_lab"),
    WorkflowRule(disease_group="da_lieu",   step_order=3, required_type="xray"),
]
db.bulk_save_objects(workflow)

# ─────────────────────────────────────────────
# 4. DOCTORS
# ─────────────────────────────────────────────
doctors = [
    Doctor(id="D01", name="BS. Nguyễn Văn An",   department="Nam khoa",    room_id="120",   priority="Normal"),
    Doctor(id="D02", name="BS. Trần Thị Bình",   department="Tiêu hoá",    room_id="130",   priority="Normal"),
    Doctor(id="D03", name="BS. Lê Minh Châu",    department="Nội khoa",    room_id="101",   priority="Normal"),
    Doctor(id="D04", name="BS. Phạm Hồng Đức",   department="Tim mạch",    room_id="240",   priority="Normal"),
    Doctor(id="D05", name="BS. Hoàng Thị Em",    department="Thần kinh",   room_id="260",   priority="Normal"),
    Doctor(id="D06", name="BS. Vũ Quốc Hùng",    department="Cấp cứu",     room_id="ER-01", priority="Emergency"),
    Doctor(id="D07", name="BS. Đặng Thị Phương", department="Da liễu",     room_id="125",   priority="Normal"),
    Doctor(id="D08", name="BS. Nguyễn Thị Lan",  department="Tiêu hoá CK", room_id="270",   priority="Normal"),
]
db.bulk_save_objects(doctors)

# ─────────────────────────────────────────────
# 5. SAMPLE APPOINTMENTS
# ─────────────────────────────────────────────
appointments = [
    Appointment(
        patient_id="BN001", patient_name="Nguyễn Văn A",
        doctor_id="D01", appointment_date="2025-06-01",
        appointment_time="08:00", reason="Khám định kỳ",
    ),
    Appointment(
        patient_id="BN002", patient_name="Trần Thị B",
        doctor_id="D02", appointment_date="2025-06-01",
        appointment_time="08:30", reason="Đau bụng",
    ),
]
db.bulk_save_objects(appointments)

db.commit()
db.close()
print("✅ Seed xong! DB hospital đã có đủ dữ liệu.")
print("   Chạy API: uvicorn graph:app --reload")