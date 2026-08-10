const express = require('express');
const router = express.Router();
const { db, getToday, getLocalTimestamp, normalizePatientList, patientRowToDto } = require('./db');
const { broadcast } = require('./websocket');
const { state, clearSimulationTimers, runSimulation, formatSimTime } = require('./simulation');

// ─── GET /api/rooms ──────────────────────────────────
router.get('/rooms', (req, res) => {
  const { ROOMS } = require('./config');
  res.json({ status: 'success', data: ROOMS });
});

// ─── PUT /api/rooms/:id ───────────────────────────────
router.put('/rooms/:id', (req, res) => {
  const { ROOMS } = require('./config');
  const roomId = req.params.id;
  const { slots } = req.body;

  if (slots === undefined || slots === null) {
    return res.status(400).json({ status: 'error', message: 'Thiếu giá trị slots' });
  }
  const newSlots = Number.parseInt(slots, 10);
  if (Number.isNaN(newSlots) || newSlots < 1 || newSlots > 20) {
    return res.status(400).json({ status: 'error', message: 'slots phải là số nguyên từ 1 đến 20' });
  }

  const room = ROOMS.find(r => r.id === roomId);
  if (!room) {
    return res.status(404).json({ status: 'error', message: `Không tìm thấy phòng ${roomId}` });
  }

  room.slots = newSlots;
  broadcast({ type: 'rooms', rooms: ROOMS });

  res.json({ status: 'success', message: `Đã cập nhật ${roomId} → ${newSlots} slot`, data: room });
});

// ─── GET /api/patients-live ──────────────────────────────
// Trả danh sách bệnh nhân hiện tại kèm trạng thái từng phòng (dùng cho Map UI)
router.get('/patients-live', (req, res) => {
  const today = getToday();
  const { ROOMS } = require('./config');

  db.all('SELECT * FROM patients WHERE visit_date = ? ORDER BY patient_id ASC', [today], (err, patientRows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    if (!patientRows.length) {
      return res.json({ status: 'success', data: [] });
    }

    db.all('SELECT * FROM touchpoints WHERE visit_date = ? ORDER BY timestamp ASC', [today], (err2, touchRows) => {
      if (err2) return res.status(500).json({ status: 'error', message: err2.message });

      // Build room-status per patient from touchpoints
      const roomStatusMap = {}; // { patient_id: { room_id: latestAction } }
      touchRows.forEach(t => {
        if (!roomStatusMap[t.patient_id]) roomStatusMap[t.patient_id] = {};
        roomStatusMap[t.patient_id][t.room_id] = t.action;
      });

      const data = patientRows.map(row => {
        let requiredRooms = [];
        try { requiredRooms = JSON.parse(row.required_rooms || '[]'); } catch {}

        const roomStatuses = requiredRooms.map(roomId => {
          const roomMeta = ROOMS.find(r => r.id === roomId);
          const status = (roomStatusMap[row.patient_id] || {})[roomId] || 'none';
          return { roomId, roomName: roomMeta ? roomMeta.name : roomId, status };
        });

        return {
          id: row.patient_id,
          name: row.patient_name,
          requiredRooms,
          roomStatuses,
        };
      });

      res.json({ status: 'success', data });
    });
  });
});
router.get('/patients', (req, res) => {
  const today = getToday();
  db.all('SELECT * FROM patients WHERE visit_date = ? ORDER BY patient_id ASC', [today], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: rows.map(patientRowToDto) });
  });
});

// ─── POST /api/patients ──────────────────────────────
router.post('/patients', (req, res) => {
  let normalized;
  try {
    normalized = normalizePatientList(req.body);
  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }
  const now = getLocalTimestamp();
  const visitDate = getToday();
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    const stmt = db.prepare(`
      INSERT INTO patients (patient_id, patient_name, required_rooms, visit_date, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(patient_id) DO UPDATE SET
        patient_name = excluded.patient_name,
        required_rooms = excluded.required_rooms,
        visit_date = excluded.visit_date,
        updated_at = excluded.updated_at
    `);
    for (const patient of normalized) {
      stmt.run(patient.id, patient.name, JSON.stringify(patient.requiredRooms), visitDate, now, now);
    }
    stmt.finalize((err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ status: 'error', message: err.message });
      }
      db.run('COMMIT', (commitErr) => {
        if (commitErr) {
          return res.status(500).json({ status: 'error', message: commitErr.message });
        }
        db.all('SELECT * FROM patients WHERE visit_date = ? ORDER BY patient_id ASC', [visitDate], (selectErr, rows) => {
          const allPatients = selectErr ? normalized : rows.map(patientRowToDto);
          const payload = {
            type: 'patients',
            patients: allPatients,
            timestamp: now
          };
          broadcast(payload);
          return res.json({
            status: 'success',
            message: 'Đã lưu danh sách bệnh nhân vào DB',
            data: allPatients
          });
        });
      });
    });
  });
});

