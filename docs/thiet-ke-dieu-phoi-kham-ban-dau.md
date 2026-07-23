# Tổng quan hệ thống và thiết kế điều phối khám ban đầu

> Phạm vi tài liệu: mô tả kiến trúc đang có và thiết kế logic cho bước **sau khi bệnh nhân check-in, chỉ định một bác sĩ lâm sàng phù hợp có ít người chờ nhất, rồi hướng dẫn bệnh nhân đến phòng khám**. Đây là tài liệu định hướng; chưa bao gồm mã nguồn hoặc migration SQL.

## 1. Bức tranh tổng quan dự án

Digital Twin Healthcare Kiosk là hệ thống hỗ trợ vận hành bệnh viện, gồm kiosk cho bệnh nhân, ứng dụng cho nhân viên/bác sĩ/quản trị, trợ lý giọng nói AI và cơ sở dữ liệu Supabase.

Các năng lực chính hiện có:

- Bệnh nhân vãng lai lấy số, tra cứu số chờ, check-in lịch đặt trước và hỏi đáp thông tin bệnh viện qua kiosk.
- Bệnh nhân đăng nhập xem lịch hẹn, hồ sơ, lộ trình/phòng ban và dùng trợ lý AI.
- Nhân viên thao tác hàng đợi, chỉ định/cập nhật xét nghiệm; quản trị quản lý dữ liệu nghiệp vụ.
- AI hội thoại bằng tiếng Việt, sử dụng công cụ nghiệp vụ để tra cứu hoặc cập nhật dữ liệu thay vì tự bịa thông tin.
- Hiển thị đường đi trên sơ đồ bệnh viện và gửi thông báo đẩy FCM khi được cấu hình.

### Thành phần và trách nhiệm

| Lớp | Công nghệ/chính | Trách nhiệm |
|---|---|---|
| FE | Flutter (`app/`) | Kiosk, ứng dụng đa vai trò, bản đồ, quản lý trạng thái bằng Provider, gọi Supabase/FastAPI/LiveKit. |
| BE | FastAPI (`backend/server.py`) | Cấp token LiveKit, relay chat kiosk, API hàng đợi/xét nghiệm/danh mục, xác thực và FCM. |
| AI agent | LiveKit Agents + LangChain/LangGraph (`backend/agent.py`, `kiosk_brain.py`) | Nhận giọng nói hoặc tin nhắn, hiểu ý định, gọi tool và trả lời bằng văn bản/giọng nói/bản đồ. |
| Dữ liệu | Supabase PostgreSQL | Auth, dữ liệu người dùng/lịch hẹn, bác sĩ, phòng, hàng đợi, chỉ định xét nghiệm, FAQ và realtime ở một số bảng. |
| Giao tiếp thời gian thực | LiveKit / Supabase Realtime / FCM | Phiên giọng nói và dữ liệu kiosk; realtime cho một số màn hình; push notification. |

### Luồng tổng thể hiện tại

```text
Người dùng
  │ Flutter: Kiosk / app bệnh nhân / app nhân viên
  ├── Supabase SDK ────────────────► Auth + PostgreSQL + Realtime
  │
  └── HTTP ─► FastAPI ─► LiveKit: token, dispatch, chat relay
                       │
                       ├── Supabase service-role: dữ liệu nghiệp vụ
                       └── LiveKit Agent ─► LLM + LangChain tools
                                             │
                         kiosk.response ◄───┘ (lời đáp + mapData)
```

## 2. FE, BE và AI phối hợp như thế nào

### 2.1 Frontend Flutter

FE là lớp trải nghiệm và hiển thị trạng thái. Ứng dụng khởi tạo Supabase bằng `SUPABASE_URL` và `SUPABASE_ANON_KEY`; các provider tải dữ liệu bệnh viện, lịch hẹn, tin nhắn và tài khoản. FE gọi thẳng Supabase cho nhiều chức năng ứng dụng thông thường, đồng thời gọi BE cho những tác vụ cần service role, điều khiển LiveKit hoặc nghiệp vụ kiosk.

