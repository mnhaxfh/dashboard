// ── Main entry point — khởi tạo và interval timers ──────────────────

// Khởi tạo data mặc định
document.getElementById('jsonInput').value = JSON.stringify(INITIAL_INPUT_DATA, null, 2);
initDataFromInput(INITIAL_INPUT_DATA);

// ── Kết nối dropdown bệnh nhân → phòng → status ──────────────────────
document.getElementById('eventPatient').addEventListener('change', function () {
  updateRoomDropdownForPatient(this.value);
});

document.getElementById('eventRoom').addEventListener('change', function () {
  const patientId = document.getElementById('eventPatient').value;
  const patient = patients.find(p => p.id === patientId);
  autoSuggestStatus(patient, this.value);
});

// Load rooms từ server → load patients → sync history
loadRoomsFromServer().then(() => {
  loadPatientsFromServer().finally(syncHistoryFromServer);
});

// Kết nối WebSocket
connectWebSocket();

// Timer: refresh secs counter
setInterval(() => {
  secsSinceRefresh += 1;
  document.getElementById('refreshSecs').textContent = secsSinceRefresh;
}, 1000);

// Timer: refresh metrics + check date change
setInterval(() => {
  secsSinceRefresh = 0;
  refreshTimeMetrics();
  checkDateChange();
}, 5000);
