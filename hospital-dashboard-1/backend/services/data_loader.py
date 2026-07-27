"""
  - patients      (patient_id int, ..., check_in_time, discharge_time, status, priority)
  - visit_steps   (step_id int, patient_id, room_id, doctor_id, status, queued_at, started_at, completed_at)
  - rooms         (room_id int, name, type, floor, physical_capacity, min_intensity_to_open)
  - vital_signs   (chưa dùng trong dashboard hiện tại, để dành mở rộng sau)

------------------------------------------------------------------
CÀI ĐẶT:
------------------------------------------------------------------
pip install supabase python-dotenv

File .env trong backend/:
  SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
  SUPABASE_KEY=your-anon-or-service-role-key

------------------------------------------------------------------
CÁCH DÙNG:
------------------------------------------------------------------
    from services.data_loader import build_dashboard_summary
    summary = build_dashboard_summary(target_date="2026-07-24")    # BN check-in ngày đó
    summary = build_dashboard_summary()                            # mặc định: BN chưa xuất viện (realtime)

CLI test nhanh:
    python3 /Users/quangminh/Desktop/DigitalTwinHospital/hospital-dashboard-1/backend/services/data_loader.py --summary
    python3 /Users/quangminh/Desktop/DigitalTwinHospital/hospital-dashboard-1/backend/services/data_loader.py --date 2026-07-24 --summary
"""

from __future__ import annotations

import os
import argparse
from datetime import datetime, date, timedelta
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

STATUS_NONE = "chưa khám"
STATUS_WAITING = "chờ kết quả"
STATUS_PROGRESS = "đang khám"
STATUS_DONE = "đã xong"
DOCTOR_NAME_COLUMN = "full_name"

DEFAULT_SLA_THRESHOLD_MINUTES = 45

# 1. KẾT NỐI SUPABASE
_client: Optional[Client] = None

def get_supabase_client() -> Client:
    """Tạo (hoặc tái sử dụng) kết nối Supabase, đọc URL/KEY từ .env."""
    global _client
    if _client is not None:
        return _client

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError(
            "Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong biến môi trường. "
            "Tạo file .env trong thư mục backend/ theo hướng dẫn đầu file data_loader.py."
        )
    _client = create_client(url, key)
    return _client


# 2. ĐỌC DỮ LIỆU TỪ SUPABASE
def fetch_rooms() -> dict[int, dict]:
    """
    Lấy toàn bộ phòng từ bảng `rooms`, index theo room_id (int).
    Trả về dict: { room_id: {room_id, name, type, floor, physical_capacity, min_intensity_to_open}, ... }"""
    client = get_supabase_client()
    res = (
        client.table("rooms")
        .select("room_id, name, type, floor, physical_capacity, min_intensity_to_open")
        .execute()
    )
    return {r["room_id"]: r for r in res.data}


