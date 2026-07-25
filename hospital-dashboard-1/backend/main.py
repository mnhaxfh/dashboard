# Khởi tạo FastAPI app, gộp router tại đây
"""
Điểm khởi động FastAPI. Chạy: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import dashboard

app = FastAPI(title="Hospital Dashboard API")

# CORS: cho phép Flutter (web chạy ở origin khác, hoặc app mobile) gọi API.
# Khi lên production, thay allow_origins=["*"] bằng domain thật của FE để bảo mật hơn.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)


@app.get("/health")
def health_check():
    """Endpoint kiểm tra server còn sống — FE có thể gọi lúc khởi động để check kết nối."""
    return {"status": "ok"}