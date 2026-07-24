# Mô tả cấu trúc dự án — Hospital Dashboard

## backend/ (FastAPI)

| File | Chức năng |
|---|---|
| `main.py` | Điểm khởi động server, gộp các router lại thành 1 app |
| `models.py` | Định nghĩa các bảng DB (Patient, Room, Protocol, VisitStep, Doctor) |
| `schemas.py` | Định dạng dữ liệu vào/ra API (request/response) |
| `database.py` | Kết nối tới database |
| `routers/patients.py` | API liên quan bệnh nhân (thêm, xem, cập nhật trạng thái khám) |
| `routers/rooms.py` | API liên quan phòng khám (trạng thái, sức chứa) |
| `routers/dashboard.py` | API tổng hợp cho màn dashboard: KPI, biểu đồ, cảnh báo SLA |
| `services/overload.py` | Tính sức chứa hiệu dụng và mức độ quá tải của phòng |
| `services/sla.py` | Tính bệnh nhân nào đang chờ quá lâu (cảnh báo SLA) |
| `services/simulator.py` | Sinh và di chuyển bệnh nhân giả lập, phục vụ demo/test |
| `requirements.txt` | Danh sách thư viện Python cần cài |

## frontend/ (Flutter)

| File | Chức năng |
|---|---|
| `lib/main.dart` | Điểm khởi động ứng dụng |
| `lib/api_client.dart` | Gọi API từ backend FastAPI |
| `lib/models/patient.dart` | Model dữ liệu bệnh nhân (khớp schema backend) |
| `lib/models/room.dart` | Model dữ liệu phòng khám (khớp schema backend) |
| `lib/screens/dashboard/dashboard_screen.dart` | Màn hình chính, ghép các widget lại |
| `lib/screens/dashboard/widgets/kpi_card.dart` | Thẻ hiển thị số liệu tổng quan (KPI) |
| `lib/screens/dashboard/widgets/room_grid.dart` | Lưới ô màu thể hiện trạng thái các phòng |
| `lib/screens/dashboard/widgets/day_chart.dart` | Biểu đồ tải bệnh nhân theo giờ trong ngày |
| `lib/screens/dashboard/widgets/sla_alert_list.dart` | Danh sách bệnh nhân đang chờ quá lâu |
| `lib/screens/dashboard/widgets/patient_list.dart` | Danh sách bệnh nhân, xem chi tiết lộ trình khám |
| `lib/screens/dashboard/widgets/room_list.dart` | Danh sách phòng, xem chi tiết trạng thái |

## data/ (dữ liệu dùng chung)

| File | Chức năng |
|---|---|
| `rooms.json` | Danh sách phòng khám mẫu (tên, loại, sức chứa) |
| `protocols.json` | Danh sách phác đồ điều trị theo giới tính |
| `doctors.json` | Danh sách bác sĩ/nhân sự mẫu |
| `patients_sample.json` | Bệnh nhân mẫu để test hoặc demo nhanh |

## docs/ (tài liệu)

| File | Chức năng |
|---|---|
| `api-spec.md` | Ghi chú các endpoint API, dữ liệu mẫu vào/ra |
| `demo-html/dashboard-v1.html` | Bản demo HTML gốc, dùng tham chiếu khi build FE thật |
| `demo-html/dashboard-v2.html` | Bản demo HTML đã nâng cấp, dùng tham chiếu khi build FE thật |

## Gốc dự án

| File | Chức năng |
|---|---|
| `README.md` | Giới thiệu tổng quan dự án, hướng dẫn chạy |
| `setup_project_structure_v2.sh` | Script tạo/cập nhật cấu trúc thư mục tự động |
