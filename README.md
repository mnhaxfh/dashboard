# Hospital Local Backend

Hệ thống theo dõi luồng khám bệnh theo thời gian thực, gồm hai phần độc lập chạy song song:

- **Backend + Dashboard** — Node.js + SQLite + WebSocket, theo dõi bệnh nhân qua từng phòng
- **Map UI** — React + Vite, bản đồ SVG bệnh viện với chỉ đường theo bệnh nhân

---

## Yêu cầu

- **Node.js** >= 18
- **npm**

---

## Khởi động nhanh

### 1. Backend + Dashboard

```bash
# Cài dependencies (chỉ lần đầu)
npm install

# Chạy server
node server.js
# hoặc
npm start
```

Server chạy tại **`http://localhost:3000`**

| URL | Mô tả |
|-----|-------|
| `http://localhost:3000/dashboard` | Bảng điều khiển vận hành realtime |
| `http://localhost:3000/admin` | Xem dữ liệu DB (touchpoints) |

> ⚠️ Luôn mở qua `http://localhost:3000/dashboard`, **không** double-click file HTML.
> Mở file trực tiếp sẽ không kết nối được WebSocket.

### 2. Map UI (chạy riêng)

```bash
cd map/mapui

# Cài dependencies (chỉ lần đầu)
npm install

# Chạy dev server
npm run dev
```

Map UI chạy tại **`http://localhost:5173`**

> ⚠️ Backend (`node server.js`) phải đang chạy thì Map UI mới lấy được dữ liệu bệnh nhân.

---

## Cấu trúc dự án

```
hospital-local-backend/
│
├── server.js          # Entry point — Express + HTTP + WebSocket
├── config.js          # Port, đường dẫn DB, danh sách 14 phòng khám (ROOMS)
├── db.js              # Kết nối SQLite, tạo bảng, helper functions
├── routes.js          # Toàn bộ REST API (/api/...)
├── websocket.js       # WebSocket server, hàm broadcast()
├── simulation.js      # Logic sinh 100 bệnh nhân giả lập
│
├── public/
│   ├── dashboard.html         # Dashboard chính
│   └── js/
│       ├── config.js          # URL backend, danh sách phòng fallback
│       ├── state.js           # Biến global (patients, rooms, socket...)
│       ├── api.js             # Tất cả fetch() đến backend
│       ├── render.js          # Hàm render UI, tính toán overload
│       ├── metrics.js         # Tính thời gian chờ, load theo giờ
│       ├── websocket.js       # WebSocket client
│       ├── simulation.js      # Gọi API simulate từ FE
│       └── main.js            # Entry point FE, khởi tạo + timers
│
├── admin.html         # Trang xem DB
├── hospital.db        # SQLite (tự tạo khi chạy lần đầu)
│
└── map/
    └── mapui/         # Ứng dụng Map UI riêng biệt (xem README bên trong)
```

---

## Tính năng chính

### Dashboard (`/dashboard`)

**Nạp bệnh nhân**
- Nhập danh sách JSON hoặc tải từ DB, mỗi bệnh nhân có `id`, `name`, `requiredRooms` (mảng ID phòng)
- Lưu vào SQLite, broadcast qua WebSocket đến tất cả client

**Bắn sự kiện điểm chạm**
- Chọn bệnh nhân + phòng + trạng thái (`checkin / progress / waiting / done / none`)
- Lưu vào bảng `touchpoints`, realtime push đến dashboard

**Mô phỏng 100 bệnh nhân**
- Sinh dữ liệu demo tự động, có thể chọn tốc độ 1x → 600x
- Reset ngày để xóa sạch dữ liệu và bắt đầu lại

**Cấu hình sức chứa phòng**
- Panel "⚙️ Cấu hình Sức Chứa" ở dashboard, chỉnh `slots` (1–20) cho từng phòng
- Thay đổi có hiệu lực ngay, broadcast WebSocket đến tất cả tab đang mở

### Map UI (`http://localhost:5173`)

**Tab "Theo Bệnh Nhân" (mặc định)**
- Tự động tải danh sách bệnh nhân từ `/api/patients-live`
- Bấm vào bệnh nhân → map tự vẽ lộ trình qua các phòng còn lại
- Các chặng đường được tô màu khác nhau, có số thứ tự
- Phòng đã `done` bị bỏ qua, phòng đang `checkin/progress` được ưu tiên lên đầu

