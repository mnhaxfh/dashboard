"""
seed_demo.py — Insert dữ liệu mẫu vào DB trung gian để chạy thử ngay.

Chạy:
    python seed_demo.py

Kịch bản demo:
  - 3 phòng: Khám tổng quát, Xét nghiệm, Chẩn đoán hình ảnh
  - 3 bác sĩ
  - 8 bệnh nhân với trạng thái khác nhau (đang chờ, đang khám, đã xong, ...)
  - ~16 visit_steps phân tán qua các phòng

Sau khi seed xong, gọi:
    GET http://localhost:8000/api/dashboard/summary
để xem kết quả trên dashboard.
"""

import sys
import os

# Đảm bảo import đúng module khi chạy từ thư mục backend/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from datetime import datetime, timedelta
from db import SessionLocal, init_db
from models import Room, Doctor, Patient, VisitStep

NOW = datetime.now()


def dt(minutes_ago: int) -> str:
    """Trả về chuỗi ISO8601 của thời điểm 'minutes_ago' phút trước NOW."""
    return (NOW - timedelta(minutes=minutes_ago)).strftime("%Y-%m-%dT%H:%M:%S")


ROOMS = [
    Room(room_id=101, name="Khám tổng quát",        type="clinic",  floor=1, physical_capacity=4, min_intensity_to_open=2),
    Room(room_id=102, name="Xét nghiệm",             type="lab",     floor=1, physical_capacity=6, min_intensity_to_open=3),
    Room(room_id=103, name="Chẩn đoán hình ảnh",     type="imaging", floor=2, physical_capacity=3, min_intensity_to_open=1),
    Room(room_id=104, name="Khám tim mạch",           type="clinic",  floor=2, physical_capacity=3, min_intensity_to_open=1),
    Room(room_id=105, name="Khám nội tiết",           type="clinic",  floor=3, physical_capacity=4, min_intensity_to_open=2),
]

DOCTORS = [
    Doctor(doctor_id=1, full_name="Bs. Nguyễn Văn An"),
    Doctor(doctor_id=2, full_name="Bs. Trần Thị Bình"),
    Doctor(doctor_id=3, full_name="Bs. Lê Minh Cường"),
    Doctor(doctor_id=4, full_name="Bs. Phạm Thu Dung"),
]

PATIENTS = [
    Patient(patient_id=1001, gender="M", check_in_time=dt(120), discharge_time=None,    status="đang chờ"),
    Patient(patient_id=1002, gender="F", check_in_time=dt(95),  discharge_time=None,    status="đang khám"),
    Patient(patient_id=1003, gender="M", check_in_time=dt(80),  discharge_time=None,    status="đang chờ"),
    Patient(patient_id=1004, gender="F", check_in_time=dt(60),  discharge_time=None,    status="đang khám"),
    Patient(patient_id=1005, gender="M", check_in_time=dt(55),  discharge_time=None,    status="đang chờ"),
    Patient(patient_id=1006, gender="F", check_in_time=dt(50),  discharge_time=None,    status="chưa khám"),
    Patient(patient_id=1007, gender="M", check_in_time=dt(200), discharge_time=dt(20),  status="đã xong"),
    Patient(patient_id=1008, gender="F", check_in_time=dt(180), discharge_time=dt(10),  status="đã xong"),
]

VISIT_STEPS = [
    # BN 1001 — đang chờ ở khám tổng quát (chờ 90 phút → quá SLA 45')
    VisitStep(step_id=5001, patient_id=1001, room_id=101, doctor_id=1, status="chờ kết quả", queued_at=dt(90), started_at=dt(85), completed_at=None),
    VisitStep(step_id=5002, patient_id=1001, room_id=102, doctor_id=None, status="chưa khám",  queued_at=None,   started_at=None,   completed_at=None),

    # BN 1002 — đang khám tổng quát
    VisitStep(step_id=5003, patient_id=1002, room_id=101, doctor_id=1, status="đã xong",   queued_at=dt(80), started_at=dt(75), completed_at=dt(50)),
    VisitStep(step_id=5004, patient_id=1002, room_id=102, doctor_id=None, status="đang khám", queued_at=dt(48), started_at=dt(30), completed_at=None),

    # BN 1003 — chờ xét nghiệm (50 phút → quá SLA)
    VisitStep(step_id=5005, patient_id=1003, room_id=101, doctor_id=2, status="đã xong",   queued_at=dt(70), started_at=dt(65), completed_at=dt(55)),
    VisitStep(step_id=5006, patient_id=1003, room_id=102, doctor_id=None, status="chờ kết quả", queued_at=dt(50), started_at=dt(48), completed_at=None),

    # BN 1004 — đang khám tim mạch
    VisitStep(step_id=5007, patient_id=1004, room_id=101, doctor_id=2, status="đã xong",   queued_at=dt(55), started_at=dt(50), completed_at=dt(40)),
    VisitStep(step_id=5008, patient_id=1004, room_id=104, doctor_id=3, status="đang khám", queued_at=dt(38), started_at=dt(20), completed_at=None),

    # BN 1005 — chờ chẩn đoán hình ảnh (35 phút → chưa quá SLA)
    VisitStep(step_id=5009, patient_id=1005, room_id=101, doctor_id=1, status="đã xong",   queued_at=dt(50), started_at=dt(45), completed_at=dt(38)),
    VisitStep(step_id=5010, patient_id=1005, room_id=103, doctor_id=None, status="chờ kết quả", queued_at=dt(35), started_at=dt(33), completed_at=None),

    # BN 1006 — chưa khám bước nào
    VisitStep(step_id=5011, patient_id=1006, room_id=101, doctor_id=None, status="chưa khám", queued_at=None, started_at=None, completed_at=None),
    VisitStep(step_id=5012, patient_id=1006, room_id=105, doctor_id=4,    status="chưa khám", queued_at=None, started_at=None, completed_at=None),

    # BN 1007 — đã xuất viện, tất cả bước xong
    VisitStep(step_id=5013, patient_id=1007, room_id=101, doctor_id=3, status="đã xong", queued_at=dt(195), started_at=dt(185), completed_at=dt(170)),
    VisitStep(step_id=5014, patient_id=1007, room_id=102, doctor_id=None, status="đã xong", queued_at=dt(168), started_at=dt(160), completed_at=dt(140)),

    # BN 1008 — đã xuất viện
    VisitStep(step_id=5015, patient_id=1008, room_id=104, doctor_id=4, status="đã xong", queued_at=dt(175), started_at=dt(165), completed_at=dt(145)),
    VisitStep(step_id=5016, patient_id=1008, room_id=103, doctor_id=None, status="đã xong", queued_at=dt(142), started_at=dt(130), completed_at=dt(25)),
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        # Xóa dữ liệu cũ để seed sạch
        db.query(VisitStep).delete()
        db.query(Patient).delete()
        db.query(Doctor).delete()
        db.query(Room).delete()
        db.commit()

        db.add_all(ROOMS)
        db.add_all(DOCTORS)
        db.add_all(PATIENTS)
        db.add_all(VISIT_STEPS)
        db.commit()

        print(f"[OK] Seed thanh cong!")
        print(f"   {len(ROOMS)} phong | {len(DOCTORS)} bac si | {len(PATIENTS)} benh nhan | {len(VISIT_STEPS)} visit_steps")
        print(f"\nThu ngay:\n  GET http://localhost:8000/api/dashboard/summary")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Loi khi seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