// ─── POST /api/touchpoint ─────────────────────────────
router.post('/touchpoint', (req, res) => {
  const { patient_id, room_id, action, simulated_time } = req.body;
  if (!patient_id || !room_id || !action) {
    return res.status(400).json({ status: 'error', message: 'Thiếu dữ liệu bắt buộc' });
  }
  if (!['checkin', 'progress', 'waiting', 'done', 'none'].includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Action không hợp lệ' });
  }
  const event_id = `EVT_${Date.now()}`;
  const timestamp = getLocalTimestamp();
  const visitDate = getToday();
  const stmt = db.prepare(
    'INSERT INTO touchpoints (event_id, patient_id, room_id, action, timestamp, visit_date) VALUES (?, ?, ?, ?, ?, ?)'
  );
  stmt.run(event_id, patient_id, room_id, action, timestamp, visitDate, function(err) {
    if (err) {
      console.error('Lỗi khi lưu DB:', err);
      return res.status(500).json({ status: 'error', message: 'Không thể lưu dữ liệu' });
    }
    const payload = { event_id, patient_id, room_id, action, timestamp, simulated_time };
    console.log(`📌 [INCOMING TOUCHPOINT]: BN ${patient_id} ➔ ${room_id} (${action}) ${simulated_time ? '[' + simulated_time + ']' : ''}`);
    broadcast(payload);
    return res.json({ status: 'success', message: 'Đã tiếp nhận điểm chạm', data: payload });
  });
  stmt.finalize();
});

// ─── GET /api/history ────────────────────────────────
router.get('/history', (req, res) => {
  const today = getToday();
  // Lấy toàn bộ events trong ngày, sắp xếp ASC theo timestamp để replay đúng thứ tự
  db.all('SELECT * FROM touchpoints WHERE visit_date = ? ORDER BY timestamp ASC', [today], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: rows });
  });
});