Với kiosk (`kiosk_screen.dart`), FE thực hiện:

1. Gọi `GET /api/token` để nhận JWT LiveKit và URL server.
2. Kết nối vào phòng LiveKit dùng chung của kiosk; BE dispatch AI agent nếu cần.
3. Người dùng nói hoặc gõ. Tin nhắn văn bản đi qua `POST /api/chat`; âm thanh đi trực tiếp qua LiveKit.
4. Nhận data message ở topic `kiosk.response`, hiển thị đoạn hội thoại và cập nhật `mapData` (phòng hiện tại, các phòng đã đi/còn phải đi) trên bản đồ.

Các màn hình nghiệp vụ như quản lý xét nghiệm cũng gọi API FastAPI và/hoặc Supabase theo quyền của tài khoản. FE không nên quyết định bác sĩ được phân hay tự ghi hàng đợi: đó là quy tắc nghiệp vụ cần tập trung tại BE/DB.

### 2.2 Backend FastAPI

BE là biên tin cậy giữa client và các dịch vụ hệ thống:

- Xác minh token Supabase và phân quyền `patient`, `staff`, `admin`.
- Dùng service role để thao tác dữ liệu kiosk, tránh đưa khóa đặc quyền vào Flutter.
- Cấp token, tạo/dispatch phiên LiveKit, và relay chat sang topic `kiosk.chat`.
- Cung cấp API hàng đợi, bác sĩ, phòng xét nghiệm, chỉ định xét nghiệm và FCM.

`SupabaseRestClient` đang là lớp truy cập dữ liệu cho các thao tác kiosk. Nó đã có các hàm phát số, check-in theo booking code, tra cứu hàng đợi và bác sĩ. Đây là vị trí phù hợp để bổ sung repository/RPC cho điều phối khám, nhưng không nên đặt thuật toán chọn bác sĩ trong FE hoặc prompt AI.

### 2.3 Model AI / Kiosk Brain

Agent LiveKit nhận audio (STT tiếng Việt), chạy `KioskBrainLLM`, phát TTS và publish kết quả về FE. LLM có thể được cấu hình theo thứ tự:

1. Google Vertex AI (Gemini),
2. Gemini API,
3. OpenAI (mặc định dự phòng).

LangGraph tạo ReAct agent theo vai trò. Các tool bệnh nhân hiện gồm: lấy số, kiểm tra số chờ, check-in online, tra cứu xét nghiệm/phòng và FAQ. Vai trò nhân viên có thêm tool gọi số, xem hàng đợi và cập nhật xét nghiệm. Bối cảnh phiên gồm vai trò, `user_id`, tên và lịch sử hội thoại; lịch sử có thể được lưu vào `kiosk_sessions`.

Điểm quan trọng: AI chỉ là lớp hội thoại/orchestration. Với phân tuyến bác sĩ, LLM phải gọi một tool có kết quả quyết định từ BE/DB; không được tự so sánh số lượng người chờ từ ngôn ngữ tự nhiên hay tự chọn phòng.

## 3. Hiện trạng check-in và khoảng trống cần xử lý

Hiện tool `checkin_online(booking_code)` gọi `kiosk_online_checkin`. Khi mã đặt khám hợp lệ, hệ thống gán `consultation_token` nếu chưa có và đặt trạng thái `WAITING`; phản hồi hiện dừng ở “mời vào phòng chờ”.

Hàng đợi hiện có `doctor_id` trong một phiên bản schema đầy đủ, nhưng luồng phát số/check-in đang không dùng trường này để tạo hàng đợi riêng từng bác sĩ. API `GET /api/queue` cũng trả hàng đợi chung. Vì vậy, chức năng “bác sĩ ít người chờ nhất” **chưa được triển khai nhất quán**.

