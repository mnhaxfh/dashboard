// ── State toàn cục chia sẻ giữa các module ────────────────────────────

let patients = [];
let rooms = [...ROOM_DATABASE];
let socket = null;
let waitHistory = Array.from({ length: 16 }, () => 12);
let secsSinceRefresh = 0;
let currentIntensity = 0.1;
let currentDisplayDate = getTodayLocal();

function getTodayLocal() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date())
    .slice(0, 10);
}
