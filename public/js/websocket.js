// ── WebSocket client — kết nối và xử lý message realtime ─────────────

function connectWebSocket() {
  socket = new WebSocket(LOCAL_WS_URL);

  socket.onopen = () => {
    console.log('⚡ Đã kết nối với Backend Ingestion Server Local!');
  };

  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);

    if (message.type === 'patients') {
      // Bỏ qua broadcast từ simulate (BN sẽ hiện dần theo từng checkin event)
      if (message._source === 'simulate') return;

      // Load thủ công hoặc reset → load toàn bộ ngay
      document.getElementById('jsonInput').value = JSON.stringify(message.patients, null, 2);
      initDataFromInput(message.patients);
      syncHistoryFromServer();
      setFormNote('inputSaveState', `Đã đồng bộ ${message.patients.length} bệnh nhân từ DB`, 'ok');
      return;
    }

    if (message.type === 'rooms') {
      // Cập nhật slots phòng realtime khi admin chỉnh từ tab khác
      if (Array.isArray(message.rooms)) {
        rooms = message.rooms;
        console.log('🔄 Đồng bộ cấu hình phòng:', rooms.map(r => `${r.id}(${r.slots})`).join(', '));
      }
      return;
    }

    // Touchpoint event: thêm BN mới vào danh sách nếu chưa có (hiện dần)
    if (message.patient_id && message.action === 'checkin') {
      if (!patients.find(p => p.id === message.patient_id)) {
        patients.push({ id: message.patient_id, name: message.patient_id, path: [] });
      }
    }

    console.log('📥 Điểm chạm mới:', message);
    updatePatientStatusFromEvent(message);
  };

  socket.onclose = () => {
    console.log('❌ Dashboard mất kết nối, thử lại sau 1s...');
    setTimeout(connectWebSocket, 1000);
  };

  socket.onerror = () => socket.close();
}
