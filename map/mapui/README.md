# Map UI — Bản đồ Bệnh viện

Ứng dụng React hiển thị sơ đồ bệnh viện dạng SVG, tích hợp chỉ đường theo bệnh nhân đang khám thực tế.

> Đây là một ứng dụng con chạy riêng. Backend chính (`hospital-local-backend`) phải đang chạy để lấy dữ liệu bệnh nhân.

---

## Yêu cầu

- **Node.js** >= 18
- **npm**
- Backend đang chạy tại `http://localhost:3000`

---

## Chạy

```bash
# 1. Vào thư mục này
cd map/mapui

# 2. Cài dependencies (chỉ lần đầu)
npm install

# 3. Khởi động
npm run dev
```

Mở trình duyệt tại **`http://localhost:5173`**

---

## Cấu trúc

```
mapui/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── src/
    ├── main.tsx               # Entry point React
    ├── App.tsx                # Router component
    ├── index.css              # Tailwind + CSS variables
    ├── vite-env.d.ts          # Khai báo type cho *.png
    ├── assets/
    │   └── t1_*.png           # Ảnh sơ đồ tầng
    └── pages/
        └── HospitalMap.tsx    # Toàn bộ logic map (rooms, nodes, Dijkstra, UI)
```

---

## Tính năng

### Tab "Theo Bệnh Nhân" (mặc định)

1. Mở Map UI khi backend đang chạy và đã có bệnh nhân trong ngày
2. Danh sách bệnh nhân hiện ra bên phải, kèm thanh tiến độ và trạng thái từng phòng
3. **Bấm vào bệnh nhân** → map tự vẽ lộ trình qua các phòng còn lại
   - Phòng đã `done` được bỏ qua
   - Phòng đang `checkin / progress` được đưa lên đầu lộ trình
   - Mỗi chặng một màu khác nhau, có số thứ tự ① ② ③...
4. Nhấn **Làm mới** để đồng bộ trạng thái mới nhất từ backend

### Tab "Tìm Đường"

- Chọn điểm bắt đầu và điểm đích từ danh sách phòng
- Nhấn **Tìm đường** → vẽ lộ trình ngắn nhất (Dijkstra) lên map
- Hiển thị ước tính khoảng cách (mét)

### Pan & Zoom

- **Kéo** trên vùng map để di chuyển
- **Cuộn chuột** để zoom in/out
- Nút **⊞** góc phải trên để reset về view ban đầu

### Edit Mode

Dùng để căn chỉnh vị trí phòng cho khớp với sơ đồ thực tế.

| Thao tác | Kết quả |
|----------|---------|
| Kéo hình chữ nhật (phòng) | Di chuyển phòng |
| Kéo góc xanh dưới phải | Resize phòng |
| Kéo node cam (A1–A36) | Di chuyển điểm điều hướng |
| Thanh trượt "Nền" | Điều chỉnh độ mờ ảnh sơ đồ |
| Nút **Copy JSON** | Copy tọa độ đã chỉnh vào clipboard |
| Nút **Reset** | Về dữ liệu gốc trong code |

> Mọi thay đổi trong Edit Mode được lưu vào `localStorage` và không mất khi F5.
> Để lưu vĩnh viễn, nhấn **Copy JSON** rồi paste vào `INITIAL_ROOMS` / `INITIAL_NODES` trong `HospitalMap.tsx`.

---

## Các phòng trên bản đồ

14 phòng demo (P101–P114) được đặt vào đúng vị trí trên SVG:

| Khu vực | Phòng |
|---------|-------|
| Trung tâm (trái) | P103, P104, P106 — Siêu âm, Khám hiếm muộn, Siêu âm nang noãn |
| Trung tâm (phải) | P101, P102, P105 — Khám nam khoa, XN tinh dịch, Nội tiết |
| Cột phải (trên) | P107, P108, P109, P113 — OPU, ET, Trữ đông, XN nội tiết |
| Cột trái (trên) | P110, P111, P112 — IUI, Vi phẫu, Tư vấn di truyền |
| Cột trái (giữa) | P114 — Khám tổng quát |

---

## Thuật toán tìm đường

**Dijkstra** trên đồ thị gồm:
- **34 phòng** (node có `id` = roomId)
- **36 waypoint** (node hành lang A1–A36)
- **39 cạnh** nối các waypoint
- Cạnh phụ nối mỗi phòng tới waypoint gần nhất

Trọng số cạnh = khoảng cách pixel Euclidean (quy đổi ~10px ≈ 1m).

Multi-stop: với lộ trình bệnh nhân nhiều phòng, thuật toán chạy Dijkstra lần lượt từng chặng rồi ghép lại.

---

## Build production

```bash
npm run build    # output vào dist/
npm run preview  # xem trước bản build
```