**Tab "Tìm Đường"**
- Chọn điểm bắt đầu và đích bất kỳ, tính đường ngắn nhất bằng Dijkstra

**Edit Mode**
- Kéo phòng / node để chỉnh vị trí cho khớp sơ đồ thực
- Copy JSON để lưu vĩnh viễn vào code

---

## REST API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| `GET` | `/api/rooms` | Danh sách 14 phòng và cấu hình |
| `PUT` | `/api/rooms/:id` | Cập nhật `slots` của một phòng |
| `GET` | `/api/patients` | Bệnh nhân trong ngày hôm nay |
| `POST` | `/api/patients` | Lưu / cập nhật danh sách bệnh nhân |
| `GET` | `/api/patients-live` | Bệnh nhân kèm trạng thái từng phòng (dùng cho Map UI) |
| `POST` | `/api/touchpoint` | Ghi nhận điểm chạm |
| `GET` | `/api/history` | Lịch sử touchpoint trong ngày (ASC) |
| `GET` | `/api/touchpoints` | Tìm kiếm touchpoint với filter |
| `POST` | `/api/simulate` | Bắt đầu mô phỏng |
| `POST` | `/api/stop-simulate` | Dừng mô phỏng |
| `POST` | `/api/reset-day` | Xóa toàn bộ dữ liệu ngày, lưu thống kê |
| `GET` | `/api/daily-stats` | Thống kê 30 ngày gần nhất |

---

## 14 Phòng khám demo

| ID | Tên | Slots mặc định |
|----|-----|----------------|
| P101 | Khám nam khoa | 2 |
| P102 | Xét nghiệm tinh dịch đồ | 2 |
| P103 | Siêu âm đầu dò | 2 |
| P104 | Khám hiếm muộn nữ | 2 |
| P105 | Nội tiết sinh sản | 2 |
| P106 | Siêu âm nang noãn | 2 |
| P107 | Chọc hút noãn (OPU) | 2 |
| P108 | Chuyển phôi (ET) | 2 |
| P109 | Trữ đông phôi & tinh trùng | 2 |
| P110 | IUI | 2 |
| P111 | Vi phẫu nam khoa | 2 |
| P112 | Tư vấn di truyền | 2 |
| P113 | Xét nghiệm nội tiết | 2 |
| P114 | Khám tổng quát | 3 |

Cấu hình trong `config.js` (backend) — thay đổi `slots` trực tiếp từ Dashboard hoặc chỉnh file.

---

## Schema DB (SQLite)

```sql
-- Bệnh nhân trong ngày
patients (patient_id, patient_name, required_rooms, visit_date, created_at, updated_at)

-- Điểm chạm realtime
touchpoints (id, event_id, patient_id, room_id, action, timestamp, visit_date)

-- Thống kê cuối ngày
daily_stats (visit_date, total_patients, completed_patients, ...)
```

`action` nhận một trong: `checkin` → `progress` → `waiting` → `done` → `none`

---

## WebSocket

Server push dữ liệu tới tất cả client mà không cần polling.

| `type` | Khi nào | Nội dung |
|--------|---------|---------|
| `patients` | Nạp / reset danh sách | `{ type, patients[], timestamp }` |
| `rooms` | Cập nhật slots | `{ type, rooms[] }` |
| *(không có type)* | Touchpoint mới | `{ event_id, patient_id, room_id, action, timestamp }` |

Dashboard tự reconnect sau 1 giây nếu mất kết nối.

---

## Mô phỏng — chi tiết

Sinh **100 bệnh nhân ảo** đi qua các phòng trong khung 08:00–16:00, tính đến hàng đợi và capacity.

| Tốc độ | Thời gian thực |
|--------|----------------|
| 1x | ~8 giờ |
| 60x | ~8 phút |
| 120x | ~4 phút |
| 300x | ~1.6 phút |
| 600x | ~48 giây |

Giờ đến của bệnh nhân theo phân phối **Gaussian 2 đỉnh**: 9:00 và 14:00.
Thêm chức năng demo thủ công, chọn bệnh nhân và chọn phòng khám.