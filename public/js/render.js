// ── Tất cả hàm render/cập nhật giao diện ─────────────────────────────

function initDataFromInput(inputList) {
  currentDisplayDate = getTodayLocal();
  patients = inputList.map(item => {
    const requiredRooms = Array.isArray(item.requiredRooms)
      ? item.requiredRooms
      : Array.isArray(item.required_rooms) ? item.required_rooms : [];

    const path = requiredRooms.map(roomId => {
      const roomObj = rooms.find(r => r.id === roomId);
      return { roomId, roomName: roomObj ? roomObj.name : roomId, status: 'none' };
    });

    return { id: item.id || item.patient_id, name: item.name || item.patient_name, path };
  });

  updateSelectDropdowns();
  render();
}

function updateSelectDropdowns() {
  document.getElementById('eventPatient').innerHTML =
    patients.map(p => `<option value="${p.id}">${p.id} - ${p.name}</option>`).join('');
  document.getElementById('eventRoom').innerHTML =
    rooms.map(r => `<option value="${r.id}">${r.id} - ${r.name}</option>`).join('');
}

// ── State bệnh nhân ────────────────────────────────────────────────────

function updatePatientStatusFromEvent(payload) {
  const { patient_id, room_id, action, timestamp, simulated_time } = payload;
  const patient = patients.find(p => p.id === patient_id);
  const roomObj  = rooms.find(r => r.id === room_id);

  if (patient) {
    const step     = patient.path.find(s => s.roomId === room_id);
    const eventTime = parseTimestampMs(timestamp) || Date.now();
    const simMin    = parseSimMinutes(simulated_time);

    if (step) {
      step.status = action;
      if (action === 'checkin') {
        if (!step.checkinTime)             step.checkinTime    = eventTime;
        if (simMin != null && step.simCheckinMin  == null) step.simCheckinMin  = simMin;
      }
      if (action === 'progress') {
        if (!step.progressTime)            step.progressTime   = eventTime;
        if (simMin != null && step.simProgressMin == null) step.simProgressMin = simMin;
      }
      if (action === 'done') {
        step.doneTime = eventTime;
        if (simMin != null) step.simDoneMin = simMin;
      }
    } else {
      const newStep = { roomId: room_id, roomName: roomObj ? roomObj.name : room_id, status: action };
      if (action === 'checkin')  { newStep.checkinTime   = eventTime; if (simMin != null) newStep.simCheckinMin  = simMin; }
      if (action === 'progress') { newStep.progressTime  = eventTime; if (simMin != null) newStep.simProgressMin = simMin; }
      if (action === 'done')     { newStep.doneTime       = eventTime; if (simMin != null) newStep.simDoneMin     = simMin; }
      patient.path.push(newStep);
    }
    render();
  }
}

// ── Tính toán quá tải phòng ───────────────────────────────────────────

function countWaitingForRoom(roomId) {
  let count = 0;
  patients.forEach(p => p.path.forEach(s => {
    if (s.roomId === roomId && (s.status === 'checkin' || s.status === 'waiting')) count++;
  }));
  return count;
}

function getRoomActivity(roomId) {
  const waitIds = [], progIds = [], doneIds = [];
  patients.forEach(p => {
    p.path.forEach(step => {
      if (step.roomId !== roomId) return;
      if (step.status === 'checkin' || step.status === 'waiting') waitIds.push(p.id);
      else if (step.status === 'progress') progIds.push(p.id);
      else if (step.status === 'done')     doneIds.push(p.id);
    });
  });
  return { waitIds, progIds, doneIds, hasPendingPatients: waitIds.length > 0 || progIds.length > 0 };
}

function computeOverload() {
  return rooms.map(r => {
    const waiting = countWaitingForRoom(r.id);
    const activity = getRoomActivity(r.id);
    const currentOccupancy = activity.progIds.length;
    // Quá tải khi số người đang CHỜ vượt 2 lần sức chứa
    const overloaded = activity.hasPendingPatients && activity.waitIds.length > r.slots * 2;
    return { ...r, waiting, overloaded, isOpen: activity.hasPendingPatients, currentOccupancy, ...activity };
  });
}

// ── Render toàn bộ giao diện ──────────────────────────────────────────

