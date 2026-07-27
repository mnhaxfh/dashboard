"""
schemas.py — Pydantic schemas cho request (ingest) và response (dashboard).

Phân thành 2 nhóm:
  - *In  : schema nhận dữ liệu từ HIS admin (POST /api/ingest/*)
  - *Out : schema trả ra cho Flutter dashboard
"""

from __future__ import annotations
from typing import List, Optional
from pydantic import BaseModel


# ─────────────────────────────────────────────
# INGEST schemas (HIS admin push vào)
# ─────────────────────────────────────────────

class RoomIn(BaseModel):
    room_id:               int
    name:                  str
    type:                  Optional[str] = None
    floor:                 Optional[int] = None
    physical_capacity:     Optional[int] = None
    min_intensity_to_open: Optional[int] = None


class DoctorIn(BaseModel):
    doctor_id: int
    full_name: str


class PatientIn(BaseModel):
    patient_id:     int
    gender:         Optional[str] = None
    check_in_time:  Optional[str] = None   # ISO8601
    discharge_time: Optional[str] = None   # None = chưa xuất viện
    status:         Optional[str] = None


class VisitStepIn(BaseModel):
    step_id:      int
    patient_id:   int
    room_id:      Optional[int] = None
    doctor_id:    Optional[int] = None
    status:       Optional[str] = None
    queued_at:    Optional[str] = None
    started_at:   Optional[str] = None
    completed_at: Optional[str] = None


class VisitStepUpdate(BaseModel):
    """Chỉ cập nhật một số trường của visit_step (PATCH-style qua PUT)."""
    status:       Optional[str] = None
    started_at:   Optional[str] = None
    completed_at: Optional[str] = None


# ─────────────────────────────────────────────
# RESPONSE schemas (trả về cho Flutter)
# ─────────────────────────────────────────────

class RoomOut(BaseModel):
    room_id:               int
    name:                  Optional[str]
    type:                  Optional[str]
    floor:                 Optional[int]
    physical_capacity:     Optional[int]
    min_intensity_to_open: Optional[int]

    model_config = {"from_attributes": True}


class DoctorOut(BaseModel):
    doctor_id: int
    full_name: Optional[str]

    model_config = {"from_attributes": True}


class PatientOut(BaseModel):
    patient_id:     int
    gender:         Optional[str]
    check_in_time:  Optional[str]
    discharge_time: Optional[str]
    status:         Optional[str]

    model_config = {"from_attributes": True}


class VisitStepOut(BaseModel):
    step_id:      int
    patient_id:   int
    room_id:      Optional[int]
    doctor_id:    Optional[int]
    status:       Optional[str]
    queued_at:    Optional[str]
    started_at:   Optional[str]
    completed_at: Optional[str]
    # embedded
    room_name:    Optional[str] = None
    room_type:    Optional[str] = None
    doctor_name:  Optional[str] = None

    model_config = {"from_attributes": True}


class IngestResponse(BaseModel):
    """Response chung cho các endpoint ingest."""
    upserted: int
    message:  str = "OK"