Ngoài ra, repository có hai script schema kiosk có khác biệt cột (`supabase_schema_kiosk.sql` và `SUPABASE_KIOSK_FULL_SETUP.sql`). Trước khi code, cần chọn schema chuẩn, chạy migration có kiểm soát và tránh triển khai dựa vào giả định cột đã tồn tại.

## 4. Mục tiêu của điều phối ban đầu

Sau check-in thành công, hệ thống phải:

1. Xác định nhóm bác sĩ lâm sàng đủ điều kiện khám bệnh nhân đó.
2. Chọn bác sĩ có tải chờ thấp nhất trong nhóm đủ điều kiện.
3. Gán lựa chọn và một số khám duy nhất, nguyên tử (atomic) để không phân trùng khi nhiều kiosk check-in đồng thời.
4. Trả cho FE/AI thông tin: bác sĩ, phòng, số khám, thứ tự chờ, ETA và chỉ dẫn đường đi.
5. Giữ nguyên lựa chọn khi bệnh nhân check-in lại (idempotent), trừ khi nhân viên chủ động chuyển tuyến.

Mục tiêu chính là cân bằng tải trong phạm vi chuyên môn/phòng khám phù hợp; không phải thay thế phân loại cấp cứu hoặc quyết định chuyên môn.

## 5. Quy tắc nghiệp vụ đề xuất

### 5.1 Điều kiện trước khi điều phối

- Check-in có `booking_code` hợp lệ hoặc có đối tượng lịch hẹn hợp lệ.
- Lịch hẹn xác định được `hospital_id` và ít nhất một `department`/nhóm khám.
- Bệnh nhân không thuộc tình huống cấp cứu. Nếu có cờ cấp cứu hoặc được sàng lọc nguy cơ cao, chuyển sang luồng tiếp nhận khẩn cấp do nhân viên xác nhận, không chạy thuật toán cân bằng tải.
- Chỉ xét bác sĩ đang hoạt động, đúng bệnh viện, đúng chuyên môn/khoa, đang trong ca và có phòng khám hợp lệ.

### 5.2 Tập ứng viên

Một bác sĩ là ứng viên khi tất cả điều kiện sau đúng:

- `active = true`;
- thuộc `hospital_id` và khoa/chuyên khoa phù hợp;
- có ca làm việc bao phủ thời điểm check-in và trạng thái ca `OPEN`;
- không bị khóa nhận bệnh (`accepting_new_patients = true`);
- chưa vượt ngưỡng tải an toàn/công suất;
- có tọa độ/phòng để chỉ đường.

Booking có yêu cầu rõ bác sĩ (`requested_doctor_id`) hoặc cần continuity care phải được gán bác sĩ đó nếu họ đủ điều kiện. Chỉ khi không có yêu cầu/không thể phục vụ mới dùng cân bằng tải và ghi rõ lý do ngoại lệ.

### 5.3 Chỉ số lựa chọn phiên bản 1

Để đáp ứng yêu cầu ban đầu và dễ kiểm chứng, dùng **số lượt đang chờ thấp nhất**:

```text
waiting_count = số queue item của doctor_id có status ∈ {WAITING, CALLED}
```

`WAITING` là người chưa được gọi; `CALLED` được tính vì vẫn đang chiếm tải bác sĩ. `IN_SERVICE` (nếu được bổ sung) cũng nên được tính vào tải thực tế, nhưng tách khỏi số người xếp trước để hiển thị cho bệnh nhân.

Thứ tự ưu tiên chọn:

1. `waiting_count` tăng dần;
2. `estimated_wait_minutes` tăng dần (nếu có dữ liệu tin cậy);
3. `last_assigned_at` tăng dần để phân đều khi hòa;
4. `doctor_id` tăng dần như tie-breaker quyết định được.

V1 không dùng AI/ML để chọn bác sĩ. Quy tắc deterministic giúp giải thích, kiểm thử và audit. Khi đủ dữ liệu vận hành, V2 có thể thay `waiting_count` bằng workload score có trọng số (số chờ, thời lượng khám trung bình, mức độ ưu tiên, độ trễ thực tế) nhưng vẫn phải giữ các ràng buộc y khoa phía trước.

