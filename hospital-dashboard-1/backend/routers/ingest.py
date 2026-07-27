"""
routers/ingest.py — Endpoints để HIS admin push dữ liệu vào DB trung gian.

Tất cả endpoints dùng upsert (insert or update) theo primary key,
nên HIS có thể gọi lại bất kỳ lúc nào mà không lo trùng dữ liệu.

Endpoints:
  POST /api/ingest/rooms             — upsert list[RoomIn]
  POST /api/ingest/doctors           — upsert list[DoctorIn]
  POST /api/ingest/patients          — upsert list[PatientIn]
  POST /api/ingest/visit_steps       — upsert list[VisitStepIn]
  PUT  /api/ingest/visit_steps/{id}  — cập nhật 1 step (status / thời gian)
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from db import get_db
from models import Room, Doctor, Patient, VisitStep
from schemas import (
    RoomIn, DoctorIn, PatientIn, VisitStepIn, VisitStepUpdate,
    IngestResponse,
)

router = APIRouter(prefix="/api/ingest", tags=["ingest"])


def _upsert(db: Session, Model, pk_field: str, items: list) -> int:
    """
    Generic upsert: nếu bản ghi đã tồn tại (theo PK) thì update,
    nếu chưa có thì insert.
    Trả về số bản ghi đã xử lý.
    """
    count = 0
    for item_data in items:
        pk_val = item_data[pk_field]
        existing = db.get(Model, pk_val)
        if existing:
            for k, v in item_data.items():
                setattr(existing, k, v)
        else:
            db.add(Model(**item_data))
        count += 1
    db.commit()
    return count


@router.post("/rooms", response_model=IngestResponse)
def ingest_rooms(rooms: List[RoomIn], db: Session = Depends(get_db)):
    """
    Upsert danh sách phòng khám.

    Ví dụ body:
    [
      {"room_id": 101, "name": "Phòng khám tổng quát", "type": "clinic",
       "floor": 1, "physical_capacity": 4, "min_intensity_to_open": 2}
    ]
    """
    n = _upsert(db, Room, "room_id", [r.model_dump() for r in rooms])
    return IngestResponse(upserted=n, message=f"Đã upsert {n} phòng.")


@router.post("/doctors", response_model=IngestResponse)
def ingest_doctors(doctors: List[DoctorIn], db: Session = Depends(get_db)):
    """
    Upsert danh sách bác sĩ.

    Ví dụ body:
    [{"doctor_id": 1, "full_name": "Bs. Nguyễn Văn A"}]
    """
    n = _upsert(db, Doctor, "doctor_id", [d.model_dump() for d in doctors])
    return IngestResponse(upserted=n, message=f"Đã upsert {n} bác sĩ.")


@router.post("/patients", response_model=IngestResponse)
def ingest_patients(patients: List[PatientIn], db: Session = Depends(get_db)):
    """
    Upsert danh sách bệnh nhân.
    - discharge_time = null → bệnh nhân đang trong viện (active).
    - Gọi lại khi BN xuất viện để cập nhật discharge_time.

    Ví dụ body:
    [
      {"patient_id": 1001, "gender": "M",
       "check_in_time": "2026-07-28T08:00:00",
       "discharge_time": null, "status": "đang chờ"}
    ]
    """
    n = _upsert(db, Patient, "patient_id", [p.model_dump() for p in patients])
    return IngestResponse(upserted=n, message=f"Đã upsert {n} bệnh nhân.")


@router.post("/visit_steps", response_model=IngestResponse)
def ingest_visit_steps(steps: List[VisitStepIn], db: Session = Depends(get_db)):
    """
    Upsert danh sách visit_steps (hành trình khám của BN).

    Ví dụ body:
    [
      {"step_id": 5001, "patient_id": 1001, "room_id": 101, "doctor_id": 1,
       "status": "chưa khám", "queued_at": "2026-07-28T08:05:00",
       "started_at": null, "completed_at": null}
    ]
    """
    n = _upsert(db, VisitStep, "step_id", [s.model_dump() for s in steps])
    return IngestResponse(upserted=n, message=f"Đã upsert {n} visit_steps.")


@router.put("/visit_steps/{step_id}", response_model=IngestResponse)
def update_visit_step(
    step_id: int,
    payload: VisitStepUpdate,
    db: Session = Depends(get_db),
):
    """
    Cập nhật trạng thái / thời gian của 1 visit_step theo step_id.
    Dùng khi HIS chỉ muốn gửi thay đổi nhỏ (BN bắt đầu / hoàn tất bước khám).

    Ví dụ: đánh dấu BN bắt đầu khám:
      PUT /api/ingest/visit_steps/5001
      {"status": "đang khám", "started_at": "2026-07-28T08:30:00"}
    """
    step = db.get(VisitStep, step_id)
    if step is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy step_id={step_id}")

    update_data = payload.model_dump(exclude_none=True)
    for k, v in update_data.items():
        setattr(step, k, v)
    db.commit()
    return IngestResponse(upserted=1, message=f"Đã cập nhật step_id={step_id}.")
