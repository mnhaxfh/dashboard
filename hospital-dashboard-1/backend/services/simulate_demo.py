"""
CHẠY:
  cd backend/
  python3 simulate_demo.py

  Tuỳ chọn hay dùng:
    --day-length 480          8 phút thật = 1 "ngày" mô phỏng (mặc định)
    --min-census 15           số BN active thấp nhất trong ngày
    --max-census 55           số BN active cao nhất trong ngày (cao điểm)
    --tick-interval 2         khoảng nghỉ giữa các tick (giây)
    --actions-per-tick 2 4    số hành động mỗi tick (min max)
    --bottleneck-rotate 90    bao nhiêu giây đổi "phòng quá tải" 1 lần
    --sla-threshold 45        ngưỡng phút để tính SLA alert (khớp data_loader.py)
"""

from __future__ import annotations

import argparse
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

STATUS_NONE = "chưa khám"
STATUS_WAITING = "chờ kết quả"
STATUS_PROGRESS = "đang khám"
STATUS_DONE = "đã xong"

NEXT_STATUS = {
    STATUS_NONE: STATUS_PROGRESS,
    STATUS_PROGRESS: STATUS_WAITING,
    STATUS_WAITING: STATUS_DONE,
}

FAKE_FULL_NAMES = [
    "Nguyễn Văn An", "Trần Thị Bình", "Lê Minh Cường", "Phạm Thị Dung",
    "Hoàng Văn Em", "Vũ Thị Giang", "Đặng Minh Hải", "Bùi Thị Hoa",
    "Ngô Văn Khang", "Đỗ Thị Lan", "Phan Văn Minh", "Trịnh Thị Nga",
    "Lý Văn Phúc", "Đinh Thị Quỳnh", "Tô Văn Sơn", "Mai Thị Thu",
]
GENDERS = ["M", "F"]
PRIORITIES = ["Thường", "Ưu tiên", "Khẩn"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def get_client() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SECRET_KEY")
    if not url or not key:
        raise RuntimeError(
            "Thiếu SUPABASE_URL hoặc SUPABASE_SECRET_KEY trong .env "
            "(dùng chung .env với data_loader.py)."
        )
    return create_client(url, key)


# ------------------------------------------------------------------
# NHỊP NGÀY RÚT GỌN — mô phỏng cao điểm/thấp điểm trong day_length giây
# ------------------------------------------------------------------
def load_level(elapsed_seconds: float, day_length: float) -> float:
    """0..1, hai đỉnh cao điểm trong 1 'ngày' day_length giây (giống nhịp sáng/chiều)."""
    frac = (elapsed_seconds % day_length) / day_length  # 0..1
    hour = frac * 24

    def gauss(peak, sigma):
        return math.exp(-((hour - peak) ** 2) / (2 * sigma * sigma))

    return min(1.0, max(gauss(9, 1.6), gauss(15.5, 1.6)) + 0.08)


def target_census(level: float, min_c: int, max_c: int) -> int:
    return round(min_c + level * (max_c - min_c))


# ------------------------------------------------------------------
# TRUY VẤN
# ------------------------------------------------------------------
def fetch_active_patients(client: Client) -> list[dict]:
    res = (
        client.table("patients")
        .select("patient_id, full_name, status")
        .is_("discharge_time", "null")
        .execute()
    )
    return res.data


def fetch_open_steps(client: Client, patient_ids: list[int]) -> list[dict]:
    if not patient_ids:
        return []
    res = (
        client.table("visit_steps")
        .select("step_id, patient_id, room_id, status, queued_at")
        .in_("patient_id", patient_ids)
        .neq("status", STATUS_DONE)
        .execute()
    )
    return res.data


def fetch_room_ids(client: Client) -> list[int]:
    res = client.table("rooms").select("room_id").execute()
    return [r["room_id"] for r in res.data]


_warned_missing_protocols = False
_warned_missing_doctors = False


def fetch_protocol_ids(client: Client) -> list[int]:
    """patients.protocol_id thường là FK NOT NULL -> bảng protocols.
    Nếu bảng không tồn tại hoặc lỗi, in cảnh báo 1 lần và trả về [] —
    lúc đó action_admit_new_patient sẽ tự bỏ qua việc check-in mới
    thay vì insert lỗi âm thầm."""
    global _warned_missing_protocols
    try:
        res = client.table("protocols").select("protocol_id").execute()
        return [r["protocol_id"] for r in res.data]
    except Exception as e:
        if not _warned_missing_protocols:
            print(f"  !! Không lấy được protocol_id từ bảng 'protocols': {e}")
            print("     -> Sẽ tạm dừng check-in bệnh nhân mới cho tới khi có protocol_id hợp lệ.")
            _warned_missing_protocols = True
        return []


def fetch_doctor_ids(client: Client) -> list[int]:
    """visit_steps.doctor_id thường là FK NOT NULL -> bảng doctors."""
    global _warned_missing_doctors
    try:
        res = client.table("doctors").select("doctor_id").execute()
        return [r["doctor_id"] for r in res.data]
    except Exception as e:
        if not _warned_missing_doctors:
            print(f"  !! Không lấy được doctor_id từ bảng 'doctors': {e}")
            _warned_missing_doctors = True
        return []


def patient_all_steps_done(client: Client, patient_id: int) -> bool:
    res = client.table("visit_steps").select("status").eq("patient_id", patient_id).execute()
    if not res.data:
        return False
    return all(s["status"] == STATUS_DONE for s in res.data)


# ------------------------------------------------------------------
# HÀNH ĐỘNG
# ------------------------------------------------------------------
def action_advance_step(client: Client, open_steps: list[dict], bottleneck_room: Optional[int], bottleneck_skip_prob: float) -> Optional[str]:
    if not open_steps:
        return None

    eligible = [
        s for s in open_steps
        if not (bottleneck_room is not None and s["room_id"] == bottleneck_room and random.random() < bottleneck_skip_prob)
    ]
    pool = eligible or open_steps
    step = random.choice(pool)
    current = step["status"]
    nxt = NEXT_STATUS.get(current)
    if nxt is None:
        return None

    update = {"status": nxt}
    if nxt == STATUS_PROGRESS:
        update["started_at"] = iso(now_utc())
    elif nxt == STATUS_DONE:
        update["completed_at"] = iso(now_utc())

    client.table("visit_steps").update(update).eq("step_id", step["step_id"]).execute()
    return f"BN{step['patient_id']} step {step['step_id']}: '{current}' -> '{nxt}'"


def action_admit_new_patient(client: Client, room_ids: list[int], protocol_ids: list[int], doctor_ids: list[int]) -> Optional[str]:
    if not room_ids:
        return None
    if not protocol_ids:
        # protocol_id là NOT NULL FK -> không có protocol hợp lệ thì không insert được,
        # thà bỏ qua tick này còn hơn insert lỗi âm thầm.
        return None

    patient = {
        "full_name": random.choice(FAKE_FULL_NAMES),
        "gender": random.choice(GENDERS),
        "date_of_birth": f"{random.randint(1955, 2005)}-0{random.randint(1,9)}-1{random.randint(0,9)}",
        "priority": random.choice(PRIORITIES),
        "status": "đang chờ",
        "check_in_time": iso(now_utc()),
        "discharge_time": None,
        "is_inpatient": False,
        "protocol_id": random.choice(protocol_ids),
    }
    res = client.table("patients").insert(patient).execute()
    if not res.data:
        return None
    new_id = res.data[0]["patient_id"]

    step = {
        "patient_id": new_id,
        "room_id": random.choice(room_ids),
        "status": STATUS_NONE,
        "queued_at": iso(now_utc()),
    }
    if doctor_ids:
        step["doctor_id"] = random.choice(doctor_ids)
    client.table("visit_steps").insert(step).execute()
    return f"Check-in mới: BN{new_id} ({patient['full_name']})"


def action_add_next_step(client: Client, finished_patients: list[dict], room_ids: list[int], doctor_ids: list[int]) -> Optional[str]:
    if not finished_patients or not room_ids:
        return None
    patient = random.choice(finished_patients)
    step = {
        "patient_id": patient["patient_id"],
        "room_id": random.choice(room_ids),
        "status": STATUS_NONE,
        "queued_at": iso(now_utc()),
    }
    if doctor_ids:
        step["doctor_id"] = random.choice(doctor_ids)
    client.table("visit_steps").insert(step).execute()
    return f"BN{patient['patient_id']} sang bước khám mới"


def action_discharge_patient(client: Client, finished_patients: list[dict]) -> Optional[str]:
    if not finished_patients:
        return None
    patient = random.choice(finished_patients)
    client.table("patients").update({
        "discharge_time": iso(now_utc()),
        "status": "đã xuất viện",
    }).eq("patient_id", patient["patient_id"]).execute()
    return f"Xuất viện: BN{patient['patient_id']} ({patient['full_name']})"


def action_seed_sla_alert(client: Client, open_steps: list[dict], threshold_minutes: float) -> Optional[str]:
    """Backdate queued_at của 1 bước đang chờ để nó vượt ngưỡng SLA NGAY LẬP TỨC
    (thay vì phải chờ thật threshold_minutes phút) — cho demo thấy alert thật."""
    waitable = [s for s in open_steps if s["status"] in (STATUS_NONE, STATUS_WAITING)]
    if not waitable:
        return None
    step = random.choice(waitable)
    overdue_minutes = threshold_minutes + random.uniform(1, 40)
    backdated = now_utc() - timedelta(minutes=overdue_minutes)
    client.table("visit_steps").update({"queued_at": iso(backdated)}).eq("step_id", step["step_id"]).execute()
    return f"Seed SLA: BN{step['patient_id']} chờ {overdue_minutes:.0f} phút tại phòng {step['room_id']}"


# ------------------------------------------------------------------
# VÒNG LẶP CHÍNH
# ------------------------------------------------------------------
def run(args):
    client = get_client()
    start = time.monotonic()
    bottleneck_room = None
    last_bottleneck_switch = 0.0
    tick_count = 0

    print(f"[{datetime.now():%H:%M:%S}] Simulator v2 bắt đầu — Ctrl+C để dừng.")
    print(f"  Nhịp ngày rút gọn: {args.day_length}s/ngày | census {args.min_census}-{args.max_census} | "
          f"bottleneck xoay mỗi {args.bottleneck_rotate}s\n")

    while True:
        try:
            elapsed = time.monotonic() - start

            # Xoay phòng "quá tải"
            room_ids = fetch_room_ids(client)
            protocol_ids = fetch_protocol_ids(client)
            doctor_ids = fetch_doctor_ids(client)

            if room_ids and (elapsed - last_bottleneck_switch >= args.bottleneck_rotate or bottleneck_room is None):
                bottleneck_room = random.choice(room_ids)
                last_bottleneck_switch = elapsed
                print(f"[{datetime.now():%H:%M:%S}] >> Phòng nghẽn mới: room_id={bottleneck_room}")

            level = load_level(elapsed, args.day_length)
            target = target_census(level, args.min_census, args.max_census)

            patients = fetch_active_patients(client)
            current_census = len(patients)
            patient_ids = [p["patient_id"] for p in patients]
            open_steps = fetch_open_steps(client, patient_ids)
            finished_patients = [p for p in patients if patient_all_steps_done(client, p["patient_id"])]

            gap = target - current_census
            admit_prob = min(0.7, max(0.03, 0.08 + gap * 0.025))
            discharge_prob = min(0.7, max(0.03, 0.08 - gap * 0.025))

            n_actions = random.randint(args.actions_min, args.actions_max)
            logs = []
            errors = []

            def safe_run(fn, *fn_args):
                """Chạy 1 hành động, lỗi (nếu có) KHÔNG làm hỏng các hành động còn lại trong tick."""
                try:
                    return fn(*fn_args)
                except Exception as e:
                    errors.append(f"{fn.__name__}: {e}")
                    return None

            for _ in range(n_actions):
                r = random.random()
                msg = None
                if r < admit_prob:
                    msg = safe_run(action_admit_new_patient, client, room_ids, protocol_ids, doctor_ids)
                elif r < admit_prob + discharge_prob:
                    msg = safe_run(action_discharge_patient, client, finished_patients)
                elif r < admit_prob + discharge_prob + 0.15:
                    msg = safe_run(action_add_next_step, client, finished_patients, room_ids, doctor_ids)
                else:
                    msg = safe_run(action_advance_step, client, open_steps, bottleneck_room, 0.75)
                if msg:
                    logs.append(msg)

            # Thỉnh thoảng seed 1 SLA alert thật để demo có cái để chỉ vào
            if random.random() < 0.08:
                msg = safe_run(action_seed_sla_alert, client, open_steps, args.sla_threshold)
                if msg:
                    logs.append(msg)

            tick_count += 1
            level_label = "Cao điểm" if level > 0.65 else ("Bình thường" if level > 0.35 else "Thấp điểm")
            print(f"[{datetime.now():%H:%M:%S}] census={current_census} (target~{target}, {level_label}) "
                  f"| {len(logs)} thay đổi" + (f" | {len(errors)} lỗi" if errors else ""))
            for m in logs:
                print(f"    - {m}")
            for e in errors:
                print(f"    !! {e}")

        except Exception as e:
            print(f"[{datetime.now():%H:%M:%S}] Lỗi tick (ngoài vòng action): {e}")

        time.sleep(args.tick_interval)


def main():
    parser = argparse.ArgumentParser(description="Simulator v2 — census dao động theo nhịp ngày + bottleneck SLA.")
    parser.add_argument("--day-length", type=float, default=480, help="Giây thật = 1 ngày mô phỏng")
    parser.add_argument("--min-census", type=int, default=15)
    parser.add_argument("--max-census", type=int, default=55)
    parser.add_argument("--tick-interval", type=float, default=2.0)
    parser.add_argument("--actions-per-tick", type=int, nargs=2, metavar=("MIN", "MAX"), default=[2, 4])
    parser.add_argument("--bottleneck-rotate", type=float, default=90)
    parser.add_argument("--sla-threshold", type=float, default=45)
    args = parser.parse_args()
    args.actions_min, args.actions_max = args.actions_per_tick

    run(args)


if __name__ == "__main__":
    main()