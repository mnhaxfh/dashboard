const { ROOMS } = require('./config');

// ─── State ──────────────────────────────────────────────
let simulationState = {
  running: false,
  timers: [],
  stopRequested: false,
};

function clearSimulationTimers() {
  simulationState.timers.forEach(timer => clearTimeout(timer));
  simulationState.timers = [];
  simulationState.running = false;
  simulationState.stopRequested = false;
}

// ─── Gaussian & arrival time ──────────────────────────
function gauss(x, mean, sigma) {
  return Math.exp(-Math.pow(x - mean, 2) / (2 * sigma * sigma));
}

function pickArrivalMinute(startHour, endHour) {
  const startMinute = startHour * 60;
  const endMinute = endHour * 60;
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = startMinute + Math.random() * (endMinute - startMinute);
    const weight = Math.max(
      gauss(candidate, 9 * 60, 45),
      gauss(candidate, 14 * 60, 45)
    );
    if (Math.random() < Math.min(1, weight * 180)) {
      return Math.round(candidate);
    }
  }
  return Math.round(startMinute + Math.random() * (endMinute - startMinute));
}

function formatSimTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Tạo lịch trình có hàng đợi (event‑driven) ──────
function generatePatientSchedule(numPatients, startHour, endHour) {
  const patients = [];
  const otherRooms = ROOMS.filter(r => r.id !== 'P114');

  for (let i = 0; i < numPatients; i++) {
    const numExtraRooms = 1 + Math.floor(Math.random() * 3);
    const shuffled = [...otherRooms].sort(() => Math.random() - 0.5);
    const requiredRooms = ['P114', ...shuffled.slice(0, numExtraRooms).map(r => r.id)];
    const id = `SIM${String(i + 1).padStart(4, '0')}`;
    const name = `Bệnh nhân ${i + 1}`;
    const arrival = pickArrivalMinute(startHour, endHour);
    patients.push({ id, name, requiredRooms, arrivalMinute: arrival });
  }

  const events = [];
  const schedule = [];
  const roomBusy = {};
  ROOMS.forEach(r => roomBusy[r.id] = []);

  // Sự kiện đến bệnh viện
  patients.forEach(patient => {
    events.push({
      time: patient.arrivalMinute,
      type: 'patientArrival',
      patient: patient,
      nextRoomIndex: 0
    });
  });

  function processEvent(event) {
    if (event.type === 'patientArrival') {
      const patient = event.patient;
      const roomId = patient.requiredRooms[0];
      events.push({
        time: patient.arrivalMinute,
        type: 'roomArrival',
        patient: patient,
        roomId: roomId,
        roomIndex: 0
      });
    } else if (event.type === 'roomArrival') {
      const patient = event.patient;
      const roomId = event.roomId;
      const roomIndex = event.roomIndex;
      const arrivalTime = event.time;

      // Lấy số slot tối đa của phòng (mặc định 1)
      const roomConfig = ROOMS.find(r => r.id === roomId);
      const capacity = roomConfig?.slots || 1;

      // roomBusy[roomId] là mảng các thời điểm kết thúc của từng slot đang dùng.
      // Loại bỏ các slot đã xong trước arrivalTime → còn lại là đang bận thực sự.
      roomBusy[roomId] = roomBusy[roomId].filter(end => end > arrivalTime);
      roomBusy[roomId].sort((a, b) => a - b);

      let startTime;
      if (roomBusy[roomId].length < capacity) {
        // Còn slot trống → vào ngay
        startTime = arrivalTime;
      } else {
        // Tất cả slot bận → chờ slot giải phóng sớm nhất
        // Slot sớm nhất kết thúc lúc roomBusy[roomId][0],
        // nhưng tại thời điểm đó có thể có BN khác cũng chờ.
        // Dùng thời điểm kết thúc sớm nhất làm startTime cho BN này.
        startTime = roomBusy[roomId][0];
        // Xóa slot đó khỏi danh sách (BN này sẽ chiếm slot đó)
        roomBusy[roomId].splice(0, 1);
      }

      const min = roomConfig?.minDuration ?? 8;
      const max = roomConfig?.maxDuration ?? 18;
      const duration = min + Math.floor(Math.random() * (max - min + 1));
      const endTime = startTime + duration;

      // Thêm slot mới vào danh sách bận
      roomBusy[roomId].push(endTime);
      roomBusy[roomId].sort((a, b) => a - b);

      schedule.push({
        time: arrivalTime,
        patientId: patient.id,
        roomId: roomId,
        action: 'checkin',
        isFirstEvent: roomIndex === 0,
        patientInfo: roomIndex === 0 ? patient : null
      });
      schedule.push({
        time: startTime,
        patientId: patient.id,
        roomId: roomId,
        action: 'progress'
      });
      schedule.push({
        time: endTime,
        patientId: patient.id,
        roomId: roomId,
        action: 'done'
      });

      const nextIndex = roomIndex + 1;
      if (nextIndex < patient.requiredRooms.length) {
        const travelTime = 1 + Math.floor(Math.random() * 3);
        const nextArrival = endTime + travelTime;
        events.push({
          time: nextArrival,
          type: 'roomArrival',
          patient: patient,
          roomId: patient.requiredRooms[nextIndex],
          roomIndex: nextIndex
        });
      }
    }
  }

  while (events.length > 0) {
    events.sort((a, b) => a.time - b.time);
    const event = events.shift();
    processEvent(event);
  }

  schedule.sort((a, b) => a.time - b.time);
  return { patients, schedule };
}

// ─── Chạy mô phỏng (chỉ dùng callback, không fetch) ──
async function runSimulation({
  numPatients,
  startHour,
  endHour,
  speed,
  broadcastCallback,
  touchpointCallback
}) {
  if (simulationState.running) {
    throw new Error('Mô phỏng đang chạy');
  }

  const { patients, schedule } = generatePatientSchedule(
    Number(numPatients),
    Number(startHour),
    Number(endHour)
  );

  clearSimulationTimers();
  simulationState.running = true;
  simulationState.stopRequested = false;

  // Gửi danh sách bệnh nhân ban đầu qua callback (nếu có)
  if (broadcastCallback) {
    broadcastCallback({
      type: 'patients',
      _source: 'simulate',
      patients: patients.map(p => ({
        id: p.id,
        name: p.name,
        requiredRooms: p.requiredRooms
      })),
      timestamp: new Date().toISOString()
    });
  }

  const firstEventTime = schedule.length > 0 ? schedule[0].time : 0;
  const effectiveSpeed = Math.max(1, Number(speed) || 60);

  // Lập lịch từng sự kiện
  for (let i = 0; i < schedule.length; i++) {
    const event = schedule[i];
    const delay = ((event.time - firstEventTime) * 60 * 1000) / effectiveSpeed;

    const timer = setTimeout(async () => {
      if (simulationState.stopRequested) return;

      // Gọi callback xử lý touchpoint (do routes.js cung cấp)
      if (touchpointCallback) {
        await touchpointCallback(event);
      }

      if (i === schedule.length - 1) {
        simulationState.running = false;
        console.log('✅ Mô phỏng hoàn tất');
      }
    }, Math.max(0, delay));

    simulationState.timers.push(timer);
  }

  return { patients, schedule };
}

// ─── Exports ───────────────────────────────────────────
module.exports = {
  state: simulationState,
  clearSimulationTimers,
  generatePatientSchedule,
  runSimulation,
  formatSimTime,
  pickArrivalMinute,
  gauss
};