def fetch_patients(
    target_date: Optional[str] = None,
    active_only: bool = False,
) -> list[dict]:
    """
    Lấy danh sách bệnh nhân theo 1 trong 2 chế độ:
    - target_date được truyền vào ('YYYY-MM-DD'): lấy bệnh nhân có
      check_in_time rơi vào đúng ngày đó (dùng để xem lại 1 ngày cụ thể).
    - target_date = None và active_only = True (mặc định khi gọi không tham số):
      lấy bệnh nhân CHƯA xuất viện (discharge_time is null) — đúng tinh thần
      dashboard realtime, không cần biết trước "hôm nay là ngày nào".
    """
    client = get_supabase_client()
    query = client.table("patients").select(
        "patient_id, gender, check_in_time, discharge_time, status"
    )

    if target_date:
        day_start = f"{target_date}T00:00:00"
        day_end = (datetime.fromisoformat(target_date) + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00")
        query = query.gte("check_in_time", day_start).lt("check_in_time", day_end)
    elif active_only:
        query = query.is_("discharge_time", "null")

    res = query.execute()
    return res.data


def fetch_visit_steps_for_patients(patient_ids: list[int]) -> list[dict]:
    """
    Lấy toàn bộ visit_steps của danh sách patient_id, join sẵn tên phòng
    và tên bác sĩ ngay trong 1 câu query (embedding qua FK room_id / doctor_id).
    """
    if not patient_ids:
        return []

    client = get_supabase_client()
    res = (
        client.table("visit_steps")
        .select(
            f"step_id, patient_id, room_id, doctor_id, status, "
            f"queued_at, started_at, completed_at, "
            f"rooms(room_id, name, type), "
            f"doctors(doctor_id, {DOCTOR_NAME_COLUMN})"
        )
        .in_("patient_id", patient_ids)
        .execute()
    )
    return res.data


def fetch_patient_by_id(patient_id: int) -> Optional[dict]:
    """Lấy thông tin cơ bản 1 bệnh nhân theo patient_id."""
    client = get_supabase_client()
    res = (
        client.table("patients")
        .select("patient_id, gender, status, check_in_time, discharge_time")
        .eq("patient_id", patient_id)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None

# 3. GHÉP DỮ LIỆU THÀNH BẢN GHI DASHBOARD (theo từng bệnh nhân)
def _step_to_room_entry(step: dict) -> dict:
    """Rút gọn 1 dòng visit_step (đã join sẵn rooms + doctors) thành entry hiển thị."""
    room = step.get("rooms") or {}
    doctor = step.get("doctors") or {}
    return {
        "step_id": step["step_id"],
        "room_id": step["room_id"],
        "room_name": room.get("name"),
        "room_type": room.get("type"),
        "doctor_id": step.get("doctor_id"),
        "doctor_name": doctor.get(DOCTOR_NAME_COLUMN),
        "status": step.get("status", STATUS_NONE),
        "queued_at": step.get("queued_at"),
        "started_at": step.get("started_at"),
        "completed_at": step.get("completed_at"),
    }


def build_dashboard_dataset(
    target_date: Optional[str] = None,
) -> list[dict]:
    """
    Hàm chính: lấy bệnh nhân (theo ngày check-in, hoặc mặc định lấy BN đang
    active nếu không truyền ngày) + toàn bộ visit_steps của họ, ghép lại
    thành dataset dashboard.

    Trả về list[dict], mỗi phần tử:
    {
        "patient_id": 1001, "gender": "M", "status": "đang chờ",
        "check_in_time": "...", "discharge_time": None,
        "steps": [ {step_id, room_id, room_name, room_type, doctor_name, status, ...}, ... ],
        "total_steps": 3, "completed_steps": 1, "in_progress": true
    }
    """
    patients = fetch_patients(target_date=target_date, active_only=(target_date is None))
    patient_ids = [p["patient_id"] for p in patients]
    steps = fetch_visit_steps_for_patients(patient_ids)

    steps_by_patient: dict[int, list[dict]] = {}
    for s in steps:
        steps_by_patient.setdefault(s["patient_id"], []).append(_step_to_room_entry(s))

    dataset = []
    for p in patients:
        patient_steps = steps_by_patient.get(p["patient_id"], [])
        dataset.append({
            "patient_id": p["patient_id"],
            "gender": p["gender"],
            "status": p.get("status"),
            "check_in_time": p.get("check_in_time"),
            "discharge_time": p.get("discharge_time"),
            "steps": patient_steps,
            "total_steps": len(patient_steps),
            "completed_steps": sum(1 for s in patient_steps if s["status"] == STATUS_DONE),
            "in_progress": any(s["status"] == STATUS_PROGRESS for s in patient_steps),
        })

    return dataset


def get_patient_dashboard_record_by_id(
    patient_id: int,
) -> Optional[dict]:
    """Lấy bản ghi dashboard của MỘT bệnh nhân — dùng khi click xem chi tiết."""
    patient = fetch_patient_by_id(patient_id)
    if patient is None:
        return None

    steps = fetch_visit_steps_for_patients([patient_id])
    patient_steps = [_step_to_room_entry(s) for s in steps]

    return {
        "patient_id": patient["patient_id"],
        "gender": patient["gender"],
        "status": patient.get("status"),
        "check_in_time": patient.get("check_in_time"),
        "discharge_time": patient.get("discharge_time"),
        "steps": patient_steps,
        "total_steps": len(patient_steps),
        "completed_steps": sum(1 for s in patient_steps if s["status"] == STATUS_DONE),
        "in_progress": any(s["status"] == STATUS_PROGRESS for s in patient_steps),
    }

# 4. CÁC HÀM TÍNH SỐ LIỆU CHO DASHBOARD (KPI / phòng / SLA)
def compute_kpis(dataset: list[dict]) -> dict:
    """Tính KPI tổng quan: tổng BN, đang khám, đang chờ, chưa khám, đã xuất viện."""
    total = len(dataset)
    examining = sum(1 for p in dataset if p["in_progress"])
    waiting = sum(
        1 for p in dataset
        if not p["in_progress"] and any(s["status"] == STATUS_WAITING for s in p["steps"])
    )
    not_started = sum(
        1 for p in dataset if all(s["status"] == STATUS_NONE for s in p["steps"])
    )
    discharged = sum(1 for p in dataset if p.get("discharge_time") is not None)

    return {
        "total_patients": total,
        "patients_examining": examining,
        "patients_waiting": waiting,
        "patients_not_started": not_started,
        "patients_discharged": discharged,
    }


def compute_room_summary(dataset: list[dict], rooms_by_id: dict[int, dict]) -> list[dict]:
    """
    Tổng hợp theo từng phòng: số người chờ / đang khám / đã xong, kèm sức chứa
    thật (physical_capacity) và cờ quá tải — dùng physical_capacity lấy từ bảng rooms
    thay vì con số giả định như bản demo cũ.

    Trả về:
    [{ "room_id": 101, "room_name": "...", "room_type": "clinic",
       "physical_capacity": 4, "waiting": 3, "in_progress": 1, "done": 5,
       "overloaded": bool }, ...]
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
                    "room_id": room_id,
                    "room_name": s["room_name"] or room_ref.get("name"),
                    "room_type": s["room_type"] or room_ref.get("type"),
                    "physical_capacity": room_ref.get("physical_capacity"),
                    "waiting": 0,
                    "in_progress": 0,
                    "done": 0,
                }
            if s["status"] in (STATUS_WAITING, STATUS_NONE):
                summary[room_id]["waiting"] += 1
            elif s["status"] == STATUS_PROGRESS:
                summary[room_id]["in_progress"] += 1
            elif s["status"] == STATUS_DONE:
                summary[room_id]["done"] += 1

    result = []
    for r in summary.values():
        cap = r["physical_capacity"]
        r["overloaded"] = bool(cap) and r["waiting"] > cap
        result.append(r)

    return sorted(result, key=lambda x: x["room_id"])


def _parse_minutes(ts: Optional[str], now: datetime) -> Optional[float]:
    """Tính số phút từ 1 mốc thời gian (timestamp without time zone) tới 'now'."""
    if not ts:
        return None
    t = datetime.fromisoformat(ts)
    return (now - t).total_seconds() / 60


def compute_sla_alerts(
    dataset: list[dict],
    threshold_minutes: float = DEFAULT_SLA_THRESHOLD_MINUTES,
    now: Optional[datetime] = None,
) -> list[dict]:
    """Tìm bệnh nhân đang chờ quá lâu so với ngưỡng threshold_minutes, dựa vào queued_at."""
    now = now or datetime.now()
    alerts = []
    for patient in dataset:
        for s in patient["steps"]:
            if s["status"] not in (STATUS_WAITING, STATUS_NONE):
                continue
            waited = _parse_minutes(s.get("queued_at"), now)
            if waited is not None and waited >= threshold_minutes:
                alerts.append({
                    "patient_id": patient["patient_id"],
                    "room_id": s["room_id"],
                    "room_name": s["room_name"],
                    "waited_minutes": round(waited, 1),
                })

    return sorted(alerts, key=lambda x: x["waited_minutes"], reverse=True)


def compute_average_wait_minutes(
    dataset: list[dict],
    now: Optional[datetime] = None,
) -> float:
    """
    Thời gian CHỜ TRUNG BÌNH THỰC TẾ: trung bình 'waited' (tính từ queued_at)
    của các visit_step CHƯA XONG (status != 'đã xong').

    Khác với việc lấy (now - check_in_time) của toàn bộ bệnh nhân active —
    cách đó đo "đã nằm viện bao lâu" chứ không phải "đang chờ ở bước nào đó
    bao lâu", nên dễ bị kéo lệch bởi các bệnh nhân check-in từ lâu nhưng
    chưa được cập nhật xuất viện.
    """
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
    target_date: Optional[str] = None,
    sla_threshold_minutes: float = DEFAULT_SLA_THRESHOLD_MINUTES,
) -> dict:
    """
    Hàm tiện ích gộp tất cả — dùng trong API dashboard để trả về 1 response
    duy nhất chứa dataset + kpi + room_summary + sla_alerts.
    """
    dataset = build_dashboard_dataset(target_date)
    rooms_by_id = fetch_rooms()

    kpis = compute_kpis(dataset)
    kpis["average_waiting_minutes"] = compute_average_wait_minutes(dataset)

    return {
        "date": target_date or "realtime (BN chưa xuất viện)",
        "patients": dataset,
        "kpis": kpis,
        "rooms": compute_room_summary(dataset, rooms_by_id),
        "sla_alerts": compute_sla_alerts(dataset, sla_threshold_minutes),
    }

# 5. CHẠY TRỰC TIẾP TỪ CLI
def main():
    parser = argparse.ArgumentParser(
        description="Lấy dữ liệu dashboard từ Supabase, in ra KPI/room/SLA."
    )
    parser.add_argument("--date", type=str, default=None,
                         help="Lọc BN theo ngày check-in (YYYY-MM-DD). "
                              "Bỏ trống = lấy BN đang active (chưa xuất viện).")
    parser.add_argument("--summary", action="store_true",
                         help="In thêm KPI / room summary / SLA alerts ra màn hình")
    args = parser.parse_args()

    dataset = build_dashboard_dataset(args.date)
    label = args.date or "BN đang active (chưa xuất viện)"

    # print(f"data set benh nhan: {dataset}")
    print(f"Lấy được {len(dataset)} bệnh nhân — {label}")

    if args.summary:
        rooms_by_id = fetch_rooms()
        kpis = compute_kpis(dataset)
        rooms = compute_room_summary(dataset, rooms_by_id)
        alerts = compute_sla_alerts(dataset)

        print("\n--- KPI ---")
        for k, v in kpis.items():
            print(f"  {k}: {v}")

        print("\n--- Room summary ---")
        for r in rooms:
            flag = "QUÁ TẢI" if r["overloaded"] else ""
            print(f"  P{r['room_id']} ({r['room_name']}): chờ={r['waiting']} "
                  f"đang khám={r['in_progress']} đã xong={r['done']} "
                  f"(sức chứa={r['physical_capacity']}){flag}")

        print(f"\n--- SLA alerts (>{DEFAULT_SLA_THRESHOLD_MINUTES} phút) ---")
        if not alerts:
            print("  Không có ca nào vượt ngưỡng.")
        for a in alerts:
            print(f"  BN{a['patient_id']} chờ {a['waited_minutes']} phút tại {a['room_name']} (P{a['room_id']})")

if __name__ == "__main__":
    main()