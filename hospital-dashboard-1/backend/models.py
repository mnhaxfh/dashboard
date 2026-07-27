"""
models.py — SQLAlchemy ORM models cho DB trung gian.

4 bảng:
  - rooms         : thông tin phòng khám
  - doctors       : thông tin bác sĩ
  - patients      : thông tin bệnh nhân (check-in / discharge)
  - visit_steps   : từng bước khám của bệnh nhân trong hành trình khám bệnh
"""

from sqlalchemy import Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship
from db import Base


class Room(Base):
    __tablename__ = "rooms"

    room_id              = Column(Integer, primary_key=True, index=True)
    name                 = Column(String(100), nullable=False)
    type                 = Column(String(50))   # ví dụ: "clinic", "lab", "imaging"
    floor                = Column(Integer)
    physical_capacity    = Column(Integer)       # sức chứa thực tế (số người)
    min_intensity_to_open = Column(Integer)      # ngưỡng tối thiểu để mở phòng

    visit_steps = relationship("VisitStep", back_populates="room")


class Doctor(Base):
    __tablename__ = "doctors"

    doctor_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)

    visit_steps = relationship("VisitStep", back_populates="doctor")


class Patient(Base):
    __tablename__ = "patients"

    patient_id     = Column(Integer, primary_key=True, index=True)
    gender         = Column(String(10))          # "M" / "F"
    check_in_time  = Column(Text)               # ISO8601 string
    discharge_time = Column(Text, nullable=True) # NULL = chưa xuất viện
    status         = Column(String(50))          # trạng thái tổng của BN

    visit_steps = relationship("VisitStep", back_populates="patient")


class VisitStep(Base):
    __tablename__ = "visit_steps"

    step_id      = Column(Integer, primary_key=True, index=True)
    patient_id   = Column(Integer, ForeignKey("patients.patient_id"), nullable=False)
    room_id      = Column(Integer, ForeignKey("rooms.room_id"))
    doctor_id    = Column(Integer, ForeignKey("doctors.doctor_id"), nullable=True)
    status       = Column(String(50))   # "chưa khám" / "chờ kết quả" / "đang khám" / "đã xong"
    queued_at    = Column(Text)         # thời điểm vào hàng chờ
    started_at   = Column(Text)         # thời điểm bắt đầu khám
    completed_at = Column(Text)         # thời điểm hoàn tất bước này

    patient = relationship("Patient", back_populates="visit_steps")
    room    = relationship("Room",    back_populates="visit_steps")
    doctor  = relationship("Doctor",  back_populates="visit_steps")
