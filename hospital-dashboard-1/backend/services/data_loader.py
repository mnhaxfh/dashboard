"""
services/data_loader.py — Đọc dữ liệu từ SQLite trung gian, tính toán KPI / phòng / SLA.

Luồng mới:
  - HIS admin push dữ liệu vào DB qua /api/ingest/*
  - Các hàm fetch_* ở đây chỉ query SQLite — hoàn toàn không biết HIS là gì.

------------------------------------------------------------------
CÁC HÀM CHÍNH:
------------------------------------------------------------------
  build_dashboard_summary(db, target_date)  → dict (patients + kpis + rooms + sla)
  get_patient_dashboard_record_by_id(db, patient_id) → dict | None

------------------------------------------------------------------
HÀNH VI THEO target_date:
------------------------------------------------------------------
  - target_date = 'YYYY-MM-DD'  → lấy BN check-in ngày đó (xem lại lịch sử)
  - target_date = None          → lấy BN chưa xuất viện (discharge_time IS NULL) — realtime
"""

from __future__ import annotations

import traceback
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import Room, Patient, VisitStep, Doctor

# Giá trị status chuẩn — đồng bộ với HIS và Flutter
STATUS_NONE     = "chưa khám"
STATUS_WAITING  = "chờ kết quả"
STATUS_PROGRESS = "đang khám"
STATUS_DONE     = "đã xong"

DEFAULT_SLA_THRESHOLD_MINUTES = 45


# ──────────────────────────────────────────────
# 1. ĐỌC DỮ LIỆU TỪ SQLITE
# ──────────────────────────────────────────────

def fetch_rooms(db: Session) -> dict[int, dict]:
    """
    Lấy toàn bộ phòng từ bảng rooms, index theo room_id.
    Trả về: { room_id: {room_id, name, type, floor, physical_capacity, min_intensity_to_open} }
    """
    rooms = db.query(Room).all()
    return {
        r.room_id: {
            "room_id":               r.room_id,
            "name":                  r.name,
            "type":                  r.type,
            "floor":                 r.floor,
            "physical_capacity":     r.physical_capacity,
            "min_intensity_to_open": r.min_intensity_to_open,
        }
        for r in rooms
    }


