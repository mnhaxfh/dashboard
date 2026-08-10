// ── Điều khiển mô phỏng từ phía client (gọi API backend) ─────────────

let simClockInterval = null;
let simStartRealTime = null;
let simSpeedMultiplier = 60;

function updateSimClockDisplay(totalSeconds) {
  const clampedSecs = Math.min(16 * 3600, Math.max(8 * 3600, Math.floor(totalSeconds)));
  const hrs = Math.floor(clampedSecs / 3600);
  const mins = Math.floor((clampedSecs % 3600) / 60);
  const secs = Math.floor(clampedSecs % 60);
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  const displayHrs = hrs % 12 === 0 ? 12 : hrs % 12;
  const timeStr = `${String(displayHrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} ${ampm}`;
  const clockEl = document.getElementById('simClock');
  if (clockEl) clockEl.textContent = timeStr;
}

function startSimClockTimer(speed = 60) {
  stopSimClockTimer();
  simSpeedMultiplier = speed;
  simStartRealTime = Date.now();
  simClockInterval = setInterval(() => {
    const elapsedRealSecs = (Date.now() - simStartRealTime) / 1000;
    const simSecs = (8 * 3600) + elapsedRealSecs * simSpeedMultiplier;
    updateSimClockDisplay(simSecs);
    if (simSecs >= 16 * 3600) stopSimClockTimer();
  }, 100);
}

function stopSimClockTimer() {
  if (simClockInterval) {
    clearInterval(simClockInterval);
    simClockInterval = null;
  }
}

function resetSimClock() {
  stopSimClockTimer();
  updateSimClockDisplay(8 * 3600);
}

async function startSimulation() {
  const status = document.getElementById('simStatus');
  status.textContent = 'Đang khởi tạo...';
  const speed = Number(document.getElementById('simSpeedSelect').value) || 60;
  try {
    const res = await fetch(`${LOCAL_API_URL}/api/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ numPatients: 100, startHour: 8, endHour: 16, speed })
    });
    const data = await res.json();
    if (data.status === 'success') {
      status.textContent = `✅ Đã bắt đầu: ${data.totalEvents} sự kiện cho ${data.patients} bệnh nhân (${speed}x)`;
      startSimClockTimer(speed);
    } else {
      status.textContent = '❌ ' + (data.message || 'Lỗi không xác định');
    }
  } catch (error) {
    status.textContent = '❌ ' + error.message;
  }
}

async function stopSimulation() {
  try {
    const res = await fetch(`${LOCAL_API_URL}/api/stop-simulate`, { method: 'POST' });
    const data = await res.json();
    stopSimClockTimer();
    document.getElementById('simStatus').textContent = data.status === 'success'
      ? '⏹ Đã dừng mô phỏng'
      : `❌ ${data.message || 'Không thể dừng mô phỏng'}`;
  } catch (error) {
    document.getElementById('simStatus').textContent = '❌ ' + error.message;
  }
}

async function resetDay() {
  const resetStatus = document.getElementById('resetStatus');
  if (!window.confirm('Reset sẽ xoá toàn bộ bệnh nhân và touchpoint của ngày hiện tại. Tiếp tục?')) {
    resetStatus.textContent = 'Đã huỷ reset';
    return;
  }
  resetStatus.textContent = 'Đang reset dữ liệu ngày hiện tại...';
  try {
    const res = await fetch(`${LOCAL_API_URL}/api/reset-day`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || data.status !== 'success') throw new Error(data.message || 'Không thể reset dữ liệu');
    await loadPatientsFromServer();
    syncHistoryFromServer();
    resetSimClock();
    document.getElementById('simStatus').textContent = 'Sẵn sàng';
    resetStatus.textContent = '✅ Đã reset dữ liệu ngày hiện tại';
  } catch (error) {
    resetStatus.textContent = '❌ ' + error.message;
  }
}
