# Khởi tạo FastAPI app, gộp router tại đây
"""
Điểm khởi động FastAPI. Chạy: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from routers import dashboard, ingest

app = FastAPI(
    title="Hospital Dashboard API",
    description=(
        "API trung gian giữa HIS và dashboard Flutter.\n\n"
        "**Luồng dữ liệu:**\n"
        "- HIS admin push dữ liệu vào qua `/api/ingest/*`\n"
        "- Flutter dashboard đọc qua `/api/dashboard/*`"
    ),
    version="2.0.0",
)

# CORS: cho phép Flutter (web hoặc mobile) gọi API.
# Khi lên production, thay allow_origins=["*"] bằng domain thật của FE.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(ingest.router)


@app.on_event("startup")
def on_startup():
    """Tạo bảng DB khi server khởi động (nếu chưa có)."""
    init_db()


@app.get("/health")
def health_check():
    """Kiểm tra server + kết nối DB — FE có thể gọi lúc khởi động để check."""
    from db import check_connection, DATABASE_URL
    db_ok = check_connection()
    db_type = "sqlite" if DATABASE_URL.startswith("sqlite") else "postgresql"
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_type,
        "db_connected": db_ok,
    }