def fetch_patients(
    db: Session,
    target_date: Optional[str] = None,
    active_only: bool = False,
) -> list[dict]:
    """
    Lấy danh sách bệnh nhân:
    - target_date ('YYYY-MM-DD'): BN check-in đúng ngày đó
    - active_only=True: BN chưa xuất viện (discharge_time IS NULL)
    """
    query = db.query(Patient)

    if target_date:
        day_start = f"{target_date}T00:00:00"
        day_end = (datetime.fromisoformat(target_date) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00")
        query = query.filter(
            and_(
                Patient.check_in_time >= day_start,
                Patient.check_in_time < day_end,
            )
        )
    elif active_only:
        query = query.filter(Patient.discharge_time.is_(None))

    patients = query.all()
    return [
        {
            "patient_id":     p.patient_id,
            "gender":         p.gender,
            "check_in_time":  p.check_in_time,
            "discharge_time": p.discharge_time,
            "status":         p.status,
        }
        for p in patients
    ]


def fetch_visit_steps_for_patients(db: Session, patient_ids: list[int]) -> list[dict]:
    """
    Lấy toàn bộ visit_steps của danh sách patient_id,
    join luôn thông tin room (name, type) và doctor (full_name).
    """
    if not patient_ids:
        return []

    steps = (
        db.query(VisitStep)
        .filter(VisitStep.patient_id.in_(patient_ids))
        .all()
    )

    result = []
    for s in steps:
        room   = s.room   or Room()
        doctor = s.doctor or Doctor()
        result.append({
            "step_id":      s.step_id,
            "patient_id":   s.patient_id,
            "room_id":      s.room_id,
            "room_name":    room.name,
            "room_type":    room.type,
            "doctor_id":    s.doctor_id,
            "doctor_name":  doctor.full_name,
            "status":       s.status or STATUS_NONE,
            "queued_at":    s.queued_at,
            "started_at":   s.started_at,
            "completed_at": s.completed_at,
        })
    return result


def fetch_patient_by_id(db: Session, patient_id: int) -> Optional[dict]:
    """Lấy thông tin cơ bản 1 bệnh nhân theo patient_id."""
    p = db.get(Patient, patient_id)
    if p is None:
        return None
    return {
        "patient_id":     p.patient_id,
        "gender":         p.gender,
        "check_in_time":  p.check_in_time,
        "discharge_time": p.discharge_time,
        "status":         p.status,
    }


# ──────────────────────────────────────────────
# 2. GHÉP DỮ LIỆU THÀNH BẢN GHI DASHBOARD
# ──────────────────────────────────────────────

def _build_patient_record(patient: dict, steps: list[dict]) -> dict:
    """Ghép thông tin BN + danh sách bước khám thành 1 bản ghi dashboard."""
    return {
        "patient_id":       patient["patient_id"],
        "gender":           patient["gender"],
        "status":           patient.get("status"),
        "check_in_time":    patient.get("check_in_time"),
        "discharge_time":   patient.get("discharge_time"),
        "steps":            steps,
        "total_steps":      len(steps),
        "completed_steps":  sum(1 for s in steps if s["status"] == STATUS_DONE),
        "in_progress":      any(s["status"] == STATUS_PROGRESS for s in steps),
    }


def build_dashboard_dataset(
    db: Session,
    target_date: Optional[str] = None,
) -> list[dict]:
    """
    Lấy BN (theo ngày check-in hoặc active) + visit_steps của họ,
    trả về list bản ghi dashboard.
    """
    patients = fetch_patients(db, target_date=target_date, active_only=(target_date is None))
    patient_ids = [p["patient_id"] for p in patients]
    steps = fetch_visit_steps_for_patients(db, patient_ids)

    steps_by_patient: dict[int, list[dict]] = {}
    for s in steps:
        steps_by_patient.setdefault(s["patient_id"], []).append(s)

    return [
        _build_patient_record(p, steps_by_patient.get(p["patient_id"], []))
        for p in patients
    ]


def get_patient_dashboard_record_by_id(
    db: Session,
    patient_id: int,
) -> Optional[dict]:
    """Lấy bản ghi dashboard của MỘT bệnh nhân — dùng khi FE click xem chi tiết."""
    patient = fetch_patient_by_id(db, patient_id)
    if patient is None:
        return None
    steps = fetch_visit_steps_for_patients(db, [patient_id])
    return _build_patient_record(patient, steps)


# ──────────────────────────────────────────────
# 3. TÍNH SỐ LIỆU KPI / PHÒNG / SLA
# ──────────────────────────────────────────────

def compute_kpis(dataset: list[dict]) -> dict:
    """KPI tổng quan: tổng BN, đang khám, đang chờ, chưa khám, đã xuất viện."""
    total = len(dataset)
    examining    = sum(1 for p in dataset if p["in_progress"])
    waiting      = sum(
        1 for p in dataset
        if not p["in_progress"] and any(s["status"] == STATUS_WAITING for s in p["steps"])
    )
    not_started  = sum(
        1 for p in dataset if all(s["status"] == STATUS_NONE for s in p["steps"])
    )
    discharged   = sum(1 for p in dataset if p.get("discharge_time") is not None)

    return {
        "total_patients":       total,
        "patients_examining":   examining,
        "patients_waiting":     waiting,
        "patients_not_started": not_started,
        "patients_discharged":  discharged,
    }


def compute_room_summary(dataset: list[dict], rooms_by_id: dict[int, dict]) -> list[dict]:
    """
    Tổng hợp theo từng phòng: số người chờ / đang khám / đã xong,
    kèm sức chứa thực và cờ quá tải.
    """
    summary: dict[int, dict] = {}
    for patient in dataset:
        for s in patient["steps"]:
            room_id = s["room_id"]
            if room_id is None:
                continue
            if room_id not in summary:
                room_ref = rooms_by_id.get(room_id, {})
                summary[room_id] = {
                    "room_id":          room_id,
                    "room_name":        s["room_name"] or room_ref.get("name"),
                    "room_type":        s["room_type"] or room_ref.get("type"),
                    "physical_capacity": room_ref.get("physical_capacity"),
                    "waiting":          0,
                    "in_progress":      0,
                    "done":             0,
                }
            if s["status"] in (STATUS_WAITING, STATUS_NONE):
                summary[room_id]["waiting"]     += 1
            elif s["status"] == STATUS_PROGRESS:
                summary[room_id]["in_progress"] += 1
            elif s["status"] == STATUS_DONE:
                summary[room_id]["done"]        += 1

    result = []
    for r in summary.values():
        cap = r["physical_capacity"]
        r["overloaded"] = bool(cap) and r["waiting"] > cap
        result.append(r)
    return sorted(result, key=lambda x: x["room_id"])


def _parse_minutes(ts, now: datetime) -> Optional[float]:
    """Số phút từ timestamp tới 'now'. An toàn với mọi kiểu dữ liệu đầu vào."""
    if ts is None:
        return None
    # Nếu đã là datetime object (SQLAlchemy đôi khi trả về datetime thay vì str)
    if isinstance(ts, datetime):
        return (now - ts).total_seconds() / 60
    # Chuyển về string nếu chưa phải
    try:
        ts_str = str(ts).strip()
        if not ts_str:
            return None
        t = datetime.fromisoformat(ts_str)
        return (now - t).total_seconds() / 60
    except (ValueError, TypeError):
        return None


def compute_sla_alerts(
    dataset: list[dict],
    threshold_minutes: float = DEFAULT_SLA_THRESHOLD_MINUTES,
    now: Optional[datetime] = None,
) -> list[dict]:
    """Tìm BN đang chờ quá lâu so với ngưỡng threshold_minutes."""
    now = now or datetime.now()
    alerts = []
    for patient in dataset:
        for s in patient["steps"]:
            if s["status"] not in (STATUS_WAITING, STATUS_NONE):
                continue
            waited = _parse_minutes(s.get("queued_at"), now)
            if waited is not None and waited >= threshold_minutes:
                alerts.append({
                    "patient_id":     patient["patient_id"],
                    "room_id":        s["room_id"],
                    "room_name":      s["room_name"],
                    "waited_minutes": round(waited, 1),
                })
    return sorted(alerts, key=lambda x: x["waited_minutes"], reverse=True)


def compute_average_wait_minutes(
    dataset: list[dict],
    now: Optional[datetime] = None,
) -> float:
    """Thời gian chờ trung bình thực tế của các visit_step chưa xong."""
    now = now or datetime.now()
    waits = []
    for patient in dataset:
        for s in patient["steps"]:
            if s["status"] == STATUS_DONE:
                continue
            waited = _parse_minutes(s.get("queued_at"), now)
            if waited is not None:
                waits.append(waited)
    if not waits:
        return 0.0
    return round(sum(waits) / len(waits), 1)


def build_dashboard_summary(
    db: Session,
    target_date: Optional[str] = None,
    sla_threshold_minutes: float = DEFAULT_SLA_THRESHOLD_MINUTES,
) -> dict:
    """
    Hàm gộp tất cả — dùng trong API dashboard để trả về 1 response duy nhất:
    dataset + kpi + room_summary + sla_alerts.
    """
    dataset     = build_dashboard_dataset(db, target_date)
    rooms_by_id = fetch_rooms(db)

    kpis = compute_kpis(dataset)
    kpis["average_waiting_minutes"] = compute_average_wait_minutes(dataset)

    return {
        "date":       target_date or "realtime (BN chưa xuất viện)",
        "patients":   dataset,
        "kpis":       kpis,
        "rooms":      compute_room_summary(dataset, rooms_by_id),
        "sla_alerts": compute_sla_alerts(dataset, sla_threshold_minutes),
    }