### 5.4 Ngoại lệ

| Tình huống | Xử lý |
|---|---|
| Không có ứng viên | Không phát số theo bác sĩ; tạo trạng thái `PENDING_MANUAL_ASSIGNMENT`, thông báo quầy tiếp nhận. |
| Bệnh nhân check-in lại | Trả assignment/queue item đã có, không tạo thêm số. |
| Bác sĩ hết ca sau lúc gán | Nhân viên chuyển tuyến qua thao tác có audit; hệ thống thông báo bệnh nhân. |
| Hết công suất | Loại khỏi ứng viên và xét người kế tiếp; nếu tất cả hết chỗ, chuyển nhân viên xử lý. |
| Đồng thời nhiều check-in | Chỉ DB transaction/RPC được phép chọn + ghi; không dùng “đọc rồi ghi” từ ứng dụng. |
| Bác sĩ được chỉ định cố định | Ưu tiên chỉ định đó; không tự đổi vì ít người chờ. |

## 6. Mô hình dữ liệu mục tiêu

Tận dụng `kiosk_doctors`, `appointments` và `kiosk_queue_tokens`, nhưng chuẩn hóa để mỗi lượt khám gắn một bác sĩ và phiên làm việc.

| Thực thể | Trường quan trọng đề xuất | Vai trò |
|---|---|---|
| `doctors` / mở rộng `kiosk_doctors` | `doctor_id`, `hospital_id`, `department`, `active`, `room_id` | Danh mục và điều kiện cơ bản của bác sĩ. |
| `doctor_shifts` (mới) | `shift_id`, `doctor_id`, `starts_at`, `ends_at`, `status`, `accepting_new_patients`, `max_active_queue` | Nguồn đúng đắn cho “đang nhận bệnh”. |
| `appointments` | `id`, `patient_id`, `department`, `requested_doctor_id`, `checkin_at`, `status` | Lịch hẹn và ràng buộc nghiệp vụ. |
| `clinical_queue_items` (mới, khuyến nghị) | `id`, `appointment_id`, `patient_id`, `doctor_id`, `shift_id`, `queue_number`, `status`, `assigned_at`, `assignment_reason` | Một nguồn sự thật riêng cho hàng đợi khám lâm sàng. |
| `assignment_audit` (mới) | `queue_item_id`, `action`, `old_doctor_id`, `new_doctor_id`, `actor`, `reason`, `created_at` | Truy vết chọn/chuyển bác sĩ. |
| `rooms` / map | `room_id`, `label`, `floor`, `map_node_id`, `directions` | Hiển thị và chỉ đường. |

Khuyến nghị không tiếp tục quá tải bảng `kiosk_queue_tokens` cho cả số kiosk, số khám, trạng thái lab và hàng đợi lâm sàng. Nếu cần triển khai nhanh có thể mở rộng bảng này với `doctor_id`, `appointment_id`, `hospital_id`, `queue_type = CLINICAL`, `assigned_at`; nhưng về dài hạn `clinical_queue_items` rõ nghĩa và an toàn hơn.

Các ràng buộc cần có:

- Unique một queue item còn hiệu lực cho mỗi `appointment_id` (hoặc `patient_id` + ngày + `queue_type`).
- `doctor_id`, `shift_id`, `appointment_id` là foreign key.
- Queue number unique trong phạm vi bác sĩ + ca + ngày.
- Check constraint cho trạng thái: `WAITING`, `CALLED`, `IN_SERVICE`, `DONE`, `CANCELLED`, `NO_SHOW`, `PENDING_MANUAL_ASSIGNMENT`.
- Index theo `(doctor_id, shift_id, status)` và `(appointment_id)` để đếm/chống trùng nhanh.

## 7. Luồng điều phối đề xuất

