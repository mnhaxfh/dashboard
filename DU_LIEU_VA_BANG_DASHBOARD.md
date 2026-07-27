# Mô tả dữ liệu & các bảng trong Dashboard

## 1. Các trường dữ liệu (data fields)

### Bệnh nhân (Patient)
| Trường | Mô tả |
|---|---|
| `patient_id` | Mã bệnh nhân (VD: BN1005) |
| `gender` | Giới tính (Nam/Nữ) — quyết định phác đồ áp dụng |
| `check_in_time` | Thời điểm bệnh nhân đến, dùng để tính thời gian chờ |
| `discharge_time` | Thời điểm xuất viện (null nếu chưa xong) |
| `status` | Đang khám / Đã xuất viện |

### Bước khám (Visit Step) — mỗi bệnh nhân có nhiều bước, mỗi bước ứng với 1 phòng
| Trường | Mô tả |
|---|---|
| `room_id` | Phòng thực hiện bước khám này |
| `doctor` | Bác sĩ/KTV phụ trách bước này |
| `status` | Chưa khám / Đang khám / Chờ kết quả / Đã xong |
| `queued_at` / `started_at` / `completed_at` | Mốc thời gian từng giai đoạn |

### Phòng khám (Room)
| Trường | Mô tả |
|---|---|
| `room_id` | Mã phòng (VD: P107) |
| `name` | Tên phòng (VD: Chọc hút noãn OPU) |
| `type` | Loại phòng: Khám lâm sàng / Thủ thuật / Xét nghiệm-Lab |
| `physical_capacity` (slots) | Sức chứa vật lý (số bàn/giường/máy) |
| `staff_on_duty` | Số nhân sự đang trực |
| `effective_capacity` | Sức chứa hiệu dụng = min(sức chứa vật lý, nhân sự × 2) |
| `min_intensity_to_open` | Ngưỡng tải tối thiểu để phòng mở cửa |


### Cảnh báo SLA
| Trường | Mô tả |
|---|---|
| `patient_id` | Bệnh nhân bị cảnh báo |
| `room_id` | Đang chờ vào phòng nào |
| `wait_minutes` | Đã chờ bao lâu |
| `threshold` | Ngưỡng cảnh báo (VD: 45 phút) |

---

## 2. Các bảng/khối trong Dashboard

| Khối | Nội dung hiển thị | Nguồn dữ liệu |
|---|---|---|
| **KPI tổng quan** | Tổng bệnh nhân đang theo dõi, đang khám, đã xuất viện, số phòng hoạt động, tỷ lệ quá tải | Tính từ danh sách Patient + Room theo thời gian thực |
| **Lưới trạng thái phòng** | Ô màu thể hiện từng phòng: đang mở/đóng, bận/quá tải | Room + số người đang chờ mỗi phòng |
| **Thời gian chờ** | Thời gian chờ trung bình hiện tại + biểu đồ mini xu hướng | Tính từ `check_in_time` các bệnh nhân chưa xuất viện |
| **Thời gian khám trung bình** | Trung bình tổng thời gian từ check-in đến xuất viện | Tính từ các ca đã có `discharge_time` |
| **Biểu đồ tải cả ngày** | Đường cong dự kiến lượng bệnh nhân theo giờ (06:00–20:00), đánh dấu thời điểm hiện tại | Mô hình tải theo giờ (2 khung cao điểm sáng/chiều) |
| **Bảng cảnh báo SLA** | Danh sách bệnh nhân chờ quá ngưỡng, kèm phòng đang chờ và mức ưu tiên | Tính từ Visit Step + ngưỡng SLA |
| **Danh sách bệnh nhân** | Mỗi dòng là 1 bệnh nhân, mở rộng xem chi tiết từng bước khám (phòng, bác sĩ, trạng thái) | Patient + Visit Step |
| **Danh sách phòng** | Mỗi dòng là 1 phòng, mở rộng xem loại phòng, nhân sự trực, sức chứa, ID bệnh nhân đang chờ/đang khám | Room + Visit Step |
