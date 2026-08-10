// ── Cấu hình URL và dữ liệu mặc định phía client ──────────────────────

const LOCAL_API_URL = window.location.protocol === 'file:'
  ? 'http://localhost:3000'
  : window.location.origin;

const LOCAL_WS_URL = window.location.protocol === 'file:'
  ? 'ws://localhost:3000'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// Fallback mặc định — sẽ bị ghi đè bởi loadRoomsFromServer()
const ROOM_DATABASE = [
  { id: 'P101', name: 'Khám nam khoa',              slots: 2 },
  { id: 'P102', name: 'Xét nghiệm tinh dịch đồ',   slots: 2 },
  { id: 'P103', name: 'Siêu âm đầu dò',             slots: 2 },
  { id: 'P104', name: 'Khám hiếm muộn nữ',          slots: 2 },
  { id: 'P105', name: 'Nội tiết sinh sản',           slots: 2 },
  { id: 'P106', name: 'Siêu âm nang noãn',           slots: 2 },
  { id: 'P107', name: 'Chọc hút noãn (OPU)',         slots: 2 },
  { id: 'P108', name: 'Chuyển phôi (ET)',             slots: 2 },
  { id: 'P109', name: 'Trữ đông phôi & tinh trùng', slots: 2 },
  { id: 'P110', name: 'IUI',                         slots: 2 },
  { id: 'P111', name: 'Vi phẫu nam khoa',            slots: 2 },
  { id: 'P112', name: 'Tư vấn di truyền',            slots: 2 },
  { id: 'P113', name: 'Xét nghiệm nội tiết',        slots: 2 },
  { id: 'P114', name: 'Khám tổng quát',              slots: 3 }
];

const INITIAL_INPUT_DATA = [
  { id: 'BN1014', name: 'Phạm Văn Mạnh', requiredRooms: ['P101', 'P102', 'P103'] },
  { id: 'BN1015', name: 'Nguyễn Văn A',  requiredRooms: ['P104', 'P105', 'P106'] },
  { id: 'BN1016', name: 'Trần Thị B',    requiredRooms: ['P101', 'P113'] },
  { id: 'BN1017', name: 'Lê Văn C',      requiredRooms: ['P101', 'P102', 'P109'] }
];