```text
Bệnh nhân check-in
   │
   ▼
BE xác thực booking + sàng lọc điều kiện khẩn cấp
   │ hợp lệ
   ▼
RPC/transaction: tìm assignment hiện có?
   ├── Có ─► trả lại kết quả cũ (idempotent)
   └── Chưa có
          │
          ▼
    khóa dữ liệu ứng viên + lấy bác sĩ đủ điều kiện
          │
          ├── rỗng ─► PENDING_MANUAL_ASSIGNMENT + thông báo quầy
          └── không rỗng
                 │
                 ▼
          xếp theo tải → chọn bác sĩ đầu tiên
                 │
                 ▼
          tạo queue item + số khám + audit trong cùng transaction
                 │
                 ▼
       trả assignment, ETA, thông tin phòng/map node
                 │
                 ├── FE: màn hình xác nhận + bản đồ/đường đi
                 ├── AI: lời hướng dẫn tự nhiên từ dữ liệu đã quyết định
                 └── FCM: gửi thông báo nếu người bệnh có thiết bị đăng ký
```

### Pseudocode logic nghiệp vụ

```text
assignInitialClinicalQueue(checkin):
  begin transaction
  booking = validateAndLock(checkin.bookingCode)
  if booking.hasActiveAssignment:
      return booking.activeAssignment
  if booking.isEmergency:
      createManualEscalation(booking)
      return manualAssignmentRequired

  candidates = eligibleDoctors(booking.department, now)
  candidates = candidates where workload < capacity
  candidate = order(candidates,
                    waitingCount asc,
                    estimatedWait asc,
                    lastAssignedAt asc,
                    doctorId asc).first
  if candidate is null:
      createManualAssignmentRequired(booking)
      return manualAssignmentRequired

  queueItem = createQueueItem(booking, candidate, nextQueueNumber(candidate))
  writeAssignmentAudit(queueItem, "AUTO_ASSIGNED", reason="LOWEST_WAITING_COUNT")
  update booking check-in state
  commit transaction
  return queueItem with doctor and room
```

Chi tiết quan trọng: phần `eligibleDoctors`, đếm hàng chờ, chọn ứng viên và ghi queue item phải được gói trong một PostgreSQL RPC hoặc transaction có row/advisory lock phù hợp. Nếu mỗi kiosk tự `SELECT` số chờ rồi `INSERT`, hai request đồng thời có thể cùng chọn một bác sĩ, làm mất cân bằng và có nguy cơ trùng số thứ tự.

## 8. Hợp đồng API mục tiêu

### Endpoint nghiệp vụ

`POST /api/checkins/{booking_code}/clinical-assignment`

BE nhận yêu cầu của kiosk/FE đã xác thực. Endpoint là idempotent theo `booking_code` hoặc `Idempotency-Key`; không để AI gọi database trực tiếp.

Ví dụ phản hồi thành công:

```json
{
  "status": "ASSIGNED",
  "assignmentId": "...",
  "appointmentId": "...",
  "queue": {
    "number": "C014",
    "peopleAhead": 2,
    "estimatedWaitMinutes": 20,
    "status": "WAITING"
  },
  "doctor": {
    "id": "DR-001",
    "name": "BS. Nguyễn Văn Trí",
    "specialization": "Nam khoa tổng quát"
  },
  "destination": {
    "roomId": "P101",
    "label": "Phòng 101, tầng 1",
    "mapNodeId": "room-101",
    "directions": "..."
  },
  "assignmentReason": "LOWEST_WAITING_COUNT"
}
```

Khi không có ứng viên, trả `PENDING_MANUAL_ASSIGNMENT` với thông điệp an toàn cho FE/AI, không trả một bác sĩ/phòng do suy đoán.

### Tích hợp AI

Thay tool cũ hoặc bổ sung tool `checkin_va_dieu_phoi_kham(booking_code)`. Tool gọi client nội bộ BE/repository và nhận object có cấu trúc. AI chỉ chuyển kết quả thành lời nói: xác nhận số khám, bác sĩ, phòng, số người phía trước và hướng dẫn bản đồ. `mapData` được set từ `destination.mapNodeId` sau khi assignment thành công.

