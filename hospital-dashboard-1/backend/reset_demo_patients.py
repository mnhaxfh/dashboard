"""
Chạy:
  cd backend/
  python3 reset_demo_patients.py
"""
from datetime import datetime, timezone
from services.data_loader import get_supabase_client

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

def main():
    client = get_supabase_client()

    reset = (
        client.table("patients")
        .update({
            "discharge_time": None,
            "status": "đang chờ",
            "check_in_time": now_iso(),
        })
        .not_.is_("discharge_time", "null")
        .execute()
    )
    patient_ids = [p["patient_id"] for p in reset.data]
    print(f"Đã đưa {len(patient_ids)} bệnh nhân về active.")

    if patient_ids:
        client.table("visit_steps").update({
            "status": "chưa khám",
            "queued_at": now_iso(),
            "started_at": None,
            "completed_at": None,
        }).in_("patient_id", patient_ids).execute()
        print(f"Đã reset visit_steps của {len(patient_ids)} bệnh nhân về 'chưa khám'.")
    else:
        print("Không có bệnh nhân nào để reset.")

if __name__ == "__main__":
    main()