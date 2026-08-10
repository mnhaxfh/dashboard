// ── Tất cả các lời gọi fetch đến backend REST API ────────────────────

function setFormNote(id, message, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = 'form-note mono' + (type ? ' ' + type : '');
}

async function loadRoomsFromServer() {
  try {
    const res = await fetch(`${LOCAL_API_URL}/api/rooms`);
    const result = await res.json();
    if (result.status === 'success' && Array.isArray(result.data)) {
      rooms = result.data;
      console.log('✅ Đã đồng bộ phòng từ server:', rooms.map(r => `${r.id}(${r.slots})`).join(', '));
    }
  } catch (e) {
    console.warn('Không thể tải danh sách phòng, dùng mặc định:', e);
  }
}

async function loadPatientsFromServer() {
  try {
    const response = await fetch(`${LOCAL_API_URL}/api/patients`);
    const result = await response.json();

    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Không thể tải danh sách bệnh nhân');
    }

    if (Array.isArray(result.data) && result.data.length > 0) {
      document.getElementById('jsonInput').value = JSON.stringify(result.data, null, 2);
      initDataFromInput(result.data);
      setFormNote('inputSaveState', `Đã nạp ${result.data.length} bệnh nhân từ DB`, 'ok');
      currentDisplayDate = getTodayLocal();
    } else {
      document.getElementById('jsonInput').value = '[]';
      initDataFromInput([]);
      setFormNote('inputSaveState', 'Không có bệnh nhân trong ngày hôm nay', 'ok');
      currentDisplayDate = getTodayLocal();
    }
  } catch (error) {
    setFormNote('inputSaveState', 'Backend chưa sẵn sàng, đang dùng dữ liệu mẫu', 'error');
    console.warn('Không thể tải danh sách bệnh nhân từ server:', error);
  }
}

async function savePatientsToServer(inputList) {
  const response = await fetch(`${LOCAL_API_URL}/api/patients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputList)
  });
  const result = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result.message || 'Không thể lưu danh sách bệnh nhân');
  }
  return result.data;
}

async function loadCustomInput() {
  try {
    const raw = document.getElementById('jsonInput').value;
    const parsed = JSON.parse(raw);
    setFormNote('inputSaveState', 'Đang lưu danh sách vào DB...');
    const savedPatients = await savePatientsToServer(parsed);
    initDataFromInput(savedPatients);
    document.getElementById('jsonInput').value = JSON.stringify(savedPatients, null, 2);
    setFormNote('inputSaveState', `Đã lưu ${savedPatients.length} bệnh nhân vào DB`, 'ok');
    syncHistoryFromServer();
  } catch (e) {
    setFormNote('inputSaveState', e.message || 'Định dạng JSON chưa đúng!', 'error');
    alert(e.message || 'Định dạng JSON chưa đúng!');
  }
}

async function triggerEvent() {
  const pId = document.getElementById('eventPatient').value;
  const rId = document.getElementById('eventRoom').value;
  const newStatus = document.getElementById('eventStatus').value;

  if (!pId || !rId || !newStatus) {
    setFormNote('eventSaveState', 'Thiếu patient / room / action', 'error');
    return;
  }

  try {
    setFormNote('eventSaveState', `Đang gửi ${pId} -> ${rId} (${newStatus})...`);
    const response = await fetch(`${LOCAL_API_URL}/api/touchpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: pId, room_id: rId, action: newStatus })
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'success') {
      throw new Error(result.message || 'Không thể lưu điểm chạm');
    }
    updatePatientStatusFromEvent(result.data);
    setFormNote('eventSaveState', `Đã lưu DB: ${result.data.event_id}`, 'ok');
  } catch (error) {
    setFormNote('eventSaveState', error.message || 'Không thể lưu điểm chạm', 'error');
  }
}

function syncHistoryFromServer() {
  fetch(`${LOCAL_API_URL}/api/history`)
    .then(r => r.json())
    .then(result => {
      if (!result || !Array.isArray(result.data)) return;
      // Server trả ASC theo timestamp → replay đúng thứ tự checkin→progress→done
      result.data.forEach(item => updatePatientStatusFromEvent(item));
      refreshTimeMetrics();
    })
    .catch(err => console.warn('Không thể tải lịch sử touchpoint:', err));
}

async function updateRoomSlots(roomId, newSlots) {
  const res = await fetch(`${LOCAL_API_URL}/api/rooms/${roomId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slots: newSlots })
  });
  const result = await res.json();
  if (!res.ok || result.status !== 'success') {
    throw new Error(result.message || 'Không thể cập nhật sức chứa');
  }
  return result.data;
}

function checkDateChange() {
  const today = getTodayLocal();
  if (today !== currentDisplayDate) {
    currentDisplayDate = today;
    loadPatientsFromServer();
    syncHistoryFromServer();
    setFormNote('inputSaveState', `Đã chuyển sang ngày ${today}`, 'ok');
  }
}