Tool cần có guardrail: không nhận `doctor_id` do LLM tự tạo; không cho phép AI tự thay đổi bác sĩ; không tiết lộ danh sách bệnh nhân/hàng chờ chi tiết cho bệnh nhân khác.

## 9. Trải nghiệm FE đề xuất

Sau thao tác check-in, FE hiển thị trạng thái loading ngắn, rồi một trang/xác nhận có:

- “Bạn đã được phân đến BS. …” và thông tin phòng/tầng;
- số khám, số người trước và ETA (nêu rõ chỉ là ước tính);
- nút “Chỉ đường” mở bản đồ, đánh dấu điểm hiện tại/đích;
- nút “Xem trạng thái hàng đợi” chỉ xem chính queue item của chính bệnh nhân;
- fallback rõ ràng: “Nhân viên đang sắp xếp phòng khám, vui lòng đến quầy …” khi cần gán thủ công.

Các cập nhật gọi số/chuyển tuyến nên đến từ Supabase Realtime hoặc FCM, sau đó FE refresh bằng API nguồn sự thật. Không dựa vào số người chờ được tính/cached trên client.

## 10. Bảo mật, an toàn và quan sát

- Bệnh nhân chỉ được gọi/check xem assignment của chính mình; `staff`/`admin` mới xem hoặc chuyển toàn bộ hàng đợi.
- Gán bác sĩ là quy tắc vận hành có ảnh hưởng chăm sóc bệnh nhân: mọi auto-assignment và reassignment cần audit, actor, lý do và thời điểm.
- Không đưa service-role key, lịch trực đầy đủ hoặc danh sách bệnh nhân vào client/LLM prompt.
- Với tình trạng khẩn cấp, luôn ưu tiên quy trình do nhân viên/chuyên môn quyết định; không tối ưu theo độ ngắn của hàng đợi.
- Theo dõi các metric: thời gian đợi theo bác sĩ/khoa, độ lệch tải, tỷ lệ gán thủ công, tỷ lệ check-in lặp, lỗi RPC, thời gian API và tỷ lệ bệnh nhân được chuyển tuyến.

## 11. Lộ trình triển khai sau khi chốt tài liệu

1. Chốt nguồn schema chuẩn và mô hình `doctor_shifts` + hàng đợi khám lâm sàng.
2. Viết migration có index, constraint, dữ liệu mẫu và rollback plan.
3. Viết PostgreSQL RPC/transaction điều phối; unit/integration test cho đồng thời, idempotency, hòa tải, hết ca, hết chỗ và không có ứng viên.
4. Thêm endpoint FastAPI có xác thực, kiểm tra ownership và observability.
5. Bổ sung tool AI có output có cấu trúc, cập nhật `mapData`; không thay logic quyết định bằng prompt.
6. Tích hợp UI check-in, bản đồ, realtime/FCM và màn hình nhân viên để chuyển tuyến.
7. Pilot với số bác sĩ/khoa hẹp, đối chiếu thời gian chờ thực tế trước khi mở rộng thuật toán ETA.

## 12. Tiêu chí nghiệm thu V1

- Sau check-in hợp lệ, bệnh nhân được gán đúng một bác sĩ đủ điều kiện hoặc nhận trạng thái chờ nhân viên xử lý.
- Trong các bác sĩ đủ điều kiện, hệ thống chọn người có `WAITING + CALLED` ít nhất; hòa tải chọn ổn định theo quy tắc đã công bố.
- Check-in lại không sinh số/assignment mới.
- Hai hoặc nhiều check-in đồng thời không tạo trùng queue number và không vượt công suất cấu hình.
- FE và AI nhận cùng một dữ liệu assignment từ nguồn BE/DB và chỉ đường đến đúng phòng.
- Mọi auto/manual assignment và chuyển tuyến đều truy vết được.
