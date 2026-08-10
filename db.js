const sqlite3 = require('sqlite3').verbose();
const { dbPath, ROOMS } = require('./config');

// Helper: lấy ngày hiện tại theo múi giờ Việt Nam (YYYY-MM-DD)
function getToday() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' })
    .format(new Date())
    .slice(0, 10);
}

// Helper: lấy timestamp đầy đủ
function getLocalTimestamp() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date()).replace(' ', ' ');
}

function normalizePatientList(inputList) {
  if (!Array.isArray(inputList)) {
    throw new Error('Danh sách bệnh nhân phải là một mảng JSON');
  }
  return inputList.map((item, index) => {
    const id = String(item.id || item.patient_id || '').trim();
    const name = String(item.name || item.patient_name || '').trim();
    const requiredRooms = Array.isArray(item.requiredRooms)
      ? item.requiredRooms
      : item.required_rooms;
    if (!id) {
      throw new Error(`Bệnh nhân ở dòng ${index + 1} thiếu id`);
    }
    if (!Array.isArray(requiredRooms) || requiredRooms.length === 0) {
      throw new Error(`Bệnh nhân ${id} thiếu requiredRooms`);
    }
    const rooms = requiredRooms.map(roomId => String(roomId).trim()).filter(Boolean);
    if (rooms.length === 0) {
      throw new Error(`Bệnh nhân ${id} chưa có phòng hợp lệ`);
    }
    return {
      id,
      name: name || id,
      requiredRooms: rooms
    };
  });
}

function patientRowToDto(row) {
  let requiredRooms = [];
  try {
    requiredRooms = JSON.parse(row.required_rooms || '[]');
  } catch (error) {
    requiredRooms = [];
  }
  return {
    id: row.patient_id,
    name: row.patient_name,
    requiredRooms,
    visit_date: row.visit_date,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Khởi tạo database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Lỗi kết nối DB:', err.message);
  else console.log('⚡ Đã kết nối SQLite Database thành công.');
});

// Tạo bảng và alter
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      patient_id TEXT PRIMARY KEY,
      patient_name TEXT,
      required_rooms TEXT NOT NULL,
      visit_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS touchpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT,
      patient_id TEXT,
      room_id TEXT,
      action TEXT,
      timestamp DATETIME,
      visit_date TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visit_date TEXT UNIQUE NOT NULL,
      total_patients INTEGER,
      completed_patients INTEGER,
      avg_wait_time REAL,
      max_overload_rate REAL,
      peak_hour TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.all("PRAGMA table_info(patients)", (err, columns) => {
    if (!err && columns) {
      const hasVisitDate = columns.some(c => c.name === 'visit_date');
      if (!hasVisitDate) {
        db.run("ALTER TABLE patients ADD COLUMN visit_date TEXT");
      }
    }
  });
  db.all("PRAGMA table_info(touchpoints)", (err, columns) => {
    if (!err && columns) {
      const hasVisitDate = columns.some(c => c.name === 'visit_date');
      if (!hasVisitDate) {
        db.run("ALTER TABLE touchpoints ADD COLUMN visit_date TEXT");
      }
    }
  });

  const today = getToday();
  db.run("UPDATE patients SET visit_date = ? WHERE visit_date IS NULL OR visit_date = ''", [today]);
  db.run("UPDATE touchpoints SET visit_date = ? WHERE visit_date IS NULL OR visit_date = ''", [today]);
});

module.exports = {
  db,
  getToday,
  getLocalTimestamp,
  normalizePatientList,
  patientRowToDto,
  ROOMS,
};