function render() {
  const roomsState = computeOverload();
  const overCount   = roomsState.filter(r => r.overloaded).length;
  const overPct     = Math.round((overCount / Math.max(1, roomsState.length)) * 100);
  const activeRooms = roomsState.filter(r => r.isOpen).length;

  const patientsExamining = patients.filter(p => p.path.some(s => s.status === 'progress')).length;
  const waitingCount      = patients.filter(p => p.path.some(s => s.status === 'checkin' || s.status === 'waiting') && !p.path.some(s => s.status === 'progress')).length;
  const notYetCount       = patients.filter(p => p.path.every(s => s.status === 'none')).length;
  const activePatients    = patients.filter(p => p.path.some(s => s.status !== 'none')).length;

  document.getElementById('kpiTotalPatients').textContent = activePatients;
  document.getElementById('kpiPatients').textContent      = patientsExamining;
  document.getElementById('kpiPatientsSub').textContent   = `${waitingCount} đang chờ · ${notYetCount} chưa khám`;
  document.getElementById('kpiRooms').textContent         = `${activeRooms} / ${roomsState.length}`;
  document.getElementById('kpiRooms').nextElementSibling.textContent = 'phòng có BN chờ hoặc đang khám';

  const overloadEl = document.getElementById('kpiOverload');
  overloadEl.textContent = overPct + '%';
  overloadEl.className = 'overload-pct mono ' + (overPct >= 25 ? 'warn' : 'ok');
  document.getElementById('kpiOverloadSub').textContent = `${overCount} / ${roomsState.length} phòng quá tải`;

  const grid = document.getElementById('roomGrid');
  grid.innerHTML = '';
  roomsState.forEach(r => {
    const cell = document.createElement('div');
    cell.className = 'room-cell ' + (r.overloaded ? 'over' : (r.isOpen ? 'busy' : 'idle'));
    cell.title = `${r.name}: ${r.currentOccupancy}/${r.slots} đang khám`;
    grid.appendChild(cell);
  });

  document.getElementById('patientCount').textContent = patients.length + ' mã';
  renderPatientList();
  renderRoomList(roomsState);
  refreshTimeMetrics();
}

function statusChip(status) {
  const labels = { none: 'Chưa khám', checkin: 'Đã check-in', progress: 'Đang khám', waiting: 'Chờ kết quả', done: 'Hoàn thành' };
  return `<span class="chip ${status}">${labels[status] || status}</span>`;
}

function renderPatientList() {
  const list = document.getElementById('patientList');
  const openIds = [...list.querySelectorAll('.row-detail.open')].map(el => el.dataset.id);
  list.innerHTML = '';

  patients.forEach(p => {
    const doneCount = p.path.filter(s => s.status === 'done').length;
    const isOpen = openIds.includes(p.id);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="row-head ${isOpen ? 'expanded' : ''}" onclick="toggleRow(this)">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="caret">▶</span>
          <span class="row-id">${p.id}</span>
          <span class="row-meta">(${p.name})</span>
        </div>
        <span class="row-meta">${doneCount}/${p.path.length} phòng xong</span>
      </div>
      <div class="row-detail ${isOpen ? 'open' : ''}" data-id="${p.id}">
        ${p.path.map(s => `
          <div class="detail-line">
            <span>${s.roomName} <span class="mono" style="color:var(--subtle);font-size:11px;">(${s.roomId})</span></span>
            ${statusChip(s.status)}
          </div>`).join('')}
      </div>`;
    list.appendChild(row);
  });
}

function renderRoomList(roomsState) {
  const list = document.getElementById('roomList');
  const openIds = [...list.querySelectorAll('.row-detail.open')].map(el => el.dataset.id);
  list.innerHTML = '';

  roomsState.forEach(r => {
    const isOpen = openIds.includes(r.id);
    const statusChipHtml = r.overloaded
      ? '<span class="chip over">Quá tải</span>'
      : (r.isOpen ? '<span class="chip done">Hoạt động</span>' : '<span class="chip none">Tạm nghỉ</span>');

    const tagList = (ids, cls) => ids.length
      ? `<div class="id-tags">${ids.map(id => `<span class="id-tag ${cls}">${id}</span>`).join('')}</div>`
      : `<div style="font-size:12px;color:var(--subtle);font-style:italic;">Không có</div>`;

    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <div class="row-head ${isOpen ? 'expanded' : ''}" onclick="toggleRow(this)">
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="caret">▶</span>
          <span class="row-id">${r.id}</span>
          <span class="row-meta">${r.name}</span>
        </div>
        <div>${statusChipHtml}</div>
      </div>
      <div class="row-detail ${isOpen ? 'open' : ''}" data-id="${r.id}">
        <div class="detail-stat-row">
          <div class="detail-stat">Sức chứa tối đa<b class="mono">${r.slots}</b></div>
          <div class="detail-stat">Đang khám<b class="mono">${r.currentOccupancy}</b></div>
          <div class="detail-stat">Đang chờ<b class="mono">${r.waiting}</b></div>
          <div class="detail-stat">Trạng thái<b>${r.overloaded ? 'Quá tải' : (r.isOpen ? 'Hoạt động' : 'Tạm nghỉ')}</b></div>
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:11px;color:var(--subtle);font-weight:600;text-transform:uppercase;">BN đang chờ (${r.waitIds.length})</div>
          ${tagList(r.waitIds, '')}
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:11px;color:var(--subtle);font-weight:600;text-transform:uppercase;">BN đang khám (${r.progIds.length})</div>
          ${tagList(r.progIds, 'prog')}
        </div>
        <div style="margin-top:8px;">
          <div style="font-size:11px;color:var(--subtle);font-weight:600;text-transform:uppercase;">BN đã xong (${r.doneIds.length})</div>
          ${tagList(r.doneIds, '')}
        </div>
      </div>`;
    list.appendChild(row);
  });
}

function toggleRow(headEl) {
  headEl.nextElementSibling.classList.toggle('open');
  headEl.classList.toggle('expanded');
}