// ─── GET /api/touchpoints (filter) ──────────────────
router.get('/touchpoints', (req, res) => {
  const {
    patient_id,
    room_id,
    action,
    q,
    from,
    to,
    visit_date,
    limit = '100',
    offset = '0'
  } = req.query;
  const clauses = [];
  const values = [];
  const targetDate = typeof visit_date === 'string' && visit_date.trim() ? visit_date.trim() : getToday();
  clauses.push('visit_date = ?');
  values.push(targetDate);
  if (patient_id) {
    clauses.push('patient_id = ?');
    values.push(patient_id);
  }
  if (room_id) {
    clauses.push('room_id = ?');
    values.push(room_id);
  }
  if (action) {
    clauses.push('action = ?');
    values.push(action);
  }
  if (from) {
    clauses.push('timestamp >= ?');
    values.push(from);
  }
  if (to) {
    clauses.push('timestamp <= ?');
    values.push(to);
  }
  if (q) {
    clauses.push('(event_id LIKE ? OR patient_id LIKE ? OR room_id LIKE ? OR action LIKE ?)');
    values.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const safeLimit = Math.max(1, Math.min(Number.parseInt(limit, 10) || 100, 500));
  const safeOffset = Math.max(0, Number.parseInt(offset, 10) || 0);
  const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `SELECT * FROM touchpoints ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  db.all(sql, [...values, safeLimit, safeOffset], (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({
      status: 'success',
      data: rows,
      meta: {
        visit_date: targetDate,
        limit: safeLimit,
        offset: safeOffset,
        count: rows.length
      }
    });
  });
});

// ─── POST /api/reset-day ─────────────────────────────
router.post('/reset-day', (req, res) => {
  const today = getToday();
  db.get(
    `
      SELECT
        (SELECT COUNT(*) FROM patients WHERE visit_date = ?) AS total_patients,
        (SELECT COUNT(DISTINCT patient_id) FROM touchpoints WHERE visit_date = ? AND action = 'done') AS completed_patients
    `,
    [today, today],
    (err, stats) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      const total = stats?.total_patients || 0;
      const completed = stats?.completed_patients || 0;
      db.run(
        `
          INSERT OR REPLACE INTO daily_stats (visit_date, total_patients, completed_patients)
          VALUES (?, ?, ?)
        `,
        [today, total, completed],
        (insertErr) => {
          if (insertErr) return res.status(500).json({ status: 'error', message: insertErr.message });
          db.run('DELETE FROM patients WHERE visit_date = ?', [today], (deletePatientsErr) => {
            if (deletePatientsErr) return res.status(500).json({ status: 'error', message: deletePatientsErr.message });
            db.run('DELETE FROM touchpoints WHERE visit_date = ?', [today], (deleteTouchpointsErr) => {
              if (deleteTouchpointsErr) return res.status(500).json({ status: 'error', message: deleteTouchpointsErr.message });
              clearSimulationTimers();
              broadcast({
                type: 'patients',
                patients: [],
                timestamp: getLocalTimestamp()
              });
              return res.json({ status: 'success', message: 'Reset day completed' });
            });
          });
        }
      );
    }
  );
});

// ─── POST /api/simulate (MỚI – dùng runSimulation có hàng đợi) ──
router.post('/simulate', async (req, res) => {
  if (state.running) {
    return res.status(400).json({ status: 'error', message: 'Mô phỏng đang chạy' });
  }

  const {
    numPatients = 100,
    startHour = 8,
    endHour = 16,
    speed = 60
  } = req.body || {};

  const today = getToday();

  // Reset dữ liệu trong ngày
  db.serialize(() => {
    db.run('DELETE FROM patients WHERE visit_date = ?', [today]);
    db.run('DELETE FROM touchpoints WHERE visit_date = ?', [today]);
  });

  // Broadcast danh sách rỗng để Dashboard cập nhật
  broadcast({
    type: 'patients',
    patients: [],
    _source: 'simulate',
    timestamp: getLocalTimestamp()
  });

  try {
    const result = await runSimulation({
      numPatients: Number(numPatients),
      startHour: Number(startHour),
      endHour: Number(endHour),
      speed: Number(speed),
      // Callback khi cần broadcast dữ liệu bệnh nhân ban đầu
      broadcastCallback: (data) => broadcast(data),
      // Callback xử lý từng touchpoint (thay vì dùng fetch)
      touchpointCallback: async (event) => {
        const { patientId, roomId, action, time } = event;
        const event_id = `EVT_${Date.now()}`;
        const timestamp = getLocalTimestamp();
        const visitDate = getToday();
        const simulated_time = formatSimTime(time);

        // 1. Lưu touchpoint vào DB
        const stmt = db.prepare(
          'INSERT INTO touchpoints (event_id, patient_id, room_id, action, timestamp, visit_date) VALUES (?, ?, ?, ?, ?, ?)'
        );
        stmt.run(event_id, patientId, roomId, action, timestamp, visitDate, function(err) {
          if (err) {
            console.error('Lỗi khi lưu touchpoint trong mô phỏng:', err);
          } else {
            const payload = { event_id, patient_id: patientId, room_id: roomId, action, timestamp, simulated_time };
            console.log(`📌 [SIMULATION TOUCHPOINT]: BN ${patientId} ➔ ${roomId} (${action}) ${simulated_time ? '[' + simulated_time + ']' : ''}`);
            broadcast(payload);
          }
        });
        stmt.finalize();

        // 2. Nếu là sự kiện checkin đầu tiên, lưu thông tin bệnh nhân vào DB
        if (event.isFirstEvent && event.patientInfo) {
          const patient = event.patientInfo;
          const now = getLocalTimestamp();
          const visitDate = getToday();
          const stmtPatient = db.prepare(`
            INSERT INTO patients (patient_id, patient_name, required_rooms, visit_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(patient_id) DO UPDATE SET
              patient_name = excluded.patient_name,
              required_rooms = excluded.required_rooms,
              visit_date = excluded.visit_date,
              updated_at = excluded.updated_at
          `);
          stmtPatient.run(patient.id, patient.name, JSON.stringify(patient.requiredRooms), visitDate, now, now, function(err) {
            if (err) console.error('Lỗi lưu bệnh nhân mô phỏng:', err);
          });
          stmtPatient.finalize();
        }
      }
    });

    res.json({
      status: 'success',
      message: 'Mô phỏng đã bắt đầu',
      totalEvents: result.schedule.length,
      patients: result.patients.length
    });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// ─── POST /api/stop-simulate ──────────────────────────
router.post('/stop-simulate', (req, res) => {
  clearSimulationTimers();
  res.json({ status: 'success', message: 'Đã dừng mô phỏng' });
});

// ─── GET /api/daily-stats ─────────────────────────────
router.get('/daily-stats', (req, res) => {
  db.all('SELECT * FROM daily_stats ORDER BY visit_date DESC LIMIT 30', (err, rows) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: rows });
  });
});

module.exports = router;