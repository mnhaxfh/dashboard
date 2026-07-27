"""
db.py — Kết nối DB trung gian (Supabase PostgreSQL hoặc SQLite fallback).

DB này đóng vai buffer giữa HIS và dashboard:
- HIS admin push dữ liệu vào qua /api/ingest/*
- Dashboard chỉ đọc từ đây

------------------------------------------------------------------
CẤU HÌNH:
------------------------------------------------------------------
Thêm vào file .env (trong thư mục gốc dự án hoặc backend/):

  # Dùng Supabase PostgreSQL (khuyến nghị — xem được data trên Supabase UI):
  DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-xxx.pooler.supabase.com:6543/postgres

  # Nếu không có DATABASE_URL → tự động dùng SQLite cục bộ (hospital.db)

Lấy DATABASE_URL tại:
  Supabase Dashboard → Project → Settings → Database
  → Connection string → URI (chọn "Transaction pooler" mode)
------------------------------------------------------------------
"""

import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Đọc .env từ thư mục gốc dự án (../../.env) hoặc thư mục backend (./. env)
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_project_root = os.path.abspath(os.path.join(_backend_dir, "..", ".."))

load_dotenv(os.path.join(_project_root, ".env"))   # d:\dashboardHospital\.env
load_dotenv(os.path.join(_backend_dir, ".env"))     # backend/.env (nếu có, override)

# ─── Chọn DB backend ────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # Supabase / PostgreSQL
    _is_sqlite = False
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,   # tự reconnect nếu kết nối bị drop
    )
    print(f"[DB] Dùng PostgreSQL: {DATABASE_URL.split('@')[-1]}")  # in host (giấu password)
else:
    # Fallback: SQLite cục bộ
    _is_sqlite = True
    _db_path = os.path.join(_backend_dir, "hospital.db")
    DATABASE_URL = f"sqlite:///{_db_path}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    print(f"[DB] Dung SQLite: {_db_path}")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: cấp 1 DB session, tự đóng sau khi request xong."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Tạo tất cả các bảng nếu chưa tồn tại.
    Gọi 1 lần khi server khởi động.
    Với Supabase: bảng sẽ xuất hiện trong Table Editor sau lần chạy đầu tiên.
    """
    from models import Room, Doctor, Patient, VisitStep  # noqa: F401
    Base.metadata.create_all(bind=engine)


def check_connection() -> bool:
    """Kiểm tra kết nối DB — dùng cho health check."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
