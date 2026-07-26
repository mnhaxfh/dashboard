# API tổng hợp KPI, SLA, room-grid cho FE

from fastapi import APIRouter, HTTPException, Query, Response
from typing import Optional

from services.data_loader import (
    build_dashboard_summary,
    get_patient_dashboard_record_by_id,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

"""
    Endpoint chính cho dashboard: trả về patients + kpis + rooms + sla_alerts
    trong 1 lần gọi duy nhất — FE gọi 1 API là có đủ dữ liệu vẽ toàn bộ màn hình.

    Ví dụ FE gọi:
      GET /api/dashboard/summary
      GET /api/dashboard/summary?date=2026-07-24
"""
@router.get("/summary")
def get_dashboard_summary(
    response: Response,
    date: Optional[str] = Query(default=None)
):
    response.headers["Cache-Control"] = "no-store"
    try:
        return build_dashboard_summary(target_date=date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patients/{patient_id}")
def get_patient_detail(patient_id: int):
    """
    Chi tiết 1 bệnh nhân — dùng khi FE click vào 1 dòng trong danh sách
    bệnh nhân để mở panel chi tiết.

    Ví dụ FE gọi:
      GET /api/dashboard/patients/1001
    """
    record = get_patient_dashboard_record_by_id(patient_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy bệnh nhân {patient_id}")
    return record